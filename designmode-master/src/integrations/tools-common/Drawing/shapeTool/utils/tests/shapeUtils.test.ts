import { describe, expect, test } from "vitest"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { Vector3 } from "three"
import type { Shape } from "src/lib/three/Shape/types"

const v0 = new Vector3(0, 0, 0)
const v1 = new Vector3(1, 0, 0)
const v2 = new Vector3(1, 1, 0)
const v3 = new Vector3(0, 1, 0)
const v4 = new Vector3(-1, 0, 0)
const BASIC_QUAD: Shape = {
  vertices: [v0, v1, v2, v3],
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
  ],
  loops: [[0, 1, 2, 3]],
}
const SINGLE_TRIANGLE: Shape = {
  vertices: [v0, v3, v4],
  edges: [
    [0, 1],
    [1, 2],
    [2, 0],
  ],
  loops: [[0, 1, 2]],
}

describe("removeVertex", () => {
  const newQuad = ShapeUtils.removeVertex(BASIC_QUAD, 1)
  const newTri = ShapeUtils.removeVertex(SINGLE_TRIANGLE, 1)
  test("leaves an undefined entry in place of the deleted vertex", () => {
    expect(newQuad.vertices).toEqual([v0, undefined, v2, v3])
  })
  test("collapses edges", () => {
    expect(newQuad.edges).toEqual([undefined, [0, 2], [2, 3], [3, 0]])
  })
  test("updates loops", () => {
    expect(newQuad.loops).toEqual([[1, 2, 3]])
  })

  test("keeps kinks", () => {
    expect(newTri.edges).toEqual([undefined, [0, 2], [2, 0]])
  })
  test("removes degenerate loops", () => {
    expect(newTri.loops).toEqual([undefined])
  })
})

describe("translateVertices", () => {
  const newShape = ShapeUtils.translateVertices(BASIC_QUAD, [0], new Vector3(0, 1, 0), true)
  test("deletes overlapped vertices", () => {
    expect(newShape.vertices).toEqual([v3, v1, v2, undefined])
  })
  test("collapses edges", () => {
    expect(newShape.edges).toEqual([[0, 1], [1, 2], [2, 0], undefined])
  })
  test("updates loops", () => {
    expect(newShape.loops).toEqual([[0, 1, 2]])
  })
})

describe("addPointOnEdge", () => {
  let v5 = new Vector3(0, 0.5, 0)
  const newShape = ShapeUtils.addPointOnEdge(BASIC_QUAD, 3, v5)
  test("adds vertex", () => {
    expect(newShape.vertices).toEqual([v0, v1, v2, v3, v5])
  })
  test("splites edge", () => {
    expect(newShape.edges).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
    ])
  })
  test("updates loops", () => {
    expect(newShape.loops).toEqual([[0, 1, 2, 3, 4]])
  })
})

describe("pruneEditedShape", () => {
  const shape = ShapeUtils.pruneEditedShape(ShapeUtils.removeVertex(BASIC_QUAD, 1))

  test("all vertices kept and in order", () => {
    expect(shape.vertices).toEqual([v0, v2, v3])
  })

  test("edges pruned and pointing to correct vertices", () => {
    expect(shape.edges).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ])
  })
  test("loops pruned and pointing to correct edges", () => {
    expect(shape.loops).toEqual([[0, 1, 2]])
  })
})
describe("addShape", () => {
  const shape = ShapeUtils.addShape(BASIC_QUAD, SINGLE_TRIANGLE)

  test("duplicate vertices are removed", () => {
    expect(shape.vertices).toEqual([v0, v1, v2, v3, v4])
  })
  test("overlapping edges are merged", () => {
    expect(shape.edges).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 0],
    ])
  })
  test("loops are kept", () => {
    expect(shape.loops).toEqual([
      [0, 1, 2, 3],
      [3, 4, 5],
    ])
  })
})
