import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { enclosingCircleOfAnalyzeSelectionState } from "src/integrations/analyses/Selection/analysis-selection-state"
import type { FormaElement } from "@spacemakerai/element-types"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { useTranslator } from "src/i18n"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import ManageCustomCenter, {
  customCenterActiveSignal,
  customCenterPointSignal,
} from "src/integrations/analyses/Triggers/microclimate/selection/ManageCustomCenter"
import { projectSignal } from "src/core/project/project"
import { getTerrainElement, circleInsideTerrain } from "src/integrations/analyses/Triggers/circleValidation"
import {
  triggerAnalysis,
  getWindStatus,
  type TriggerAnalysisParams,
  type AnalysisStatus,
} from "src/integrations/analyses/Triggers/microclimate/services/analysis-service"
import {
  DEFAULT_CIRCLE_RADIUS,
  DEFAULT_CIRCLE_X,
  DEFAULT_CIRCLE_Y,
} from "src/integrations/analyses/Triggers/microclimate/utils/circle"
import { elementState } from "src/core/elements/ElementState"
import { captureException } from "@sentry/browser"
import { useRecoilValue } from "recoil"
import {
  getDelocalisedRadius,
  getLocalisedRadius,
} from "src/integrations/analyses/Triggers/wind/DetailedWindAnalysisTrigger"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { getCircleSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import { useAnalysisSelectionAPI } from "src/integrations/analysis-selection/AnalysisSelectionAPI"
import { useGroundTextureAPI } from "src/integrations/ground-texture/GroundTextureAPI"
import { useIsImperial } from "src/lib/unitSettings"
import { dispatchIsLoadingEvent } from "src/integrations/analyses/Triggers/analysis-events"
import { proposalHas3DGeometrySignal } from "src/integrations/analyses/Triggers/trigger-utils"

const CIRCLE_STORAGE_KEY = "forma-selected-microclimate-circle"

const storedCircle = sessionStorage.getItem(CIRCLE_STORAGE_KEY)
const INITIAL_CIRCLE = storedCircle
  ? JSON.parse(storedCircle)
  : { x: DEFAULT_CIRCLE_X, y: DEFAULT_CIRCLE_Y, radius: DEFAULT_CIRCLE_RADIUS }

interface Props {
  disabled: boolean
  tooltip?: string
}

export function MicroclimateAnalysisTrigger({ disabled, tooltip }: Props) {
  const enclosingCircleOfSelection = useRecoilValue(enclosingCircleOfAnalyzeSelectionState)
  const customCenterPoint = customCenterPointSignal.value
  const [radius, setRadius] = useState(INITIAL_CIRCLE.radius)

  const snapshot = elementState.currentSnapshot.value
  const rootElementUrn = snapshot.rootUrn
  const isImperial = useIsImperial()
  const groundTextureApi = useGroundTextureAPI("microclimate")
  const analysisSelectionAPI = useAnalysisSelectionAPI()

  const selectedCircle = useMemo<Circle>(() => {
    return enclosingCircleOfSelection ? { ...enclosingCircleOfSelection, radius } : { ...customCenterPoint, radius }
  }, [enclosingCircleOfSelection, customCenterPoint, radius])

  useEffect(() => {
    sessionStorage.setItem(CIRCLE_STORAGE_KEY, JSON.stringify(selectedCircle))
  }, [selectedCircle])

  const selectedElementPaths = useMemo(() => {
    return getCircleSelectedElementPaths(selectedCircle, snapshot, analysisSelectionAPI)
  }, [selectedCircle, snapshot, analysisSelectionAPI])

  const updateRadius = useCallback(
    (e: CustomEvent<string>) => {
      const newRadius = getDelocalisedRadius(Number(e.detail), isImperial)
      setRadius(newRadius)
    },
    [isImperial],
  )

  const has3Dgeometry = proposalHas3DGeometrySignal.value

  const getTerrainPointUnderMouse = useCallback(() => {
    const hit = raycastApi.raycastTerrain()
    if (!hit) return undefined
    const { x, y, z } = hit.position
    if (x === 0 && y === 0 && z === 0) return undefined
    return { x, y }
  }, [])

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | undefined>(undefined)
  const [terrainElement, setTerrainElement] = useState<FormaElement | undefined>(undefined)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerErrorMessage, setTriggerErrorMessage] = useState<string>("")

  const project = projectSignal.value

  const inputParams = useMemo<Partial<TriggerAnalysisParams>>(() => {
    return {
      rootElementUrn,
      selectedElementPaths,
      circle: selectedCircle,
      ...(project?.geoLocation && project?.timezone
        ? { geoLocation: project.geoLocation, timezone: project.timezone }
        : {}),
    }
  }, [rootElementUrn, selectedElementPaths, selectedCircle, project])

  useEffect(() => {
    void getWindStatus().then((status) => {
      setAnalysisStatus(status)
    })
  }, [])

  useEffect(() => {
    if (rootElementUrn) {
      const proposalElement = snapshot.getFormaElement(rootElementUrn)
      if (proposalElement) {
        const terrain = getTerrainElement(proposalElement)
        setTerrainElement(terrain)
      }
    }
  }, [rootElementUrn, snapshot])

  useEffect(() => {
    const event = "forma/analysis-selection/custom-circle-enabled"
    const listener = () => {
      customCenterActiveSignal.value = true
    }
    window.addEventListener(event, listener)
    return () => window.removeEventListener(event, listener)
  }, [])

  const validParams = useMemo(() => {
    if (!inputParams.circle) return undefined
    if (!inputParams.geoLocation) return undefined
    if (!inputParams.timezone) return undefined
    return inputParams as TriggerAnalysisParams
  }, [inputParams])

  const circleInsideTerrainBoundingBox = useMemo(() => {
    // Returning true to ensure we are not "down" in case element logic is faulty
    // We still have the "delayed" backend guard
    if (!terrainElement) return true
    if (!selectedCircle) return true
    return circleInsideTerrain(terrainElement, selectedCircle)
  }, [terrainElement, selectedCircle])

  const hasEditorAccess = editAccessLevelSignal.value === "edit"
  const t = useTranslator()

  const buttonDisabled = useMemo(() => {
    if (disabled) {
      return {
        disabled: true,
        disabledText: tooltip || t(($) => $.analysis.disabledTooltips.notAvailable),
      }
    }
    if (analysisStatus) {
      if (analysisStatus.concurrentUsage >= analysisStatus.concurrentLimit) {
        return {
          disabled: true,
          disabledText: t(($) => $.analysis.disabledTooltips.concurrentQuotaReached),
        }
      } else if (analysisStatus.last24hUsage >= analysisStatus.last24hLimit) {
        return {
          disabled: true,
          disabledText: t(($) => $.analysis.disabledTooltips.dailyQuotaReached),
        }
      }
    }
    if (!circleInsideTerrainBoundingBox) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.analysisAreaOutsideMap),
      }
    }
    if (triggerLoading) {
      return { disabled: true, disabledText: t(($) => $.analysis.disabledTooltips.loadingData) }
    } else if (!hasEditorAccess) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.notAbleAsViewer),
      }
    } else if (!validParams) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.invalidParameters),
      }
    } else {
      return { disabled: false, disabledText: "" }
    }
  }, [
    disabled,
    tooltip,
    analysisStatus,
    circleInsideTerrainBoundingBox,
    triggerLoading,
    hasEditorAccess,
    validParams,
    t,
  ])

  const buttonOnClickHandler = useCallback(() => {
    void (async () => {
      if (buttonDisabled.disabled) return
      if (!validParams) return

      setTriggerLoading(true)
      setTriggerErrorMessage("")

      dispatchIsLoadingEvent("microclimate", true)

      try {
        const selectedCircleForAnalytics = validParams.circle

        Analytics.track(
          EventName.Run,
          {
            feature_category: FeatureCategory.Analysis,
            feature: "analysis-trigger",
          },
          {
            root_element_urn: validParams.rootElementUrn,
            url: window.location.href,
            uses_custom_circle:
              selectedCircleForAnalytics.x !== DEFAULT_CIRCLE_X ||
              selectedCircleForAnalytics.y !== DEFAULT_CIRCLE_Y ||
              selectedCircleForAnalytics.radius !== DEFAULT_CIRCLE_RADIUS,
            circle_radius: selectedCircleForAnalytics.radius,
            analysis_type: "microclimate",
            has_3d_geometry: has3Dgeometry,
          },
        )

        const analysis = await triggerAnalysis(validParams)
        if (analysis?.status !== "IN_PROGRESS") {
          dispatchIsLoadingEvent("microclimate", false)
        }
      } catch (err: unknown) {
        dispatchIsLoadingEvent("microclimate", false)
        console.warn("Failed to trigger analysis:", err)
        setTriggerErrorMessage(err instanceof Error ? err.message : String(err))
        captureException(err)
      } finally {
        setTriggerLoading(false)
      }
    })()
  }, [buttonDisabled, validParams, has3Dgeometry])

  return (
    <>
      <div style={{ display: "flex", font: "var(--11-medium)", justifyContent: "space-between", lineHeight: "24px" }}>
        <span>{t(($) => $.analysis.microclimateAreaRadius)}</span>
        <span>{getLocalisedRadius(radius, isImperial) + (isImperial ? " ft" : " m")}</span>
      </div>
      <div style={{ padding: "6px 0" }}>
        <weave-slider
          max={isImperial ? "1140" : "350"}
          min={isImperial ? "500" : "150"}
          label={t(($) => $.analysis.radiusLabel)}
          value={`${getLocalisedRadius(radius, isImperial)}`}
          onChange={updateRadius}
          onInput={updateRadius}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        {groundTextureApi && (
          <ManageCustomCenter
            groundTextureApi={groundTextureApi}
            getTerrainPointUnderMouse={getTerrainPointUnderMouse}
            selectedCircle={selectedCircle}
          />
        )}
        <weave-tooltip text={buttonDisabled.disabled ? buttonDisabled.disabledText : ""} style="width: 100%">
          <weave-button
            disabled={buttonDisabled.disabled}
            onClick={buttonOnClickHandler}
            style="width: 100%"
            variant="solid"
            role="button"
          >
            Run analysis
          </weave-button>
        </weave-tooltip>
        {triggerErrorMessage && (
          <div style={{ color: "red", whiteSpace: "normal" }}>
            {t(($) => $.analysis.failedToOrder, { error: triggerErrorMessage })}
          </div>
        )}
      </div>
    </>
  )
}
