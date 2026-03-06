import { describe, expect, it } from "vitest"
import { renderHook } from "@testing-library/preact"
import { act } from "preact/test-utils"
import { atom, RecoilRoot, useRecoilState } from "recoil"

const countState = atom({ key: "count", default: 0 })

function useMyHook() {
  const [count, setCount] = useRecoilState(countState)
  return { count, setCount }
}

const TestComp = ({ children }: { children: Element }) => {
  return <RecoilRoot>{children}</RecoilRoot>
}

describe("recoilHook", () => {
  it("should work", async () => {
    const { result } = renderHook(() => useMyHook(), { wrapper: TestComp })
    expect(result.current.count).toBe(0)

    await act(() => {
      result.current.setCount(1)
    })
    expect(result.current.count).toBe(1)
  })
})
