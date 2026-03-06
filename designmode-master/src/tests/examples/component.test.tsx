import { describe, expect, it } from "vitest"
import { render } from "@testing-library/preact"

function MyComponent() {
  return <h1>Hei</h1>
}

describe("Test render component", () => {
  it("should sum correctly", () => {
    const result = render(<MyComponent />)
    // result.debug()
    expect(result.getByText("Hei")).toBeInTheDocument()
  })
})
