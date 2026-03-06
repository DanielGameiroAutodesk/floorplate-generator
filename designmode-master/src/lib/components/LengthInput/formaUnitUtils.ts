import * as formaUnits from "@spacemakerai/forma-units"
import { METER_TO_FEET, UnitType } from "@spacemakerai/forma-units"
import { feetToMeter, toFeetIfImperial, toMetersIfImperial } from "src/lib/measurementSystem"
import { round } from "src/lib/math/round"

/* Helper to sanitize commas , => . to be more user-friendly for most metric using countries.
   Passing . to formaUnits functions is still needed afaik.
   https://spacemakercore.slack.com/archives/C044S2T30SU/p1685520602623799 */
export const sanitizeComma = (str: string) => str.replace(",", ".")

/* Helper to get common lower boundaries, 1/2" or 1cm */
export const metricMinDefault = (isImperial: boolean) => (isImperial ? feetToMeter(1 / 24) : 0.01)

/* Converts  metricValue to closest metricValue in whole feet, rounded up.
   E.g: 0.5m => 1.64ft => 2ft => 0.6096m */
export function roundUpToClosestFootInMetric(metric: number): number {
  if (metric === 0) return 0
  return feetToMeter(Math.ceil(metric * METER_TO_FEET))
}

/* Sanitizes value to be within set max/min limits */
export function withinMetricLimits({
  metricValue,
  metricMin,
  metricMax,
}: {
  metricValue: number
  metricMin: number
  metricMax: number
}) {
  if (metricValue < metricMin) return metricMin
  if (metricValue > metricMax) return metricMax
  return metricValue
}

/* Steps up value within boundary with given step. Returns stepped value as number.
   Intended to be used primarily with arrow up/down */
export function applyLengthStep({
  direction,
  currentVal,
  isImperial,
  displayUnit,
  feetStep,
  metricStep,
  metricMax = Infinity,
  metricMin = -Infinity,
}: {
  direction: "UP" | "DOWN"
  currentVal: string
  isImperial: boolean
  displayUnit: UnitType
  metricStep: number
  feetStep: number
  metricMax?: number
  metricMin?: number
}): number {
  const step = isImperial ? feetStep : metricStep
  const decimalPlaces = Number.isInteger(step) ? 0 : 2
  const localMax = toFeetIfImperial(metricMax, isImperial)
  const localMin = toFeetIfImperial(metricMin, isImperial)

  const internalUnit = formaUnits.getUnitTypeNoDefault(currentVal) ?? displayUnit
  formaUnits.setCurrentUnitType(internalUnit)

  if (formaUnits.isValidString(currentVal)) {
    const currentValNumber = formaUnits.parseLengthAndConvert(
      currentVal,
      isImperial ? UnitType.ImperialFeetInches : UnitType.MetricMeter,
    )

    if (direction === "UP") {
      return Math.min(round(currentValNumber + step, decimalPlaces), localMax)
    } else if (direction === "DOWN") {
      return Math.max(round(currentValNumber - step, decimalPlaces), localMin)
    }
  }

  return formaUnits.parseLength(currentVal)
}

export const inputStringToMeters = (
  lengthStr: string,
  defaultUnit: UnitType,
): { metricValue: number; parsedUnitType: UnitType } => {
  const lengthStrUnit = formaUnits.getUnitTypeNoDefault(lengthStr)
  if (typeof lengthStrUnit === "undefined") {
    return {
      metricValue: toMetersIfImperial(parseFloat(lengthStr), defaultUnit === UnitType.ImperialFeetInches),
      parsedUnitType: defaultUnit,
    }
  }

  const metricValue = formaUnits.parseLengthAndConvert(lengthStr, UnitType.MetricMeter)
  return {
    metricValue,
    parsedUnitType: lengthStrUnit,
  }
}
