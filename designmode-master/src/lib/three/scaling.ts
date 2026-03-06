export const getScalingCoefficient = (size: number, divisor: number) => {
  const WINDOW_SIZE_ADJUSTMENT_FACTOR = 1440 / window.innerHeight / divisor
  return size * WINDOW_SIZE_ADJUSTMENT_FACTOR
}

export function getScalingCoefficients(
  size: number = 6,
  divisor: number = 1000,
): { perspective: number; orthographic: number } {
  const windowAdjustmentFactor = 1440 / window.innerHeight / divisor
  const perspective = size * windowAdjustmentFactor
  return {
    perspective,
    orthographic: 2000 * perspective,
  }
}
