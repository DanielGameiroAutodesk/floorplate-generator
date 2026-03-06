import { useMemo } from "preact/hooks"

import type { InternalPath } from "src/lib/element/path"
import { useElementColorAPI } from "src/integrations/elements-coloring/ElementColorAPI"

export type AnalysisBuildingColors = { [buildingPath: InternalPath]: string }

export type AnalysisBuildingColorApi = {
  setBuildingColors: (buildingColors: AnalysisBuildingColors) => void
  clearBuildingColors: () => void
}

export enum AnalysisBuildingColorLayer {
  BaseLayer = 0,
  AreaSelection = 10,
}

/**
 * uses analysis color overrides to color elements
 * @param layerZIndex – optional layering to isolate color management from other analysis coloring
 */
export const useAnalysisBuildingColorApi = (
  layerZIndex: AnalysisBuildingColorLayer = AnalysisBuildingColorLayer.BaseLayer,
): AnalysisBuildingColorApi => {
  const elementColorApi = useElementColorAPI(layerZIndex)
  return useMemo(() => {
    return {
      setBuildingColors: (buildingColors: AnalysisBuildingColors) =>
        elementColorApi.setColors(new Map(Object.entries(buildingColors))),
      clearBuildingColors: elementColorApi.clearAll,
    }
  }, [elementColorApi])
}
