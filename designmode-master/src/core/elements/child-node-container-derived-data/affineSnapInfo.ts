import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { AffineSnap } from "src/integrations/snapping/snapping"
import { getAffineSnapFromSnappingLines } from "src/integrations/snapping/snapping"
import { createParameterizedDerivedDataController } from "src/core/elements/derived-data/derived-data"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"

export const affineSnapInfoController = createParameterizedDerivedDataController(createAffineSnapInfo)

function createAffineSnapInfo(terrainSamplerData: TerrainSamplerData) {
  return function (node: ChildNodeContainer): AffineSnap {
    const snappingLines = node.snappingLines(terrainSamplerData).getOrCompute()
    return getAffineSnapFromSnappingLines(snappingLines, node.path)
  }
}
