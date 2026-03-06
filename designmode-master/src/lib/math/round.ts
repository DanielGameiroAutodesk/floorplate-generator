export const round = (value: number, decimalPlaces: number): number =>
  Math.round((value + Number.EPSILON) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
