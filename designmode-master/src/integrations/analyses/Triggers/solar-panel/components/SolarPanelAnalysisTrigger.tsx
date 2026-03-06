import { useCallback, useMemo, useState } from "preact/hooks"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { projectSignal } from "src/core/project/project"
import {
  triggerAnalysis,
  createAnalysisUrl,
  type TriggerAnalysisParams,
} from "src/integrations/analyses/Triggers/solar-panel/services/analysis-service"
import { captureException } from "@sentry/browser"
import { elementState } from "src/core/elements/ElementState"
import { useSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import { dispatchIsLoadingEvent, addToast } from "src/integrations/analyses/Triggers/analysis-events"
import { useTranslator } from "src/i18n"
import { getTranslator } from "src/i18n"
import { proposalHas3DGeometrySignal } from "src/integrations/analyses/Triggers/trigger-utils"

interface Props {
  disabled: boolean
  tooltip?: string
  onTriggerButtonMouseOver?: (event: Event) => void
  onTriggerButtonMouseLeave?: (event: Event) => void
}

export function SolarPanelAnalysisTrigger({
  disabled,
  tooltip,
  onTriggerButtonMouseOver,
  onTriggerButtonMouseLeave,
}: Props) {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value
  const rootElementUrn = snapshot.rootUrn
  const { selectedElementPaths } = useSelectedElementPaths()

  const has3Dgeometry = proposalHas3DGeometrySignal.value

  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerErrorMessage, setTriggerErrorMessage] = useState<string>("")

  const project = projectSignal.value

  const inputParams = useMemo<Partial<TriggerAnalysisParams>>(() => {
    return {
      selectedElementPaths: selectedElementPaths.length ? selectedElementPaths : ["root"],
      ...(project?.geoLocation ? { geoLocation: project.geoLocation } : {}),
    }
  }, [selectedElementPaths, project])

  const validParams = useMemo(() => {
    if (inputParams.geoLocation && inputParams.selectedElementPaths?.length) {
      return inputParams as TriggerAnalysisParams
    }
    return undefined
  }, [inputParams])

  const hasEditorAccess = editAccessLevelSignal.value === "edit"

  const buttonDisabled = useMemo(() => {
    if (disabled) {
      return {
        disabled: true,
        disabledText: tooltip || "Not available",
      }
    }
    if (!hasEditorAccess) {
      return {
        disabled: true,
        disabledText: "Not able to order analyses as a viewer",
      }
    }
    if (triggerLoading) {
      return { disabled: true, disabledText: "Please wait..." }
    }
    if (!validParams) {
      return {
        disabled: true,
        disabledText: "Invalid parameters",
      }
    }
    return { disabled: false, disabledText: "" }
  }, [disabled, tooltip, hasEditorAccess, triggerLoading, validParams])

  const buttonOnClickHandler = useCallback(() => {
    void (async () => {
      if (buttonDisabled.disabled) return
      if (!validParams) return

      setTriggerLoading(true)
      setTriggerErrorMessage("")

      dispatchIsLoadingEvent("solar-panel", true)

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
            analysis_type: "solar-panel",
            has_3d_geometry: has3Dgeometry,
          },
        )

        const analysis = await triggerAnalysis(rootElementUrn, validParams)
        if (analysis?.status !== "IN_PROGRESS") {
          dispatchIsLoadingEvent("solar-panel", false)
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
              linkText: t(($) => $.analysis.seeResultButton),
            },
            status: "primary",
            autoDismiss: false,
          })
        }
      } catch (err: unknown) {
        dispatchIsLoadingEvent("solar-panel", false)
        console.warn("Failed to trigger analysis:", err)
        setTriggerErrorMessage(err instanceof Error ? err.message : String(err))

        // Show user-friendly error messages as toasts for known error cases
        const errorMessage = err instanceof Error ? err.message : String(err)
        if (
          errorMessage.includes("Nothing to analyze") ||
          errorMessage.includes("concurrent analyses") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("Something went wrong")
        ) {
          addToast({
            content: { text: errorMessage },
            status: "error",
          })
        } else {
          captureException(err)
        }
      } finally {
        setTriggerLoading(false)
      }
    })()
  }, [buttonDisabled, validParams, rootElementUrn, has3Dgeometry])

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <weave-tooltip text={buttonDisabled.disabled ? buttonDisabled.disabledText : ""} style="width: 100%">
        <weave-button
          disabled={buttonDisabled.disabled}
          onClick={buttonOnClickHandler}
          style="width: 100%"
          variant="solid"
          role="button"
          onMouseOver={onTriggerButtonMouseOver}
          onMouseLeave={onTriggerButtonMouseLeave}
        >
          Run analysis
        </weave-button>
      </weave-tooltip>
      {triggerErrorMessage && (
        <pre style={{ color: "red", whiteSpace: "normal" }}>
          {t(($) => $.analysis.failedToOrder, { error: triggerErrorMessage })}
        </pre>
      )}
    </div>
  )
}
