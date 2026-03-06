import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { projectSignal } from "src/core/project/project"
import {
  findByInput,
  type SunDate,
  triggerBatchAnalysis,
  type TriggerBatchAnalysisParams,
} from "src/integrations/analyses/Triggers/sun/services/analysis-service"
import { captureException } from "@sentry/browser"
import { SunDateInput } from "./SunDateInput"
import { analysisCatalogWebsocket } from "src/integrations/proposal-history/utils/useListenToTriggeredAnalyses"
import { FetchError } from "src/lib/request"
import { elementState } from "src/core/elements/ElementState"
import { useSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import {
  addToast,
  dispatchIsLoadingEvent,
  dispatchOpenAreaSelectEvent,
} from "src/integrations/analyses/Triggers/analysis-events"
import { useTranslator } from "src/i18n"
import { proposalHas3DGeometrySignal } from "src/integrations/analyses/Triggers/trigger-utils"
import {
  scenarioElementUploadSignal,
  triggerScenarioElementUpload,
} from "src/integrations/Scenarios/scenarioElementUploadState"

type AnalysisStatus = "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "STOPPED" | "INVALIDATED"

type AnalysisStatusWithExtra =
  | AnalysisStatus
  | `IN_PROGRESS:${number}`
  | `FAILED:${string}`
  | `STOPPED:${string}`
  | `INVALIDATED:${string}`

interface AnalysisCatalogItem {
  analysisId: string
  analysisType: string
  elementUrn?: string
  createdAt: number
  updatedAt: number
  status: AnalysisStatusWithExtra
}

type AnalysisCatalogChangeEventDetail =
  | {
      newItem: AnalysisCatalogItem
    }
  | {
      newItem: AnalysisCatalogItem
      oldItem: AnalysisCatalogItem
      changedKeys: string[]
    }
  | {
      oldItem: AnalysisCatalogItem
    }

function sortByDate(a: SunDate, b: SunDate) {
  return new Date(2017, a.month, a.date).getTime() - new Date(2017, b.month, b.date).getTime()
}

const DEFAULT_SUN_DATES: SunDate[] = (() => {
  const sunDates = JSON.parse(localStorage.getItem("forma-sun-analysis-trigger-dates") || "[]")
  return sunDates.length > 0 ? sunDates.filter(filterUniqueSunDates).sort(sortByDate) : [{ month: 6, date: 21 }]
})()

function filterUniqueSunDates(value: SunDate, index: number, array: SunDate[]) {
  const firstIndex = array.findIndex((sunDate) => sunDate.month === value.month && sunDate.date === value.date)
  return firstIndex === index
}

type AnalysisTriggerState =
  | {
      state: "IN_PROGRESS"
      analysisIds: string[]
    }
  | {
      state: "RUN_ANALYSIS"
    }
  | {
      state: "SUCCEEDED"
      analysisUrl: string
      analysisId: string
      elementUrn: string
    }

interface Props {
  disabled: boolean
  tooltip?: string
  onTriggerButtonMouseOver?: (event: Event) => void
  onTriggerButtonMouseLeave?: (event: Event) => void
}

export function SunAnalysisTrigger({ disabled, tooltip, onTriggerButtonMouseOver, onTriggerButtonMouseLeave }: Props) {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value
  const rootElementUrn = snapshot.rootUrn
  const { selectedElementPaths } = useSelectedElementPaths()
  const authContext = rootElementUrn.split(":")[3]

  const [sunDates, setSunDates] = useState<SunDate[]>(DEFAULT_SUN_DATES)
  const [triggerState, setTriggerState] = useState<AnalysisTriggerState>({
    state: "RUN_ANALYSIS",
  })

  const has3Dgeometry = proposalHas3DGeometrySignal.value

  const project = projectSignal.value

  const inputParams = useMemo<Partial<TriggerBatchAnalysisParams>>(() => {
    return {
      selectedElementPaths,
      ...(project?.geoLocation ? { geoLocation: project.geoLocation } : {}),
    }
  }, [selectedElementPaths, project])

  const validParams = useMemo(() => {
    if (!inputParams.selectedElementPaths?.length) return
    if (!inputParams.geoLocation) return
    return inputParams as TriggerBatchAnalysisParams
  }, [inputParams])

  // Reset trigger state on sun dates change
  useEffect(() => {
    setTriggerState({ state: "RUN_ANALYSIS" })
  }, [sunDates])

  // Check for existing analysis on parameters changed
  const scenarioElementUrnPromise = scenarioElementUploadSignal.value
  useEffect(() => {
    if (!validParams) return
    if (sunDates.length !== 1) {
      setTriggerState({ state: "RUN_ANALYSIS" })
      return
    }

    let cancelled = false
    setTriggerState({ state: "IN_PROGRESS", analysisIds: [] })
    void (async () => {
      const scenarioElementUrn = await scenarioElementUrnPromise
      if (cancelled) return

      const analysis = await findByInput(
        rootElementUrn,
        {
          ...validParams,
          sunDate: sunDates[0],
        },
        scenarioElementUrn,
      )
      if (cancelled) return

      if (analysis?.status === "SUCCEEDED") {
        setTriggerState({
          state: "SUCCEEDED",
          analysisUrl: `/sun-analysis/${rootElementUrn}/${analysis.analysisId}`,
          analysisId: analysis.analysisId,
          elementUrn: rootElementUrn,
        })
      } else if (analysis?.status === "IN_PROGRESS") {
        setTriggerState({
          state: "IN_PROGRESS",
          analysisIds: [analysis.analysisId],
        })
      } else {
        setTriggerState({ state: "RUN_ANALYSIS" })
      }
    })().catch((err) => {
      if (cancelled) return
      console.warn("[sun-analysis-trigger]:", "Failed to check for existing analysis:", err)
      setTriggerState({ state: "RUN_ANALYSIS" })
    })

    return () => {
      cancelled = true
    }
  }, [rootElementUrn, validParams, sunDates, scenarioElementUrnPromise])

  // Listen for changes on the current triggered analysis
  useEffect(() => {
    function onChange(event: CustomEvent<AnalysisCatalogChangeEventDetail>) {
      const detail = event.detail
      if (!("newItem" in detail)) {
        const deletedId = detail.oldItem.analysisId
        setTriggerState((current) => {
          if (current.state === "IN_PROGRESS" && current.analysisIds.includes(deletedId)) {
            return { state: "RUN_ANALYSIS" }
          } else if (current.state === "SUCCEEDED" && current.analysisUrl.includes(deletedId)) {
            return { state: "RUN_ANALYSIS" }
          }
          return current
        })
      } else if ("newItem" in detail) {
        const newItem = detail.newItem
        setTriggerState((current) => {
          if (
            current.state === "IN_PROGRESS" &&
            current.analysisIds.includes(newItem.analysisId) &&
            newItem.status.startsWith("SUCCEEDED")
          ) {
            return {
              state: "SUCCEEDED",
              analysisUrl: `/sun-analysis/${rootElementUrn}/${newItem.analysisId}`,
              analysisId: newItem.analysisId,
              elementUrn: rootElementUrn,
            }
          }
          return current
        })
      }
    }
    analysisCatalogWebsocket.addChangeListener(authContext, onChange)
    return () => analysisCatalogWebsocket.removeChangeListener(authContext, onChange)
  }, [authContext, rootElementUrn])

  // Save sun dates to localStorage
  useEffect(() => {
    localStorage.setItem("forma-sun-analysis-trigger-dates", JSON.stringify(sunDates))
  }, [sunDates])

  const onTriggerButtonClick = useCallback(() => {
    void (async () => {
      if (!validParams) return
      dispatchIsLoadingEvent("sun", true)
      setTriggerState({
        state: "IN_PROGRESS",
        analysisIds: [],
      })

      try {
        const uniqueSunDates = sunDates.filter(filterUniqueSunDates)
        if (uniqueSunDates.length === 0) {
          setTriggerState({ state: "RUN_ANALYSIS" })
          return
        }

        Analytics.track(
          EventName.Run,
          {
            feature_category: FeatureCategory.Analysis,
            feature: "analysis-trigger",
          },
          {
            root_element_urn: rootElementUrn,
            url: window.location.href,
            sun_dates_count: uniqueSunDates.length,
            analysis_type: "sun",
            has_3d_geometry: has3Dgeometry,
          },
        )
        const scenarioElementUrn = await triggerScenarioElementUpload()
        const analyses = await triggerBatchAnalysis(rootElementUrn, validParams, uniqueSunDates, scenarioElementUrn)
        const existingAnalysis = analyses.find((a) => a.status === "SUCCEEDED")
        if (existingAnalysis) {
          setTriggerState({
            state: "SUCCEEDED",
            analysisUrl: `/sun-analysis/${rootElementUrn}/${existingAnalysis.analysisId}`,
            analysisId: existingAnalysis.analysisId,
            elementUrn: rootElementUrn,
          })
          return
        }

        setTriggerState({
          state: "IN_PROGRESS",
          analysisIds: analyses.map((a) => a.analysisId),
        })
      } catch (err: unknown) {
        setTriggerState({ state: "RUN_ANALYSIS" })

        let errorCode = "unknown"
        if (err instanceof FetchError) {
          const errorText = err.body || (err instanceof Error ? err.message : String(err))
          try {
            const errorObj = JSON.parse(errorText) as { errorCode: string }
            errorCode = errorObj.errorCode.toString()
          } catch {
            errorCode = "unknown"
          }
        }

        switch (errorCode) {
          case "no_analyzable_elements":
            addToast({ content: { text: t(($) => $.analysisErrors.nothingToAnalyze) }, status: "error" })
            break
          case "too_many_concurrent_analyses":
            addToast({
              content: { text: t(($) => $.analysisErrors.concurrentAnalysesReached) },
              status: "error",
            })
            break
          case "too_many_analyses_per_day":
            addToast({
              content: { text: t(($) => $.analysisErrors.dailyQuotaReached) },
              status: "error",
            })
            break
          case "unknown":
            console.warn("[sun-analysis-trigger]:", "Failed to trigger analysis:", err)
            captureException(err)
            addToast({
              content: {
                text: "An unexpected error occured. Our engineers has been notified. Sorry for the inconvenience.",
              },
              status: "error",
            })
            break
        }
      } finally {
        dispatchIsLoadingEvent("sun", false)
      }
    })()
  }, [validParams, sunDates, rootElementUrn, has3Dgeometry, t])

  const changeDate = useCallback((sunDate: SunDate, i: number) => {
    setSunDates((oldSunDates) => [...oldSunDates.slice(0, i), sunDate, ...oldSunDates.slice(i + 1)])
  }, [])

  const deleteDate = useCallback((i: number) => {
    setSunDates((oldSunDates) => [...oldSunDates.slice(0, i), ...oldSunDates.slice(i + 1)])
  }, [])

  const addDate = useCallback(() => {
    setSunDates((oldSunDates) => [...oldSunDates, { month: 1, date: 1 }])
  }, [])

  const hasEditorAccess = editAccessLevelSignal.value === "edit"
  const disableAddDate = sunDates.length >= 12

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div
        style={{
          font: "var(--high-medium-medium)",
          display: "flex",
          height: "36px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        Analysis dates
        <weave-tooltip
          text={
            !hasEditorAccess ? "Can not add dates as viewer" : disableAddDate ? "Maximum 12 dates" : "Add analysis date"
          }
          nub="down-right"
        >
          <weave-icon-button
            onClick={disableAddDate ? undefined : addDate}
            disabled={!hasEditorAccess || disableAddDate}
          >
            <weave-solid-plus-operator slot="icon"></weave-solid-plus-operator>
          </weave-icon-button>
        </weave-tooltip>
      </div>
      <div style={{ marginBottom: "8px" }} data-tutorial-target="sun-analysis-date">
        {sunDates.map((sunDate, i) => (
          <SunDateInput
            month={sunDate.month}
            date={sunDate.date}
            onChange={(sunDate) => changeDate(sunDate, i)}
            onDelete={sunDates.length > 1 ? () => deleteDate(i) : undefined}
            key={i}
            disabled={!hasEditorAccess}
          />
        ))}
      </div>
      <TriggerButton
        authContext={authContext}
        state={triggerState}
        onClick={onTriggerButtonClick}
        onTriggerButtonMouseOver={onTriggerButtonMouseOver}
        onTriggerButtonMouseLeave={onTriggerButtonMouseLeave}
        params={validParams}
        disabled={disabled}
        tooltip={tooltip}
        data-tutorial-target="sun-analysis-run"
      />
    </div>
  )
}

type TriggerButtonProps = {
  authContext: string
  state: AnalysisTriggerState
  params?: TriggerBatchAnalysisParams
  onClick: (event: MouseEvent) => void
  onTriggerButtonMouseOver?: (event: Event) => void
  onTriggerButtonMouseLeave?: (event: Event) => void
  disabled?: boolean
  tooltip?: string
  "data-tutorial-target"?: string
}

function TriggerButton(props: TriggerButtonProps) {
  const t = useTranslator()
  const [hasAreaSelectHint, setHasAreaSelectHint] = useState(false)
  const hasEditorAccess = editAccessLevelSignal.value === "edit"

  if (props.disabled) {
    return (
      <weave-tooltip text={props.tooltip || ""} style="width: 100%">
        <weave-button
          style="width: 100%"
          variant="solid"
          onMouseOver={props.onTriggerButtonMouseOver}
          onMouseLeave={props.onTriggerButtonMouseLeave}
          disabled
          data-tutorial-target={props["data-tutorial-target"]}
        >
          Run analysis
        </weave-button>
      </weave-tooltip>
    )
  }

  if (!hasEditorAccess) {
    return (
      <weave-tooltip text={t(($) => $.analysis.disabledTooltips.notAbleAsViewer)} style="width: 100%">
        <weave-button
          style="width: 100%"
          variant="solid"
          onMouseOver={props.onTriggerButtonMouseOver}
          onMouseLeave={props.onTriggerButtonMouseLeave}
          disabled
          data-tutorial-target={props["data-tutorial-target"]}
        >
          Run analysis
        </weave-button>
      </weave-tooltip>
    )
  }

  if (props.state.state === "SUCCEEDED") {
    const { elementUrn, analysisId, analysisUrl } = props.state
    return (
      <weave-tooltip text={props.tooltip || ""} style="width: 100%">
        <weave-linkbutton
          style={"width: 100%; display: flex"}
          href={analysisUrl}
          variant="solid"
          onMouseOver={props.onTriggerButtonMouseOver}
          onMouseLeave={props.onTriggerButtonMouseLeave}
          data-tutorial-target={props["data-tutorial-target"]}
          onClick={(e: MouseEvent) => {
            if (
              !window.dispatchEvent(
                new CustomEvent("open-analysis", {
                  cancelable: true,
                  detail: {
                    analysisId,
                    elementUrn,
                    analysisType: "sun",
                  },
                }),
              )
            ) {
              e.preventDefault()
            }
          }}
        >
          Open analysis
        </weave-linkbutton>
      </weave-tooltip>
    )
  }

  if (props.state.state === "IN_PROGRESS") {
    return (
      <weave-tooltip text="Please wait..." style="width: 100%">
        <weave-button
          style="width: 100%"
          variant="solid"
          onMouseOver={props.onTriggerButtonMouseOver}
          onMouseLeave={props.onTriggerButtonMouseLeave}
          disabled
          data-tutorial-target={props["data-tutorial-target"]}
        >
          Run analysis
        </weave-button>
      </weave-tooltip>
    )
  }

  if (!props.params) {
    return (
      <weave-tooltip text={t(($) => $.analysis.selectAreaToRunAnalysis)} style="width: 100%">
        <weave-button
          disabled={hasAreaSelectHint}
          onMouseOver={props.onTriggerButtonMouseOver}
          onMouseLeave={props.onTriggerButtonMouseLeave}
          onClick={() => {
            setHasAreaSelectHint(true)
            dispatchOpenAreaSelectEvent()
          }}
          style="width: 100%"
          variant="solid"
          data-tutorial-target={props["data-tutorial-target"]}
        >
          Run analysis
        </weave-button>
      </weave-tooltip>
    )
  }

  return (
    <weave-tooltip text={props.tooltip || ""} style="width: 100%">
      <weave-button
        onClick={props.onClick}
        onMouseOver={props.onTriggerButtonMouseOver}
        onMouseLeave={props.onTriggerButtonMouseLeave}
        style="width: 100%;"
        variant="solid"
        data-tutorial-target={props["data-tutorial-target"]}
      >
        Run analysis
      </weave-button>
    </weave-tooltip>
  )
}
