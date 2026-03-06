import { atom, useRecoilState, useRecoilValue } from "recoil"
import type { Child, FormaElement } from "@spacemakerai/element-types"
import type { Circle } from "./analysis-selection-state"
import {
  activeSelectableAreasState,
  DefaultArea,
  defaultAreaSelectedState,
  selectableAreasSignal,
} from "./analysis-selection-state"
import { useEffect, useMemo } from "preact/hooks"
import { activeAnalysisSignal } from "src/integrations/analyses/analysis-state"
import type { AnalysisSelectionAPI } from "src/integrations/analysis-selection/AnalysisSelectionAPI"
import { useAnalysisSelectionAPI } from "src/integrations/analysis-selection/AnalysisSelectionAPI"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import { proposalIdSignal } from "src/core/proposal"
import { scenarioChildNodesSignal } from "src/integrations/Scenarios/scenarioElementUploadState"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"

export const ANALYSIS_TYPES_SUPPORTING_SCENARIO_CHILD_NODES = ["sun"]

const selectedElementPathsState = atom<string[]>({
  key: "useSelectedElementPaths/selectedElementPathsState",
  default: [],
})

const colorElementPathsState = atom<string[]>({
  key: "useSelectedElementPaths/colorElementPathsState",
  default: [],
})

export const selectedCenterState = atom<Circle>({
  key: "useSelectedElementPaths/selectedCenterState",
  default: undefined,
})

const createElementsWithinAreaCache = (() => {
  let currentCacheId = ""
  const cache = new Map<string, string[]>()
  return (cacheId: string) => {
    if (cacheId !== currentCacheId) cache.clear()
    currentCacheId = cacheId
    return cache
  }
})()

const customCirclePolygon = (center: [number, number], radius: number) => {
  const numSegments = 32
  const coordinates: [number, number][] = []
  for (let i = 0; i < numSegments + 1; i++) {
    // Use 0 as final index to avoid numerical discrepancies between first and last point.
    // Otherwise the polygon might not be correctly closed due to first and last points not matching exactly,
    // which causes an error when creating turf geometry (here: https://github.com/spacemakerai/designmode/blob/26cd95c5c13604b04147c3a5c3036fe736582a5a/src/api/AnalysisSelectionAPI.ts#L178)
    const angle = (2 * Math.PI * (i % numSegments)) / numSegments
    const x = center[0] + radius * Math.cos(angle)
    const y = center[1] + radius * Math.sin(angle)
    coordinates.push([x, y])
  }

  return coordinates
}

const filterInvalidCategoriesMethod = (elementSnapshot: ElementSnapshot) => (nodePath: string) => {
  const category = elementSnapshot.getNode(nodePath)?.elementContainer.element.properties?.category
  // No category is considered equivalent to "generic"
  if (!category) return true
  return !["site_limit", "zone"].includes(category)
}

export const getCircleSelectedElementPaths = (
  circle: Circle,
  elementSnapshot: ElementSnapshot,
  analysisSelectionAPI: AnalysisSelectionAPI,
  scenarioChildNodes?: ChildNodeContainer[],
) => {
  const filterInvalidCategories = filterInvalidCategoriesMethod(elementSnapshot)
  const polygons = [customCirclePolygon([circle.x, circle.y], circle.radius)]
  return analysisSelectionAPI.getTopLevelElementsInsidePolygons(polygons, {
    includeSubtree: filterInvalidCategories,
    scenarioChildNodes,
  })
}

