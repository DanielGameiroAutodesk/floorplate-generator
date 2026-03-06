import * as formaUnits from "@spacemakerai/forma-units"
import { describe, expect, test } from "vitest"

describe("test forma-units", () => {
  test("test format", () => {
    expect(formaUnits).toBeDefined()

    const imperial = formaUnits.convertStringToUnit("3.1242m", formaUnits.UnitType.ImperialFeetInches)
    expect(imperial).toBe(`10'-3"`)
  })

  test("parse fractional inch", () => {
    const value = formaUnits.parseLengthAndConvert(`1/2"`, formaUnits.UnitType.ImperialFeetInches)
    expect(value).toBeCloseTo(1 / 2 / 12, 6)
  })

  test("parse foot with fractional inch", () => {
    const value = formaUnits.parseLengthAndConvert(`2' 1/2"`, formaUnits.UnitType.ImperialFeetInches)
    expect(value).toBeCloseTo(2 + 1 / 2 / 12, 6)
  })

  test("test partial fraction", () => {
    formaUnits.setCurrentUnitType(formaUnits.UnitType.ImperialFeetInches)
    const value = formaUnits.isValidString(`2' 1/`)
    expect(value).toBe(false)
  })
})
