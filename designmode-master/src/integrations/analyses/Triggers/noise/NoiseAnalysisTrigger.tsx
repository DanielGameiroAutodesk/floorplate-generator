import { useRecoilValue } from "recoil"
import {
  activeSelectableAreasState,
  areaSelectionOpenState,
  enclosingCircleOfAnalyzeSelectionState,
} from "src/integrations/analyses/Selection/analysis-selection-state"
import { useAnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { SELECTED_FOR_ANALYSIS_COLOR } from "src/integrations/analyses/Triggers/constants"
import {
  selectedCenterState,
  useSelectedElementPaths,
} from "src/integrations/analyses/Selection/useSelectedElementPaths"
import {
  getDelocalisedRadius,
  getLocalisedRadius,
  useDisplayRadiusCircle,
} from "src/integrations/analyses/Triggers/wind/DetailedWindAnalysisTrigger"
import { useCallback, useMemo, useState } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { proposalIdSignal } from "src/core/proposal"
import { useIsImperial } from "src/lib/unitSettings"
import { AnalysisTrigger } from "./components/AnalysisTrigger"
import { useTranslator } from "src/i18n"

const DEFAULT_RADIUS = "100"
const SELECTED_CIRCLE_RADIUS_STORAGE_KEY = "forma-selected-noise-circle-detailed-radius"
const DISPLAY_NOISE_CIRCLE_KEY = "noiseRadius"

type NoiseAnalysisTriggerProps = {
  radius?: number
  showSlider?: boolean
}

export const NoiseAnalysisTrigger = ({ radius: externalRadius, showSlider = true }: NoiseAnalysisTriggerProps = {}) => {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshot.value
  const areaSelectionOpen = useRecoilValue(areaSelectionOpenState)
  const { selectedElementPaths, colorElementPaths } = useSelectedElementPaths()
  const { setBuildingColors, clearBuildingColors } = useAnalysisBuildingColorApi()
  const selectedCenter = useRecoilValue(selectedCenterState)
  const activeSelectableAreas = useRecoilValue(activeSelectableAreasState(proposalIdSignal.value))
  const enclosingCircleOfSelection = useRecoilValue(enclosingCircleOfAnalyzeSelectionState)
  const isImperial = useIsImperial()
  const [internalRadius, setInternalRadius] = useState(
    Number(sessionStorage.getItem(SELECTED_CIRCLE_RADIUS_STORAGE_KEY) || DEFAULT_RADIUS),
  )

  // Use external radius if provided, otherwise use internal radius
  const radius = externalRadius !== undefined ? externalRadius : internalRadius

  const colored = Object.fromEntries(colorElementPaths.map((path) => [path, SELECTED_FOR_ANALYSIS_COLOR]))

  const centerWithRadius = useMemo(() => {
    if (!activeSelectableAreas.size && selectedCenter) return { ...selectedCenter, radius }
    if (enclosingCircleOfSelection) return { ...enclosingCircleOfSelection, radius }
    return { x: 0, y: 0, radius }
  }, [activeSelectableAreas.size, enclosingCircleOfSelection, radius, selectedCenter])

  const updateRadius = useCallback(
    (e: CustomEvent<string>) => {
      const radius = getDelocalisedRadius(Number(e.detail), isImperial)
      setInternalRadius(radius)
      sessionStorage.setItem(SELECTED_CIRCLE_RADIUS_STORAGE_KEY, String(radius))
    },
    [setInternalRadius, isImperial],
  )

  useDisplayRadiusCircle(centerWithRadius, DISPLAY_NOISE_CIRCLE_KEY)

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {showSlider && (
        <>
          <div
            style={{ display: "flex", font: "var(--11-medium)", justifyContent: "space-between", lineHeight: "24px" }}
          >
            <span>{t(($) => $.analysis.noiseAreaRadius)}</span>
            <span>{getLocalisedRadius(radius, isImperial) + (isImperial ? " ft" : " m")} </span>
          </div>
          <div style={{ padding: "6px 0" }}>
            <weave-slider
              max={isImperial ? "1000" : "350"}
              min={isImperial ? "350" : "100"}
              label={t(($) => $.analysis.properties.radiusLabel)}
              value={`${getLocalisedRadius(radius, isImperial)}`}
              onChange={updateRadius}
              onInput={updateRadius}
            />
          </div>
        </>
      )}
      <AnalysisTrigger
        disabled={!snapshot.isPersisted}
        tooltip={!snapshot.isPersisted ? t(($) => $.tooltips.analyses.savingInProgress) : undefined}
        rootElementUrn={snapshot.rootUrn}
        selectedElementPaths={selectedElementPaths}
        customCircle={!activeSelectableAreas.size ? centerWithRadius : undefined}
        onTriggerButtonMouseOver={() => {
          setBuildingColors(colored)
        }}
        onTriggerButtonMouseLeave={() => {
          if (!areaSelectionOpen) {
            clearBuildingColors()
          }
        }}
      />
    </div>
  )
}
