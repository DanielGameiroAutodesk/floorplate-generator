let timeoutId: number

// TODO: This debounce must combine calls with different parameters, otherwise updates may be lost
export function debounce(fn: () => void, ms: number) {
  clearTimeout(timeoutId)
  timeoutId = window.setTimeout(() => {
    fn()
  }, ms)
}

const MPH_TO_KPH = 1.60934
export const FEET_TO_METER = 0.3048
export const delocalisedSpeed = (newSpeed: number | undefined, isImperial: boolean) => {
  if (newSpeed === undefined) return undefined
  return isImperial ? newSpeed * MPH_TO_KPH : newSpeed
}
export const localisedSpeed = (speed: number | undefined, isImperial: boolean) => {
  if (speed === undefined) return undefined
  return isImperial ? speed / MPH_TO_KPH : speed
}

export function multiValueProps<T>(values: Set<T>, transform?: (value: T) => T): { value?: T; isMixed: boolean } {
  if (values.size === 1) {
    return {
      value: transform ? transform([...values][0]) : [...values][0],
      isMixed: false,
    }
  }
  return {
    isMixed: values.size > 1,
  }
}
