import type { Urn } from "@spacemakerai/element-types"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { elementState } from "src/core/elements/ElementState"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { requestApiGateway } from "src/lib/request"
import { captureException } from "@sentry/browser"
import {
  triggerAnalysis,
  fetchAnalysisById,
  fetchLatestAnalysis,
  getWindStatus,
  type Analysis,
  type AnalysisStatus,
} from "src/integrations/analyses/Triggers/wind/services/analysis-service"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { Alert, Alerts } from "./Alerts"
import { circleInsideTerrain, getTerrainElement } from "src/integrations/analyses/Triggers/circleValidation"
import type { ComponentChild } from "preact"
import { useTranslator, type Translator } from "src/i18n"
import { proposalHas3DGeometrySignal } from "src/integrations/analyses/Triggers/trigger-utils"

const WIND_BASE_URL = "/wind"
const POLL_INTERVAL = 10000
const DEFAULT_CIRCLE_RADIUS = 150
const DEFAULT_CIRCLE_X = 0
const DEFAULT_CIRCLE_Y = 0

function localTimeFormat(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function addLink(href: string, rel: string, attrs: Record<string, string> = {}) {
  if (document.head.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement("link")
  link.rel = rel
  link.href = href
  Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value))
  document.head.append(link)
}

function useFeatureFlag(feature: string): boolean {
  const [flags] = useState(() => {
    try {
      return JSON.parse(sessionStorage["forma-ld-flags"] || "{}")
    } catch {
      return {}
    }
  })
  const searchParams = new URLSearchParams(window.location.search)
  return flags[feature] || searchParams.get(feature) !== null
}

interface Props {
  rootElementUrn: Urn
  disabled: boolean
  tooltip?: string
  x?: number
  y?: number
  radius?: number
}

function getButtonDisabled(
  isLoading: boolean,
  analysisStatus: AnalysisStatus | undefined,
  circleInsideTerrainBoundingBox: boolean,
  hasEditorAccess: boolean,
  analysis: Analysis | undefined,
  triggeringAnalysis: boolean,
  t: Translator,
): { disabled: boolean; disabledText: string } {
  if (isLoading) return { disabled: true, disabledText: t(($) => $.windAnalysis.loadingData) }
  if (analysisStatus) {
    if (analysisStatus.concurrentUsage >= analysisStatus.concurrentLimit) {
      return { disabled: true, disabledText: t(($) => $.windAnalysis.concurrentQuotaReached) }
    } else if (analysisStatus.last24hUsage >= analysisStatus.last24hLimit) {
      return { disabled: true, disabledText: t(($) => $.windAnalysis.dailyQuotaReached) }
    }
  }
  if (!circleInsideTerrainBoundingBox)
    return { disabled: true, disabledText: t(($) => $.windAnalysis.circleOutsideBoundingBox) }
  if (!hasEditorAccess) return { disabled: true, disabledText: t(($) => $.windAnalysis.viewerAccessDisableTooltip) }
  if (triggeringAnalysis) return { disabled: true, disabledText: "" }
  switch (analysis?.status) {
    case "CREATED":
    case "IN_PROGRESS":
      return { disabled: true, disabledText: "" }
  }
  return { disabled: false, disabledText: "" }
}

function getButtonText(
  isLoading: boolean,
  analysis: Analysis | undefined,
  triggeringAnalysis: boolean,
  timeEstimateBounds: [number, number],
  t: Translator,
): string {
  if (isLoading) return t(($) => $.windAnalysis.loadingDataTooltip)
  if (triggeringAnalysis) return t(($) => $.windAnalysis.analyzing)
  switch (analysis?.status) {
    case "CREATED":
    case "IN_PROGRESS":
      return t(($) => $.windAnalysis.analyzing)
  }
  return t(($) => $.windAnalysis.runAnalysis, {
    min: timeEstimateBounds[0],
    max: timeEstimateBounds[1],
  })
}

