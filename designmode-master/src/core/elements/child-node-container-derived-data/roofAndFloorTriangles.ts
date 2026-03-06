import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { Triangle } from "three"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const roofAndFloorTrianglesController = createDerivedDataController(computeRoofAndFloorTriangles)

function computeRoofAndFloorTriangles(node: ChildNodeContainer): Triangle[] {
  const triangles = node.elementContainer.roofAndFloorTriangles.getOrCompute()

  return (
    triangles.map(
      (triangle) =>
        new Triangle(
          triangle.a.clone().applyMatrix4(node.globalMatrix),
          triangle.b.clone().applyMatrix4(node.globalMatrix),
          triangle.c.clone().applyMatrix4(node.globalMatrix),
        ),
    ) ?? []
  )
}
