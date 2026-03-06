import { useState } from "preact/hooks"
import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/preact"
import { act } from "preact/test-utils"

function useMyHook() {
  const [count, setCount] = useState(0)
  return { count, setCount }
}

describe("hooks", () => {
  it("should work", async () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current.count).toBe(0)

    await act(() => {
      result.current.setCount(1)
    })
    expect(result.current.count).toBe(1)
  })
})
