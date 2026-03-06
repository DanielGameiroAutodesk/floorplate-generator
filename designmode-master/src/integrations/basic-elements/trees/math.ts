export const round = (value: number, decimalPlaces: number): number =>
  Math.round((value + Number.EPSILON) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)

export const round2 = (value: number): number => round(value, 2)

/**
 * Computes x mod n
 * x arbitrary integer
 * n natural number
 *
 * Made to deal with the fact that javascripts modulo is not mathematical modulo
 * because of negative numbers: https://dev.to/maurobringolf/a-neat-trick-to-compute-modulo-of-negative-numbers-111e
 */
export const modulo = (x: number, n: number): number => ((x % n) + n) % n

/**
 * Seeded random number generator
 * Copied from https://stackoverflow.com/a/47593316
 */
export function seededRandomNumberGenerator(a: number, b: number, c: number, d: number) {
  return function () {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}
