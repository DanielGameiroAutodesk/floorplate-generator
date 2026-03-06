import { describe, expect, it } from "vitest"
import { DesignModeEvents } from "./events"

describe("Adding event listener", () => {
  it("should not be called before dispatching and event", () => {
    let started = false

    DesignModeEvents.addListener("tool.edit.start", () => (started = true))

    expect(started).toBeFalsy()
  })

  it("should call callback when dispatched", () => {
    let started = false

    DesignModeEvents.addListener("tool.edit.start", () => (started = true))

    DesignModeEvents.dispatch("tool.edit.start", { toolId: "test" })
    expect(started).toBeTruthy()
  })

  it("should call callback with data", () => {
    let data

    DesignModeEvents.addListener("test.event", (e) => (data = e.detail.testData))
    DesignModeEvents.dispatch("test.event", { testData: "testData" })

    expect(data).toEqual("testData")
  })

  it("should not call callback if removed as eventlistener", () => {
    let started = false

    function func() {
      started = true
    }

    DesignModeEvents.addListener("tool.edit.start", func)
    DesignModeEvents.removeListener("tool.edit.start", func)

    expect(started).toBeFalsy()
  })

  it("should be typed", () => {
    DesignModeEvents.dispatch("tool.edit.start", { toolId: "test" })
    DesignModeEvents.dispatch("test.event", { testData: "testData" })

    // @ts-expect-error: Should expect type.
    DesignModeEvents.dispatch("test.event")
    // @ts-expect-error: Should expect type.
    DesignModeEvents.dispatch("tool.edit.start", null)
  })
})
