import { useRecoilValue } from "recoil"
import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import { Suspense } from "preact/compat"
import { useCallback, useErrorBoundary } from "preact/hooks"
import type { AnalysisGroundTextureApi } from "src/integrations/analyses/Triggers/groundSurrogates/analysis-ground-texture-api"
import { enclosingCircleOfAnalyzeSelectionState } from "src/integrations/analyses/Selection/analysis-selection-state"
import type { AnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import { useAnalysisBuildingColorApi } from "src/integrations/analyses/useAnalysisBuildingColorApi"
import ErrorMessage from "src/integrations/analyses/ErrorMessage"
import { captureException } from "@sentry/browser"
import { analysisColorsOpacityState, showAnalysisColorState } from "src/integrations/analyses/analysis-colors-state"
import type { AnalysisBuildingTooltipApi } from "src/integrations/analyses/BuildingTooltip/useBuildingTooltipApi"
import { useAnalysisBuildingTooltipApi } from "src/integrations/analyses/BuildingTooltip/useBuildingTooltipApi"
import { BuildingTooltip } from "src/integrations/analyses/BuildingTooltip/BuildingTooltip"
import { useGroundTextureAPI } from "src/integrations/ground-texture/GroundTextureAPI"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import type { FormaElement, Urn } from "forma-elements"
import type { VolumeMesh } from "src/core/volume-mesh"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import type { InternalPath } from "src/lib/element/path"
import { resetHighlightedFillSignal, setHighlightedFillArraySignalValue } from "src/core/selection/selectionState"
import { useTranslator } from "src/i18n"
import { scenarioVolumeMeshSignal } from "src/integrations/Scenarios/scenarioElementUploadState"
import { buildScenarioMeshMocks } from "src/integrations/analyses/Triggers/groundSurrogates/utils"

export const WIND_WC_PATH = "/rapid-analyses/forma-rapid-wind/forma-rapid-wind.js?v2"
export const GROUND_TEXTURE_API_ID_RAPID_WIND = "rapid-wind"

type ElementStateAPI = {
  getElement: (urn: Urn) => FormaElement
  getVolumeMesh: (urn: Urn) => VolumeMesh | undefined
  rootUrn: Urn
}

type SelectionAPI = {
  setHighlighted: (paths: InternalPath[]) => void
  resetHighlighted: () => void
}

const selectionApi: SelectionAPI = {
  setHighlighted: (paths) => {
    setHighlightedFillArraySignalValue(paths)
  },
  resetHighlighted: () => {
    resetHighlightedFillSignal()
  },
}

const WindSurrogateWrapper = reactWcWrapper<{
  projectId: string
  elementStateApi: ElementStateAPI
  groundTextureApi: AnalysisGroundTextureApi
  buildingColorApi: AnalysisBuildingColorApi
  buildingTooltipApi: AnalysisBuildingTooltipApi
  selectionApi: SelectionAPI
  getMousePosition: () => { x: number; y: number; z: number }
  enclosingCircleOfSelection?: { x: number; y: number; radius: number } | undefined
  opacity: number
  showAnalysisResult: boolean
}>("forma-rapid-wind")

export const WindSurrogateContent = () => {
  const opacity = useRecoilValue(analysisColorsOpacityState("wind"))
  const enclosingCircleOfSelection = useRecoilValue(enclosingCircleOfAnalyzeSelectionState)

  const buildingColorApi = useAnalysisBuildingColorApi()
  const buildingTooltipApi = useAnalysisBuildingTooltipApi()
  const getTerrainPointAtMousePosition = useCallback(() => {
    const result = raycastApi.raycastTerrain()
    return result ? result.position : { x: 0, y: 0, z: 0 }
  }, [])

  const groundTextureApi = useGroundTextureAPI(GROUND_TEXTURE_API_ID_RAPID_WIND)
  const showAnalysisResult = useRecoilValue(showAnalysisColorState("wind"))

  const elementStateApi = useComputed((): ElementStateAPI => {
    const volumeMesh = scenarioVolumeMeshSignal.value?.volumeMesh
    const proposal = elementState.currentProposalSignal.value
    const {
      rootElement: mockRootElement,
      rootUrn: mockRootUrn,
      scenarioElement: mockScenarioElement,
    } = buildScenarioMeshMocks(proposal.urn, volumeMesh, "wind-root")

    return {
      getElement: (urn: Urn) => {
        if (mockRootElement?.urn === urn) {
          return mockRootElement
        }
        if (mockScenarioElement?.urn === urn) {
          return mockScenarioElement
        }
        return proposal.snapshot.getFormaElementOrThrow(urn)
      },
      getVolumeMesh: (urn: Urn) => {
        if (mockRootUrn === urn) {
          return undefined
        }
        if (mockScenarioElement?.urn === urn) {
          return volumeMesh
        }
        return getVolumeMeshWithTerrainFallback(proposal, urn)
      },
      rootUrn: mockRootUrn ?? proposal.urn,
    }
  }).value

  return (
    <WindSurrogateWrapper
      projectId={PROJECT_ID}
      elementStateApi={elementStateApi}
      groundTextureApi={groundTextureApi}
      buildingColorApi={buildingColorApi}
      buildingTooltipApi={buildingTooltipApi}
      selectionApi={selectionApi}
      getMousePosition={getTerrainPointAtMousePosition}
      enclosingCircleOfSelection={enclosingCircleOfSelection}
      opacity={opacity}
      showAnalysisResult={showAnalysisResult}
    />
  )
}

export const WindSurrogate = () => {
  const t = useTranslator()
  const [error] = useErrorBoundary()

  if (error) {
    console.error(error)
    captureException(error, { level: "error", tags: { owner: "site-analysis" } })
    return <ErrorMessage message={t(($) => $.analysisTooltips.errors.rapidWindUnavailable)} />
  }

  return (
    <Suspense fallback={null}>
      <WindSurrogateContent />
      <BuildingTooltip />
    </Suspense>
  )
}