export function useSelectedElementPaths() {
  // colorElementPaths = paths we should highlight in scene
  const [colorElementPaths, setColorElementPaths] = useRecoilState(colorElementPathsState)
  // selectedElementPaths = paths we should send to backends for analysis
  const [selectedElementPaths, setSelectedElementPathsState] = useRecoilState(selectedElementPathsState)
  const allSelectableAreas = selectableAreasSignal.value
  const analysisSelectionAPI = useAnalysisSelectionAPI()
  const activeAnalysis = activeAnalysisSignal.value
  const activeSelectableAreas = useRecoilValue(activeSelectableAreasState(proposalIdSignal.value))
  const defaultAreaSelected = useRecoilValue(defaultAreaSelectedState(proposalIdSignal.value))
  const [selectedCenter, setSelectedCenter] = useRecoilState(selectedCenterState)
  const elementSnapshot = elementState.currentSnapshot.value

  const includeScenarioElements = !!(
    activeAnalysis && ANALYSIS_TYPES_SUPPORTING_SCENARIO_CHILD_NODES.includes(activeAnalysis)
  )
  const scenarioChildNodesSignalValue = scenarioChildNodesSignal.value
  const scenarioChildNodes = useMemo(
    () => (includeScenarioElements ? scenarioChildNodesSignalValue : undefined),
    [includeScenarioElements, scenarioChildNodesSignalValue],
  )

  const elementsInPolygonCache = useMemo(() => {
    if (scenarioChildNodes && scenarioChildNodes.length > 0) {
      return createElementsWithinAreaCache(
        `${elementSnapshot.rootUrn}_${scenarioChildNodes.map((c) => c.path).join("_")}`,
      )
    } else {
      return createElementsWithinAreaCache(elementSnapshot.rootUrn)
    }
  }, [elementSnapshot.rootUrn, scenarioChildNodes])

  useEffect(() => {
    const updateSelectedCenter = (storageKey: string) => () => {
      const item = sessionStorage.getItem(storageKey)
      if (item !== null) {
        const center: Circle = JSON.parse(item)
        setSelectedCenter(center)
      }
    }
    const analysesWithCustomCenter = {
      "rapid-wind": {
        eventKey: "forma-selected-wind-circle-updated",
        handler: updateSelectedCenter("forma-selected-wind-circle"),
      },
      "rapid-noise": {
        eventKey: "forma-selected-noise-circle-updated",
        handler: updateSelectedCenter("forma-selected-noise-circle"),
      },
      microclimate: {
        eventKey: "forma-selected-microclimate-circle-updated",
        handler: updateSelectedCenter("forma-selected-microclimate-circle"),
      },
    }
    if (defaultAreaSelected === DefaultArea.CustomCircle) {
      Object.values(analysesWithCustomCenter).map(({ eventKey, handler }) => {
        window.addEventListener(eventKey, handler)
      })
    } else {
      Object.values(analysesWithCustomCenter).map(({ eventKey, handler }) => {
        window.removeEventListener(eventKey, handler)
      })
    }

    return () => {
      Object.values(analysesWithCustomCenter).map(({ eventKey, handler }) => {
        window.removeEventListener(eventKey, handler)
      })
    }
  }, [defaultAreaSelected, setSelectedCenter])

  useEffect(() => {
    let newColorElementPaths
    let newSelectedElementPaths

    const filterInvalidCategories = filterInvalidCategoriesMethod(elementSnapshot)

    if (defaultAreaSelected === DefaultArea.EntireSite) {
      // No areas available for selection, color all "analyzeable" elements
      newColorElementPaths = getAllAnalyzeableElements(elementSnapshot, scenarioChildNodes)
      newSelectedElementPaths = ["root"]
    } else if (defaultAreaSelected === DefaultArea.CustomCircle && selectedCenter) {
      const elementPaths = getCircleSelectedElementPaths(
        selectedCenter,
        elementSnapshot,
        analysisSelectionAPI,
        scenarioChildNodes,
      )
      newSelectedElementPaths = elementPaths
      newColorElementPaths = elementPaths
    } else {
      const activeSelectableAreaPaths = Array.from(activeSelectableAreas)
      const cacheKey = activeSelectableAreaPaths.sort().join("-")
      const selectedElementPaths = elementsInPolygonCache.get(cacheKey)
      if (selectedElementPaths) {
        newSelectedElementPaths = selectedElementPaths
        newColorElementPaths = selectedElementPaths
      } else {
        const selectableAreas = allSelectableAreas.filter((a) => activeSelectableAreas.has(a.path))
        const elementPaths = analysisSelectionAPI.getTopLevelElementsInsideFootprints(
          selectableAreas.map((a) => a.path),
          {
            includeSubtree: filterInvalidCategories,
            scenarioChildNodes,
          },
        )
        newSelectedElementPaths = activeSelectableAreaPaths.concat(elementPaths)
        elementsInPolygonCache.set(cacheKey, newSelectedElementPaths)
        newColorElementPaths = newSelectedElementPaths
      }
    }
    setColorElementPaths(newColorElementPaths)
    setSelectedElementPathsState(newSelectedElementPaths)
  }, [
    activeAnalysis,
    activeSelectableAreas,
    allSelectableAreas,
    analysisSelectionAPI,
    defaultAreaSelected,
    elementSnapshot,
    elementsInPolygonCache,
    selectedCenter,
    setColorElementPaths,
    setSelectedElementPathsState,
    scenarioChildNodes,
  ])
  return { colorElementPaths, selectedElementPaths }
}

export function getAllAnalyzeableElements(elementSnapshot: ElementSnapshot, scenarioChildNodes?: ChildNodeContainer[]) {
  const paths: Set<string> = new Set()

  function isAnalyzeable(element: FormaElement) {
    if (element.properties?.virtual) return false
    if (element.properties?.category === "vegetation") return false
    return true
  }

  function traverse(parentKey: string, node: Child) {
    const element = elementSnapshot.getFormaElement(node.urn)
    if (!element) return
    if (!isAnalyzeable(element)) return
    paths.add(`${parentKey}/${node.key}`)
    element.children?.forEach((c) => traverse(`${parentKey}/${node.key}`, c))
  }

  elementSnapshot.getNode("root")?.elementContainer.element.children?.forEach((c) => traverse("root", c))

  const scenarioChildNodesPaths = scenarioChildNodes?.map((c) => c.path) ?? []

  return Array.from(paths).concat(scenarioChildNodesPaths)
}
