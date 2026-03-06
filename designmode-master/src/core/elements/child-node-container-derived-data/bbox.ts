import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { Matrix4 } from "three"
import { Box2, Box3, Vector2, Vector3 } from "three"
import { raycast } from "src/core/terrain/2d-raytracer"
import {
  createDerivedDataController,
  createParameterizedDerivedDataController,
} from "src/core/elements/derived-data/derived-data"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"

export const bboxController = createParameterizedDerivedDataController(computeBbox)
export const bbox2Controller = createDerivedDataController(computeBbox2d)

function computeBbox(terrainSamplerData: TerrainSamplerData) {
  return function (node: ChildNodeContainer): Box3 | undefined {
    const containerBbox = node.elementContainer.bbox.getOrCompute()
    if (!containerBbox) return undefined

    // Sample z value from bbox corners
    if (containerBbox instanceof Box2) {
      const corners3d = getTransformedBox2Corners(containerBbox, node.globalMatrix).map((vec) =>
        vec.setZ(raycast(vec.x, vec.y, terrainSamplerData)),
      )
      return new Box3().setFromPoints(corners3d)
    }

    return containerBbox?.clone().applyMatrix4(node.globalMatrix)
  }
}

/**
 * 2d variant of the bbox calculation when you only care about xy-posistion, often useful when filtering out data which
 * cannot affect an element.
 *
 * The main advantage over the 3d version is that this is not dependent on terrain
 */
function computeBbox2d(node: ChildNodeContainer) {
  const containerBbox = node.elementContainer.bbox.getOrCompute()
  if (!containerBbox) return undefined

  const corners = getTransformedBox2Corners(containerBbox, node.globalMatrix)
  return new Box2().setFromPoints(corners.map((c) => new Vector2(c.x, c.y)))
}

function getTransformedBox2Corners(box: Box2 | Box3, matrix: Matrix4): Vector3[] {
  return [
    [box.min.x, box.min.y],
    [box.min.x, box.max.y],
    [box.max.x, box.min.y],
    [box.max.x, box.max.y],
  ]
    .map(([x, y]) => new Vector3(x, y, 0))
    .map((vec) => vec.applyMatrix4(matrix))
}
