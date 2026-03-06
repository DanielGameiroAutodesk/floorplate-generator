import { describe, expect, it } from "vitest"
import { Vector3 } from "three"
import type { Shape } from "src/lib/three/Shape/types"
import { shapeToBasicLine } from "src/lib/three/Shape/shapeUtils"

const asVector3 = (arr: number[]) => new Vector3(...arr)

const openTriangle: Shape = {
  vertices: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
  ].map(asVector3),
  edges: [
    [0, 1],
    [1, 2],
  ],
  loops: [],
}
const oneReversedEdge: Shape = {
  vertices: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
  ].map(asVector3),
  edges: [
    [0, 1],
    [2, 1],
  ],
  loops: [],
}

const missingVertex: Shape = {
  vertices: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
  ].map(asVector3),
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
  ],
  loops: [],
}

const trianglePlusDisconnectedVertex: Shape = {
  vertices: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [2, 2, 0],
  ].map(asVector3),
  edges: [
    [0, 1],
    [1, 2],
  ],
  loops: [],
}

describe("shapeToBasicLine", () => {
  it("can create open lines", () => {
    const line = shapeToBasicLine(openTriangle, undefined, false)
    expect(line.geometry.coordinates).toStrictEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })

  it("can create closed lines", () => {
    const line = shapeToBasicLine(openTriangle, undefined, true)
    expect(line.geometry.coordinates).toStrictEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ])
  })
  it("ignores non-connected vertices", () => {
    const line = shapeToBasicLine(trianglePlusDisconnectedVertex, undefined, false)
    expect(line.geometry.coordinates).toStrictEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })
  it("handles edges in any direction", () => {
    const line = shapeToBasicLine(oneReversedEdge, undefined, false)
    expect(line.geometry.coordinates).toStrictEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })
  it("ignores edges that point to non-existent vertices", () => {
    const line = shapeToBasicLine(missingVertex, undefined, false)
    expect(line.geometry.coordinates).toStrictEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
  })

  it("works on shapes with added points", () => {
    const shp: Shape = {
      vertices: [
        [0, 0, 0],
        [1, 1, 0],
        [2, 2, 0],
        [3, 3, 0],
        [4, 4, 0],
      ].map(asVector3),
      edges: [
        [2, 3],
        [0, 1],
        [1, 4],
        [4, 2],
      ],
      loops: [],
    }

    const line = shapeToBasicLine(shp, undefined, false)
    expect(line.geometry.coordinates.length).toEqual(5)
    expect(line.geometry.coordinates).toStrictEqual([
      [0, 0],
      [1, 1],
      [4, 4],
      [2, 2],
      [3, 3],
    ])
  })
})
