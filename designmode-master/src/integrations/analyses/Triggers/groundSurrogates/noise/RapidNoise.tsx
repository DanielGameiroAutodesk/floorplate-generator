import type { SetterOrUpdater } from "recoil"
import { useRecoilValue } from "recoil"
import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import { Suspense } from "preact/compat"
import useLazyLoadScriptWithError from "src/lib/useLazyLoadScript"
import { useErrorBoundary, useMemo } from "preact/hooks"
import { useAnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { useAnalysisBuildingTooltipApi } from "src/integrations/analyses/BuildingTooltip/useBuildingTooltipApi"
import { analysisColorsOpacityState, showAnalysisColorState } from "src/integrations/analyses/analysis-colors-state"
import {
  activeSelectableAreasState,
  enclosingCircleOfAnalyzeSelectionState,
} from "src/integrations/analyses/Selection/analysis-selection-state"
import { BuildingTooltip } from "src/integrations/analyses/BuildingTooltip/BuildingTooltip"
import { useGroundTextureAPI } from "src/integrations/ground-texture/GroundTextureAPI"
import { useTranslator } from "src/i18n"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import type { Position } from "src/integrations/analyses/Triggers/groundSurrogates/analysis-ground-texture-api"
import type { FormaElement, Urn } from "forma-elements"
import type { VolumeMesh } from "src/core/volume-mesh"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"
import { PROJECT_ID } from "src/core/project/project"
import { resetHighlightedFillSignal, setHoveredIdsArraySignalValue } from "src/core/selection/selectionState"
import { proposalIdSignal } from "src/core/proposal"
import { scenarioVolumeMeshSignal } from "src/integrations/Scenarios/scenarioElementUploadState"
import { buildScenarioMeshMocks } from "src/integrations/analyses/Triggers/groundSurrogates/utils"

const RAPID_NOISE_WC_PATH = "/rapid-analyses/forma-rapid-noise/forma-rapid-noise.js?v2"
export const GROUND_TEXTURE_API_ID_RAPID_NOISE = "rapid-noise"

const RapidNoiseWrapper = reactWcWrapper<{
  enclosingCircleOfSelection: { x: number; y: number; radius: number } | undefined
  opacity: number
  showAnalysisResult: boolean
  projectId: string
  rootUrn: Urn
  setBuildingColors: (buildingColors: { [buildingPath: string]: string }) => void
  clearBuildingColors: () => void
  setBuildingTooltips: (buildingTooltips: { [buildingPath: string]: string }) => void
  clearBuildingTooltips: () => void
  getMousePosition: () => { x: number; y: number; z: number }
  getElement: (urn: Urn) => FormaElement | undefined
  getIsUrnPersisted: (urn: Urn) => boolean
  getVolumeMesh: (urn: Urn) => VolumeMesh | undefined
  addGroundTexture: (name: string, canvas: HTMLCanvasElement, position: Position) => void
  updatePositionGroundTexture: (name: string, position: Position) => void
  updateTextureDataGroundTexture: (name: string, canvas: HTMLCanvasElement) => void
  removeGroundTexture: (name: string) => void
  setHighlighted: SetterOrUpdater<string[]>
  resetHighlighted: () => void
  activeSelectableAreas: string[]
}>("forma-rapid-noise")

export const RapidNoiseContent = () => {
  const opacity = useRecoilValue(analysisColorsOpacityState("noise"))
  const enclosingCircleOfSelection = useRecoilValue(enclosingCircleOfAnalyzeSelectionState)
  const buildingColorApi = useAnalysisBuildingColorApi()
  const buildingTooltipApi = useAnalysisBuildingTooltipApi()
  const getTerrainPointAtMousePosition = useMemo(
    () => () => {
      const result = raycastApi.raycastTerrain()
      return result ? result.position : { x: 0, y: 0, z: 0 }
    },
    [],
  )
  const showAnalysisResult = useRecoilValue(showAnalysisColorState("noise"))
  const groundTextureApi = useGroundTextureAPI(GROUND_TEXTURE_API_ID_RAPID_NOISE)
  const activeSelectableAreas = useRecoilValue(activeSelectableAreasState(proposalIdSignal.value))

  const mocksSignal = useComputed(() => {
    const volumeMesh = scenarioVolumeMeshSignal.value?.volumeMesh
    const proposal = elementState.currentProposalSignal.value
    return buildScenarioMeshMocks(proposal.urn, volumeMesh, "rapid-noise-root")
  })

  const rootUrn = useComputed(() => {
    const snapshot = elementState.currentSnapshot.value
    return mocksSignal.value.rootUrn ?? snapshot.rootUrn
  }).value

  const getElement = useComputed(() => {
    const { rootElement, scenarioElement } = mocksSignal.value
    const snapshot = elementState.currentSnapshot.value
    return (urn: Urn) => {
      if (rootElement?.urn === urn) return rootElement
      if (scenarioElement?.urn === urn) return scenarioElement
      return snapshot.getFormaElement(urn)
    }
  }).value

  const getIsUrnPersisted = useComputed(() => {
    const { rootUrn: mockRootUrn, scenarioElement } = mocksSignal.value
    const snapshot = elementState.currentSnapshot.value
    const proposalUrn = elementState.currentProposalSignal.value.urn
    return (urn: Urn) => {
      if (mockRootUrn === urn) {
        // Mock root inherits readiness of proposal
        return snapshot.getElementContainer(proposalUrn)?.isServerState ?? false
      }
      if (scenarioElement?.urn === urn) return true
      return snapshot.getElementContainer(urn)?.isServerState ?? false
    }
  }).value

  const getVolumeMesh = useComputed(() => {
    const volumeMesh = scenarioVolumeMeshSignal.value?.volumeMesh
    const { rootUrn: mockRootUrn, scenarioElement } = mocksSignal.value
    const proposal = elementState.currentProposalSignal.value
    return (urn: Urn) => {
      if (mockRootUrn === urn) return undefined
      if (scenarioElement?.urn === urn) return volumeMesh
      return getVolumeMeshWithTerrainFallback(proposal, urn)
    }
  }).value

  return (
    <RapidNoiseWrapper
      enclosingCircleOfSelection={enclosingCircleOfSelection}
      opacity={opacity}
      showAnalysisResult={showAnalysisResult}
      projectId={PROJECT_ID}
      rootUrn={rootUrn}
      setBuildingColors={buildingColorApi.setBuildingColors}
      clearBuildingColors={buildingColorApi.clearBuildingColors}
      setBuildingTooltips={buildingTooltipApi.setBuildingTooltips}
      clearBuildingTooltips={buildingTooltipApi.clearBuildingTooltips}
      getMousePosition={getTerrainPointAtMousePosition}
      getElement={getElement}
      getIsUrnPersisted={getIsUrnPersisted}
      getVolumeMesh={getVolumeMesh}
      addGroundTexture={groundTextureApi.add}
      updatePositionGroundTexture={groundTextureApi.updatePosition}
      updateTextureDataGroundTexture={groundTextureApi.updateTextureData}
      removeGroundTexture={groundTextureApi.remove}
      setHighlighted={setHoveredIdsArraySignalValue}
      resetHighlighted={resetHighlightedFillSignal}
      activeSelectableAreas={Array.from(activeSelectableAreas)}
    />
  )
}

export const RapidNoise = () => {
  const t = useTranslator()
  useLazyLoadScriptWithError(RAPID_NOISE_WC_PATH, "analyze-noise")
  const [error] = useErrorBoundary()
  if (error) {
    console.error(error)
    return (
      <div>
        <div>{t(($) => $.analysis.noisePredictionUnavailable)}</div>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <div>
        <RapidNoiseContent />
        <BuildingTooltip />
      </div>
    </Suspense>
  )
}
