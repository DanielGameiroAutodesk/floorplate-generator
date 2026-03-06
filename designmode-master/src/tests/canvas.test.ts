import { JSDOM } from "jsdom"
import { beforeAll, describe, expect, it } from "vitest"

describe("DOM should have design-mode-canvas element", () => {
  beforeAll(() => {
    const dom = new JSDOM(`<canvas id="design-mode-canvas"></canvas>`)
    global.document = dom.window.document
  })

  it("should have canvas el", () => {
    const canvas = document.getElementById("design-mode-canvas")
    expect(canvas).toBeTruthy()
  })
})
