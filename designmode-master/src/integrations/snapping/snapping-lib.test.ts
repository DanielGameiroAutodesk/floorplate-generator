import { Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { samplePointsAlongLineXY } from "./snapping-lib"

describe("samplePointsAlongLineXY", () => {
  it("should not sample short lines", () => {
    const p1 = new Vector3(5, 5, 0)
    const p2 = new Vector3(5, 6, 0)
    const result = samplePointsAlongLineXY(p1, p2, 1, 1000)
    expect(result).toStrictEqual([p1, p2])
  })

  it("should sample long lines", () => {
    const p1 = new Vector3(5, 5, 0)
    const p2 = new Vector3(5, 8, 0)
    const result = samplePointsAlongLineXY(p1, p2, 1, 1000)
    expect(result).toStrictEqual([
      new Vector3(5, 5, 0),
      new Vector3(5, 6, 0),
      new Vector3(5, 7, 0),
      new Vector3(5, 8, 0),
    ])
  })

  it("should always include the target point", () => {
    const p1 = new Vector3(5, 5, 0)
    const p2 = new Vector3(5, 8.5, 0)
    const result = samplePointsAlongLineXY(p1, p2, 1, 1000)
    expect(result).toStrictEqual([
      new Vector3(5, 5, 0),
      new Vector3(5, 6, 0),
      new Vector3(5, 7, 0),
      new Vector3(5, 8, 0),
      new Vector3(5, 8.5, 0),
    ])
  })

  it("ignores z coordinate", () => {
    const p1 = new Vector3(5, 5, 0)
    const p2 = new Vector3(5, 8.5, 10)
    const result = samplePointsAlongLineXY(p1, p2, 1, 1000)
    expect(result).toStrictEqual([
      new Vector3(5, 5, 0),
      new Vector3(5, 6, 0),
      new Vector3(5, 7, 0),
      new Vector3(5, 8, 0),
      new Vector3(5, 8.5, 10),
    ])
  })
})
