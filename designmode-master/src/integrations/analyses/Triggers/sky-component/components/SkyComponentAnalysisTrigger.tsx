import { useCallback, useMemo, useState } from "preact/hooks"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { getTranslator, useTranslator } from "src/i18n"
import {
  triggerAnalysis,
  createAnalysisUrl,
  type TriggerAnalysisParams,
} from "src/integrations/analyses/Triggers/sky-component/services/analysis-service"
import { captureException } from "@sentry/browser"
import { InfoBox } from "./InfoBox"
import { elementState } from "src/core/elements/ElementState"
import { useSelectedElementPaths } from "src/integrations/analyses/Selection/useSelectedElementPaths"
import {
  dispatchIsLoadingEvent,
  dispatchOpenAreaSelectEvent,
  addToast,
} from "src/integrations/analyses/Triggers/analysis-events"
import { proposalHas3DGeometrySignal } from "src/integrations/analyses/Triggers/trigger-utils"

interface Props {
  disabled: boolean
  tooltip?: string
  onTriggerButtonMouseOver?: (event: Event) => void
  onTriggerButtonMouseLeave?: (event: Event) => void
}

export function SkyComponentAnalysisTrigger({
  disabled,
  tooltip,
  onTriggerButtonMouseOver,
  onTriggerButtonMouseLeave,
}: Props) {
  const snapshot = elementState.currentSnapshot.value
  const rootElementUrn = snapshot.rootUrn
  const { selectedElementPaths } = useSelectedElementPaths()

  const has3Dgeometry = proposalHas3DGeometrySignal.value

  const [hasAreaSelectHint, setHasAreaSelectHint] = useState(false)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerErrorMessage, setTriggerErrorMessage] = useState<string>("")

  const inputParams = useMemo<Partial<TriggerAnalysisParams>>(() => {
    return {
      selectedElementPaths: selectedElementPaths.length ? selectedElementPaths : [],
    }
  }, [selectedElementPaths])

  const validParams = useMemo(() => {
    if (inputParams.selectedElementPaths?.length) {
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
    if (!validParams && hasAreaSelectHint) {
      return {
        disabled: true,
        disabledText: t(($) => $.analysis.disabledTooltips.selectSiteLimitOrZone),
      }
    }
    return { disabled: false, disabledText: "" }
  }, [disabled, tooltip, hasEditorAccess, triggerLoading, validParams, hasAreaSelectHint, t])

  const buttonOnClickHandler = useCallback(() => {
    void (async () => {
      if (!validParams && !hasAreaSelectHint) {
        setHasAreaSelectHint(true)
        dispatchOpenAreaSelectEvent()
        return
      }
      if (buttonDisabled.disabled) return
      if (!validParams) return

      setTriggerLoading(true)
      setTriggerErrorMessage("")

      dispatchIsLoadingEvent("sky-component", true)

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
            analysis_type: "sky-component",
            has_3d_geometry: has3Dgeometry,
          },
        )

        const analysis = await triggerAnalysis(rootElementUrn, validParams)
        if (analysis?.status !== "IN_PROGRESS") {
          dispatchIsLoadingEvent("sky-component", false)
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
        dispatchIsLoadingEvent("sky-component", false)
        console.warn("Failed to trigger analysis:", err)
        setTriggerErrorMessage(err instanceof Error ? err.message : String(err))
        captureException(err)
      } finally {
        setTriggerLoading(false)
      }
    })()
  }, [buttonDisabled, validParams, rootElementUrn, hasAreaSelectHint, has3Dgeometry])

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <InfoBox />
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
      {triggerErrorMessage && <pre style={{ color: "red", whiteSpace: "normal" }}>{triggerErrorMessage}</pre>}
    </div>
  )
}
