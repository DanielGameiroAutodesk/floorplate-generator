import { describe, expect, it } from "vitest"
import { render } from "@testing-library/preact"
import { atom, RecoilRoot, useRecoilState } from "recoil"

const countState = atom({ key: "count", default: 0 })

function MyComponent() {
  const [count] = useRecoilState(countState)

  return (
    <div>
      <h1>Count</h1>
      <p data-testid="custom-element">{`Current count: ${count}`}</p>
    </div>
  )
}

describe("recoilComponent", () => {
  it("should work", () => {
    const result = render(<MyComponent />, { wrapper: RecoilRoot })
    //console.log(result.debug())
    const component = result.getByTestId("custom-element")
    expect(component).toBeInTheDocument()
    expect(component).toHaveTextContent("Current count")
  })
})
