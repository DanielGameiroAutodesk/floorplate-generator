import { describe, expect, it } from "vitest"
import combineClasses from "./combineClasses"

describe("combineClasses", () => {
  it("should combine all base styles", () => {
    const result = combineClasses(["a", "b"])
    expect(result).toEqual("a b")
  })

  it("should combine base styles and conditional styles", () => {
    const result = combineClasses(["a", "b"], { c: true })
    expect(result).toEqual("a b c")
  })

  it("should combine base styles and conditional styles that are true", () => {
    const result = combineClasses(["a", "b"], { c: true, d: false })
    expect(result).toEqual("a b c")
  })
})
