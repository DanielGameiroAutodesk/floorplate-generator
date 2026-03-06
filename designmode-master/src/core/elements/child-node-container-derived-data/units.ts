import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import { transformNormal, transformPosition } from "src/lib/three/transform"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const unitsController = createDerivedDataController(computeUnits)

function computeUnits(node: ChildNodeContainer): BuildingPieceMesh[] | undefined {
  const matrix = node.globalMatrix

  return node.elementContainer.units.getOrCompute()?.map((unit): BuildingPieceMesh => {
    return {
      ...unit,
      geo: {
        position: transformPosition(unit.geo.position, matrix),
        normal: transformNormal(unit.geo.normal, matrix),
      },
    }
  })
}
