import type { SplitablePolygon } from "src/integrations/tools-common/shapeTransformTools/Split/logic/PolygonSplitUtils"
import { splitPolygon } from "src/integrations/tools-common/shapeTransformTools/Split/logic/PolygonSplitUtils"
import { Vector3 } from "three"
import { describe, expect, test as it } from "vitest"

describe("splitPolygon", () => {
  it("splits into two polygons for complex, contained line", () => {
    const poly: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(3, -1), new Vector3(6, 2), new Vector3(4, 6), new Vector3(-1, 1)]
    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(2)
    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 6, y: 2 },
        { x: 4, y: 6 },
        { x: 0, y: 2 },
        { x: 0, y: 0 },
      ]),
    )

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 4, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 2 },
        { x: 4, y: 6 },
        { x: 6, y: 2 },
        { x: 4, y: 0 },
      ]),
    )
  })

  it("returns same polygon if line doesn't slice", () => {
    const poly: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(20, 20), new Vector3(20, 21)]
    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(1)
    expect(split).toContainEqual(expect.arrayContaining(poly))
  })

  it("splits square sliced with an 'N' cut into ", () => {
    const poly: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(2, -2), new Vector3(2, 12), new Vector3(7, 7), new Vector3(7, 12)]
    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(3)
    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ]),
    )

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 2, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 7, y: 10 },
        { x: 7, y: 7 },
        { x: 4, y: 10 },
        { x: 2, y: 10 },
        { x: 2, y: 0 },
      ]),
    )

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 7, y: 10 },
        { x: 4, y: 10 },
        { x: 7, y: 7 },
        { x: 7, y: 10 },
      ]),
    )
  })

  it("splits concave polygon along simple line ", () => {
    const poly: SplitablePolygon = [
      new Vector3(0, 0),
      new Vector3(4, 0),
      new Vector3(4, 4),
      new Vector3(2, 2),
      new Vector3(0, 4),
      new Vector3(0, 0),
    ]

    const splitLine = [new Vector3(-1, 3), new Vector3(5, 3)]
    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(3)

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 3 },
        { x: 1, y: 3 },
        { x: 0, y: 4 },
      ]),
    )
  })

  it("splits concave polygon along complex line ", () => {
    const poly: SplitablePolygon = [
      new Vector3(0, 0),
      new Vector3(4, 0),
      new Vector3(4, 4),
      new Vector3(2, 2),
      new Vector3(0, 4),
      new Vector3(0, 0),
    ]

    const splitLine = [new Vector3(-1, 3), new Vector3(5, 3), new Vector3(3, 1), new Vector3(1, 1), new Vector3(1, -2)]
    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(4)

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 3 },
        { x: 1, y: 3 },
        { x: 0, y: 4 },
      ]),
    )
  })

  it("handles split lines that go through vertices", () => {
    const poly: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(-1, -1), new Vector3(11, 11)]

    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(2)

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    )

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
      ]),
    )
  })
  it("handles split lines that start at polygon vertex", () => {
    const poly: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(0, 0), new Vector3(10, 10)]

    const split = splitPolygon(poly, splitLine)
    expect(split.length).toEqual(2)

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    )

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
      ]),
    )
  })

  it("splits huge polygon with huge line", () => {
    const poly: SplitablePolygon = []

    const numPoints = 300
    const radius = 25
    for (let i = 0; i < numPoints; i++) {
      const rad = (i * (2 * Math.PI)) / numPoints
      const x = Math.round(Math.cos(rad) * radius)
      const y = Math.round(Math.sin(rad) * radius)
      const vec = new Vector3(x, y)
      poly.push(vec)
    }

    const zigzags = 25
    const splitLine: Vector3[] = []
    const yIncrement = (2 * radius) / (zigzags + 1)
    const startY = -radius
    for (let sl = 0; sl < zigzags; sl++) {
      splitLine.push(
        new Vector3(-radius * 2, startY + sl * yIncrement),
        new Vector3(radius * 2, startY + sl * yIncrement),
      )
    }

    const split = splitPolygon(poly, splitLine)

    expect(split.length).toEqual(zigzags * 2 - 1)
  })

  it("handles splits at decimal coordinates", () => {
    const size = 1
    const poly: SplitablePolygon = [
      new Vector3(0, 0),
      new Vector3(size, 0),
      new Vector3(size, size),
      new Vector3(0, size),
    ]

    const cutAt = size / 3.22
    const splitLine = [new Vector3(cutAt, -1), new Vector3(cutAt, size + 1)]

    const split = splitPolygon(poly, splitLine)
    expect(split.length).toEqual(2)
  })

  it("splits lines corectly", () => {
    const line: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0)]

    const cutAt = 3
    const splitLine = [new Vector3(cutAt, -1), new Vector3(cutAt, 1)]

    const split = splitPolygon(line, splitLine, true)
    expect(split.length).toEqual(2)

    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ]),
    )
    expect(split).toContainEqual(
      expect.arrayContaining([
        { x: 3, y: 0 },
        { x: 10, y: 0 },
      ]),
    )
  })

  it("handles split lines that overlap with edges of polygon", () => {
    const line: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(1, -1), new Vector3(1, 0), new Vector3(3, 0), new Vector3(3, 11)]

    const split = splitPolygon(line, splitLine, false)
    expect(split.length).toEqual(2)

    expect(split).toEqual([
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 10 },
        { x: 0, y: 10 },
      ]),
      expect.arrayContaining([
        { x: 3, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 3, y: 10 },
      ]),
    ])
  })

  it("handles split lines with corner on polygon edge", () => {
    const line: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(1, 0), new Vector3(5, 10), new Vector3(9, 0)]

    const split = splitPolygon(line, splitLine, false)
    expect(split.length).toEqual(3)

    expect(split).toEqual([
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 5, y: 10 },
        { x: 0, y: 10 },
      ]),
      expect.arrayContaining([
        { x: 9, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 5, y: 10 },
      ]),
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: 9, y: 0 },
        { x: 5, y: 10 },
      ]),
    ])
  })

  it("handles split where splitting line ends inside polygon", () => {
    const line: SplitablePolygon = [new Vector3(0, 0), new Vector3(10, 0), new Vector3(10, 10), new Vector3(0, 10)]

    const splitLine = [new Vector3(1, -1), new Vector3(1, 11), new Vector3(5, 5)]

    const split = splitPolygon(line, splitLine, false)
    expect(split.length).toEqual(2)

    expect(split).toEqual([
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 10 },
        { x: 0, y: 10 },
      ]),
      expect.arrayContaining([
        { x: 1, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 1, y: 10 },
      ]),
    ])
  })
})
