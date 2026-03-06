// TODO some of these are declared also in terrainPadApi.ts, maybe cleaner to gather all in one place for buffer operations?
// // Default values chosen from the original terrain mode application
const PERCENTAGE = 100
const DEFAULT_BUFFER = 1_000 // steep
const MIN_BUFFER = 20 // quite flat, flatter than this is not that useful and often results in not finding intersections with terrain
const MAX_BUFFER = 5_000 // very steep
const DEFAULT_BUFFER_RATIO = 200
const POWER_FACTOR = 0.25

function normalizeBuffer(buffer: number): number {
  return ((buffer - MIN_BUFFER) / (MAX_BUFFER - MIN_BUFFER)) ** POWER_FACTOR
}

function denormalizeBuffer(buffer: number): number {
  return MIN_BUFFER + (MAX_BUFFER - MIN_BUFFER) * buffer ** (1 / POWER_FACTOR)
}

function parseBuffer(buffer: string): number {
  // remove any non-number characters except for ":", ".", "," and "/". Replace "," with "." to get a valid number from parseFloat
  const filtered = buffer.replace(/[^0-9/:.,-]/g, "").replace(/,/g, ".")
  // split the string into two numbers and turn into floats
  const [num1, num2] = filtered.split(/:|\//).map(parseFloat).slice(0, 2)
  // if there is no second number, return DEFAULT_BUFFER
  if (!num2) return DEFAULT_BUFFER
  // otherwise return the ratio of the two numbers multiplied by 100 to get it as a percentage
  const value = (num1 / num2) * PERCENTAGE
  // if the value is outside the allowed range, return the closest allowed value
  if (value < MIN_BUFFER) return MIN_BUFFER
  if (value > MAX_BUFFER) return MAX_BUFFER
  return value
}

function trimNumber(num: number) {
  const fixed = num.toFixed(2)
  if (fixed.endsWith("00")) return num.toFixed(0)
  if (fixed.endsWith("0")) return num.toFixed(1)
  return fixed
}

function perecentageToBufferRatioString(percentage?: number): string {
  if (percentage === undefined) {
    return `${DEFAULT_BUFFER / 100}:1`
  }
  if (percentage > 100) {
    return `${trimNumber(percentage / 100)}:1`
  } else {
    return `1:${trimNumber(100 / percentage)}`
  }
}

export {
  DEFAULT_BUFFER,
  DEFAULT_BUFFER_RATIO,
  denormalizeBuffer,
  MAX_BUFFER,
  MIN_BUFFER,
  normalizeBuffer,
  parseBuffer,
  perecentageToBufferRatioString,
  trimNumber,
}