function AnalysisStatusAlerts({ status }: { status: AnalysisStatus | undefined }) {
  const t = useTranslator()
  if (!status) return null

  const alerts: ComponentChild[] = []

  const { concurrentLimit, concurrentUsage } = status
  const concurrentWarningThreshold = Math.ceil(concurrentLimit / 3)
  const concurrentRemaining = concurrentLimit - concurrentUsage
  if (concurrentRemaining <= 0) {
    alerts.push(
      <Alert key="concurrent" label={t(($) => $.windAnalysis.concurrentQuotaReached)}>
        {t(($) => $.windAnalysis.concurrentQuotaReachedDescription)}
      </Alert>,
    )
  } else if (concurrentRemaining <= concurrentWarningThreshold) {
    alerts.push(
      <Alert key="concurrent" label={t(($) => $.windAnalysis.concurrentQuotaWarning)}>
        {t(($) => $.windAnalysis.concurrentQuotaWarningDescription, {
          remaining: concurrentRemaining,
          limit: concurrentLimit,
        })}
      </Alert>,
    )
  }

  const { last24hLimit, last24hUsage } = status
  const last24hRemaining = last24hLimit - last24hUsage
  if (last24hRemaining <= 0) {
    const nextAvailableAt = status.nextAvailableAt && localTimeFormat(new Date(status.nextAvailableAt))
    alerts.push(
      <Alert key="last24h" label={t(($) => $.windAnalysis.dailyQuotaReached)}>
        {nextAvailableAt
          ? t(($) => $.windAnalysis.dailyQuotaReachedDescriptionRetry, { nextAvailableAt })
          : t(($) => $.windAnalysis.dailyQuotaReachedDescription)}
      </Alert>,
    )
  }

  if (alerts.length === 0) return null

  return (
    <Alerts label={t(($) => $.analysis.alertsLabel)} count={alerts.length}>
      {alerts}
    </Alerts>
  )
}

