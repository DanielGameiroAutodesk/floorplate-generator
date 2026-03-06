import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { getTranslator, useTranslator } from "src/i18n"
import {
  triggerAnalysis,
  createAnalysisUrl,
  type TriggerAnalysisParams,
} from "src/integrations/analyses/Triggers/noise/services/analysis-service"
import { captureException } from "@sentry/browser"
import { hasElementWithNoiseData } from "src/integrations/analyses/Triggers/noise/validation/validation"
import { elementState } from "src/core/elements/ElementState"
import { dispatchIsLoadingEvent, addToast } from "src/integrations/analyses/Triggers/analysis-events"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { proposalHas3DGeometrySignal } from "src/integrations/analyses/Triggers/trigger-utils"

const DEFAULT_CIRCLE_RADIUS = 100
const DEFAULT_CIRCLE_X = 0
const DEFAULT_CIRCLE_Y = 0

interface Props {
  disabled: boolean
  tooltip?: string
  rootElementUrn: Urn
  selectedElementPaths: string[]
  customCircle?: Circle
  onTriggerButtonMouseOver?: JSX.MouseEventHandler<HTMLElement>
  onTriggerButtonMouseLeave?: JSX.MouseEventHandler<HTMLElement>
}

export function AnalysisTrigger({
  disabled,
  tooltip,
  rootElementUrn,
  selectedElementPaths,
  customCircle,
  onTriggerButtonMouseOver,
  onTriggerButtonMouseLeave,
}: Props) {
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerErrorMessage, setTriggerErrorMessage] = useState<string>("")
  const [noElementsWithRequiredInput, setNoElementsWithRequiredInput] = useState(false)

  const snapshot = elementState.currentSnapshot.value

  const has3Dgeometry = proposalHas3DGeometrySignal.value

  // Element validation
  useEffect(() => {
    if (disabled) return

    const abortController = new AbortController()

    const getElement = (urn: Urn): Promise<FormaElement | undefined> => {
      const element = snapshot.getFormaElement(urn)
      return Promise.resolve(element)
    }

    hasElementWithNoiseData(rootElementUrn, getElement, abortController.signal)
      .then((hasElementsWithRequiredInput) => {
        if (!abortController.signal.aborted) {
          if (hasElementsWithRequiredInput === undefined) {
            setNoElementsWithRequiredInput(false)
          } else {
            setNoElementsWithRequiredInput(!hasElementsWithRequiredInput)
          }
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          captureException(err)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [disabled, rootElementUrn, snapshot])

  const inputParams = useMemo<Partial<TriggerAnalysisParams>>(() => {
    return {
      selectedElementPaths,
      customCircle,
    }
  }, [selectedElementPaths, customCircle])

  const validParams = useMemo(() => {
    if (inputParams.customCircle || inputParams.selectedElementPaths?.length) {
      return inputParams as TriggerAnalysisParams
    }
    return undefined
  }, [inputParams])

  const hasEditorAccess = editAccessLevelSignal.value === "edit"

  const t = useTranslator()

  const buttonDisabled = useMemo(() => {
    if (disabled) {
      return {
        disabled: true,
        disabledText: tooltip || t(($) => $.analysis.disabledTooltips.notAvailable),
      }
    }
    if (!hasEditorAccess) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.notAbleAsViewer),
      }
    }
    if (triggerLoading) {
      return { disabled: true, disabledText: t(($) => $.analysis.disabledTooltips.pleaseWait) }
    }
    if (noElementsWithRequiredInput) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.addRoadsOrRails),
      }
    }
    if (!validParams) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.selectSiteLimitOrZone),
      }
    }
    return { disabled: false, disabledText: "" }
  }, [disabled, tooltip, hasEditorAccess, triggerLoading, noElementsWithRequiredInput, validParams, t])

  const buttonOnClickHandler = useCallback(() => {
    void (async () => {
      if (buttonDisabled.disabled) return
      if (!validParams) return

      setTriggerLoading(true)
      setTriggerErrorMessage("")

      dispatchIsLoadingEvent("noise", true)

      try {
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
              customCircle != null &&
              (customCircle.x !== DEFAULT_CIRCLE_X ||
                customCircle.y !== DEFAULT_CIRCLE_Y ||
                customCircle.radius !== DEFAULT_CIRCLE_RADIUS),
            circle_radius: customCircle?.radius,
            analysis_type: "noise",
            has_3d_geometry: has3Dgeometry,
          },
        )

        const analysis = await triggerAnalysis(rootElementUrn, validParams)
        if (analysis?.status !== "CREATED") {
          dispatchIsLoadingEvent("noise", false)
        }
        if (analysis?.status === "SUCCEEDED") {
          const analysisResultUrl = createAnalysisUrl({
            elementUrn: rootElementUrn,
            analysisId: analysis.analysisId,
          })
          const t = getTranslator()
          addToast({
            content: {
              text: t(($) => $.analysisErrors.analysisAlreadyExists),
              url: analysisResultUrl,
              linkText: t(($) => $.analysis.seeResultsButton),
            },
            status: "primary",
            autoDismiss: false,
          })
        }
      } catch (err: unknown) {
        dispatchIsLoadingEvent("noise", false)
        console.warn("Failed to trigger analysis:", err)
        setTriggerErrorMessage(err instanceof Error ? err.message : String(err))
        captureException(err)
      } finally {
        setTriggerLoading(false)
      }
    })()
  }, [buttonDisabled, validParams, rootElementUrn, customCircle, has3Dgeometry])

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <hr
        style={{
          margin: "0 0 12px 0",
          border: "none",
          borderTop: "1px solid #3c3c3c1a",
          height: "0",
          width: "100%",
        }}
      />
      <weave-tooltip
        text={buttonDisabled.disabled ? buttonDisabled.disabledText : ""}
        style="width: 100%"
        nub="down-right"
      >
        <weave-button
          disabled={buttonDisabled.disabled}
          onClick={buttonOnClickHandler}
          style="width: 100%"
          variant="solid"
          role="button"
          onMouseOver={onTriggerButtonMouseOver}
          onMouseLeave={onTriggerButtonMouseLeave}
        >
          Analyze (~2-10 mins)
        </weave-button>
      </weave-tooltip>
      {triggerErrorMessage && <pre style={{ color: "red", whiteSpace: "normal" }}>{triggerErrorMessage}</pre>}
    </div>
  )
}
