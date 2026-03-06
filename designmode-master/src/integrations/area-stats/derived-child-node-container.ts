import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { transformMultiRingPolygon } from "./polygon-helpers"
import { applyTransformToHorizontalProjection, type Surface } from "./surface"

export const areaStatsSurfacesController = createDerivedDataController(computeAreaStatsSurfaces)

function computeAreaStatsSurfaces(node: ChildNodeContainer): Surface[] {
  const untransformed = node.elementContainer.areaStatsSurfaces.getOrCompute()
  return untransformed.map((p) => ({
    ...p,
    polygon: transformMultiRingPolygon(p.polygon, node.globalMatrix),
    horizontalProjection: applyTransformToHorizontalProjection(p.horizontalProjection, node.globalMatrix),
  }))
}