export function AnalysisTrigger({ rootElementUrn, disabled, tooltip, x, y, radius }: Props) {
  const t = useTranslator()
  const selectedCircle = useMemo<Circle>(() => {
    if (x === undefined || y === undefined || radius === undefined)
      return {
        x: DEFAULT_CIRCLE_X,
        y: DEFAULT_CIRCLE_Y,
        radius: DEFAULT_CIRCLE_RADIUS,
      }
    return { x, y, radius }
  }, [x, y, radius])

  const [geoLocation, setGeoLocation] = useState<[number, number] | undefined>(undefined)
  const [geoLocationError, setGeoLocationError] = useState<Error | undefined>(undefined)
  const [analysis, setAnalysis] = useState<Analysis | undefined>(undefined)
  const [analysisError, setAnalysisError] = useState<Error | undefined>(undefined)
  const [analysisLoadingCounter, setAnalysisLoadingCounter] = useState(0)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | undefined>(undefined)
  const [analysisStatusError, setAnalysisStatusError] = useState<Error | undefined>(undefined)
  const [isTriggeringAnalysis, setIsTriggeringAnalysis] = useState(false)
  const [triggerAnalysisError, setTriggerAnalysisError] = useState<Error | undefined>(undefined)

  const forceRunAnalysis = useFeatureFlag("forceRunWindAnalysis")

  const authContext = useMemo(() => {
    return rootElementUrn.split(":")[3]
  }, [rootElementUrn])

  const hasEditorAccess = editAccessLevelSignal.value === "edit"

  const terrainElement = useMemo(() => {
    if (!rootElementUrn) return undefined
    const snapshot = elementState.currentSnapshot.peek()
    const proposalElement = snapshot.getFormaElement(rootElementUrn)
    if (!proposalElement) return undefined
    return getTerrainElement(proposalElement)
  }, [rootElementUrn])

  const has3Dgeometry = proposalHas3DGeometrySignal.value

  const circleInsideTerrainBoundingBox = useMemo(() => {
    if (!terrainElement) return true
    return circleInsideTerrain(terrainElement, selectedCircle)
  }, [terrainElement, selectedCircle])

  // Reset analysis when circle changes (allows triggering new analysis instead of only opening last one)
  useEffect(() => {
    if (x === undefined || y === undefined || radius === undefined) return
    setAnalysis(undefined)
  }, [x, y, radius])

  // Fetch wind status
  useEffect(() => {
    getWindStatus()
      .then((status) => {
        setAnalysisStatus(status)
        setAnalysisStatusError(undefined)
      })
      .catch((e) => {
        setAnalysisStatusError(e)
        captureException(new Error("Failed to get wind status", { cause: e }))
      })
  }, [])

  // Fetch geo location
  useEffect(() => {
    requestApiGateway(`/api/projects/${authContext}/geoLocation`)
      .then(async (response) => {
        const data = (await response.json()) as { point: [number, number] }
        setGeoLocation(data.point)
        setGeoLocationError(undefined)
      })
      .catch((err) => {
        console.warn("Failed to fetch project data:", err)
        setGeoLocationError(err)
        captureException(new Error("Failed to fetch project data", { cause: err }))
      })
  }, [authContext])

  // Fetch latest analysis
  useEffect(() => {
    setAnalysisLoadingCounter((c) => c + 1)
    fetchLatestAnalysis(authContext, rootElementUrn)
      .then((analysis) => {
        setAnalysis(analysis)
        setAnalysisError(undefined)
      })
      .catch((e) => {
        setAnalysisError(e)
        captureException(new Error("Failed to fetch latest analysis", { cause: e }))
      })
      .finally(() => setAnalysisLoadingCounter((c) => c - 1))
  }, [authContext, rootElementUrn])

  // Poll for analysis status when in progress
  useEffect(() => {
    if (analysis && ["CREATED", "IN_PROGRESS"].includes(analysis.status)) {
      const id = setInterval(() => {
        fetchAnalysisById(authContext, analysis.analysisId)
          .then((updatedAnalysis) => {
            setAnalysis(updatedAnalysis)
            setAnalysisError(undefined)
          })
          .catch((e) => {
            setAnalysisError(e)
            captureException(new Error("Failed to fetch analysis", { cause: e }))
          })
      }, POLL_INTERVAL)

      return () => clearInterval(id)
    }
  }, [analysis, authContext])

  // Preload analysis result page
  useEffect(() => {
    if (analysis && analysis.status === "SUCCEEDED") {
      addLink(`${WIND_BASE_URL}/${rootElementUrn}/${analysis.analysisId}`, "prerender")
    }
  }, [analysis, rootElementUrn])

  const isLoading = geoLocation === undefined || analysisLoadingCounter > 0

  const timeEstimateBounds = useMemo<[number, number]>(() => {
    const incr = 5 // 5 minute increments on time estimate
    const minTime = Math.round((selectedCircle.radius * 0.09) / incr) * incr
    const maxTime = Math.round((selectedCircle.radius * 0.4) / incr) * incr
    return [minTime, maxTime]
  }, [selectedCircle.radius])

  const buttonOnClickHandler = useCallback<JSX.MouseEventHandler<HTMLElement>>(
    (e) => {
      if (e.currentTarget.getAttribute("disabled")) return
      if (!geoLocation) return
      if (!analysis) {
        setIsTriggeringAnalysis(true)
        triggerAnalysis(rootElementUrn, {
          user_specified_circle: selectedCircle,
          geoLocation: geoLocation,
          force_run_analysis_with_steep_terrain: forceRunAnalysis,
        })
          .then((newAnalysis) => {
            setAnalysis(newAnalysis)
            setAnalysisStatus((current) =>
              current
                ? {
                    ...current,
                    concurrentUsage: current.concurrentUsage + 1,
                  }
                : current,
            )
            setAnalysisError(undefined)
            setTriggerAnalysisError(undefined)
          })
          .catch((e) => {
            setTriggerAnalysisError(e)
            captureException(e)
          })
          .finally(() => {
            setIsTriggeringAnalysis(false)
          })

        Analytics.track(
          EventName.Run,
          {
            feature_category: FeatureCategory.Analysis,
            feature: "analysis-trigger",
          },
          {
            root_element_urn: rootElementUrn,
            url: window.location.href,
            uses_custom_circle:
              selectedCircle.x !== DEFAULT_CIRCLE_X ||
              selectedCircle.y !== DEFAULT_CIRCLE_Y ||
              selectedCircle.radius !== DEFAULT_CIRCLE_RADIUS,
            circle_radius: selectedCircle.radius,
            analysis_type: "wind",
            has_3d_geometry: has3Dgeometry,
          },
        )
      }
    },
    [analysis, rootElementUrn, selectedCircle, geoLocation, forceRunAnalysis, has3Dgeometry],
  )

  const buttonDisabled = useMemo(() => {
    if (disabled) {
      return {
        disabled: true,
        disabledText: tooltip || "Not available",
      }
    }
    return getButtonDisabled(
      isLoading,
      analysisStatus,
      circleInsideTerrainBoundingBox,
      hasEditorAccess,
      analysis,
      isTriggeringAnalysis,
      t,
    )
  }, [
    disabled,
    tooltip,
    isLoading,
    analysisStatus,
    circleInsideTerrainBoundingBox,
    hasEditorAccess,
    analysis,
    isTriggeringAnalysis,
    t,
  ])

  return (
    <>
      {analysisStatus?.queueStatus === "AT_CAPACITY" && (
        <div style={{ marginBottom: "8px" }}>{t(($) => $.windAnalysis.atCapacity)}</div>
      )}
      {analysis?.status === "SUCCEEDED" ? (
        <weave-linkbutton
          disabled={disabled}
          style="display: block; width: 100%"
          variant="solid"
          href={`${WIND_BASE_URL}/${rootElementUrn}/${analysis.analysisId}`}
          onClick={(e: MouseEvent) => {
            if (
              !window.dispatchEvent(
                new CustomEvent("open-analysis", {
                  cancelable: true,
                  detail: {
                    analysisType: "wind",
                    elementUrn: analysis.rootElementUrn,
                    analysisId: analysis.analysisId,
                  },
                }),
              )
            ) {
              e.preventDefault()
            }
          }}
        >
          {t(($) => $.windAnalysis.seeAnalysisButton)}
        </weave-linkbutton>
      ) : (
        <weave-tooltip
          text={buttonDisabled.disabled ? buttonDisabled.disabledText : ""}
          style="display: block; width: 100%"
        >
          <weave-button
            disabled={buttonDisabled.disabled}
            onClick={buttonOnClickHandler}
            style="width: 100%"
            variant="solid"
          >
            {getButtonText(isLoading, analysis, isTriggeringAnalysis, timeEstimateBounds, t)}
          </weave-button>
        </weave-tooltip>
      )}
      <AnalysisStatusAlerts status={analysisStatus} />
      {analysis && ["INVALIDATED", "FAILED", "STOPPED"].includes(analysis.status) && (
        <p style={{ color: "red", textAlign: "center" }}>{t(($) => $.windAnalysis.stoppedOrFailed)}</p>
      )}
      {geoLocationError && <pre style={{ color: "red", whiteSpace: "normal" }}>{geoLocationError.message}</pre>}
      {analysisError && <pre style={{ color: "red", whiteSpace: "normal" }}>{analysisError.message}</pre>}
      {analysisStatusError && <pre style={{ color: "red", whiteSpace: "normal" }}>{analysisStatusError.message}</pre>}
      {triggerAnalysisError && <pre style={{ color: "red", whiteSpace: "normal" }}>{triggerAnalysisError.message}</pre>}
    </>
  )
}
