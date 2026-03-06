import { describe, expect, it } from "vitest"

function sum(a: number, b: number): number {
  return a + b
}

describe("unit test", () => {
  it("should work", () => {
    const s = sum(1, 2)
    expect(s).toEqual(3)
  })
})
