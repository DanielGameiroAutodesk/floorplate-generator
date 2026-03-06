import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { BufferGeometry, TypedArray } from "three"
import { Triangle, Vector3 } from "three"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const roofAndFloorTrianglesController = createDerivedDataController(computeRoofAndFloorTriangles)

function computeRoofAndFloorTriangles(container: ElementContainer): Triangle[] {
  const volumeMesh = container.representations.volumeMesh
  if (!volumeMesh) return []

  return createTrianglesForBufferGeometry(volumeMesh)
}

function createTrianglesForBufferGeometry(geo: BufferGeometry): Triangle[] {
  const position = geo.getAttribute("position")
  const index = geo.getIndex()
  const normal = geo.getAttribute("normal")

  if (position.count > 10_000) return []

  const triangles = []
  if (!index) {
    for (let i = 0; i < position.count; i += 3) {
      const triangle = createAndTransformTriangleIfHorizontal(position.array, normal.array, i, i + 1, i + 2)
      if (triangle) triangles.push(triangle)
    }
  } else {
    for (let i = 0; i < index.array.length; i += 3) {
      const triangle = createAndTransformTriangleIfHorizontal(
        position.array,
        normal.array,
        index.array[i],
        index.array[i + 1],
        index.array[i + 2],
      )
      if (triangle) triangles.push(triangle)
    }
  }
  return triangles
}

const errorMargin = 0.01
function createAndTransformTriangleIfHorizontal(
  position: TypedArray,
  normal: TypedArray,
  v1: number,
  v2: number,
  v3: number,
) {
  const isHorizontal = Math.abs(Math.abs(normal[v1 * 3 + 2]) - 1) < errorMargin
  if (isHorizontal) {
    return new Triangle(
      new Vector3(position[v1 * 3], position[v1 * 3 + 1], position[v1 * 3 + 2]),
      new Vector3(position[v2 * 3], position[v2 * 3 + 1], position[v2 * 3 + 2]),
      new Vector3(position[v3 * 3], position[v3 * 3 + 1], position[v3 * 3 + 2]),
    )
  }
}
