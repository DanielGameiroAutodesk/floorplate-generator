/*
Grabbed from https://easings.net/
 */
export namespace EasingFunctions {
  export const easeInOutQuart = (x: number): number => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2)

  export const linear = (x: number) => x

  export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3)
  export function easeOutBounce(x: number): number {
    const n1 = 7.5625
    const d1 = 2.75

    if (x < 1 / d1) {
      return n1 * x * x
    } else if (x < 2 / d1) {
      return n1 * (x -= 1.5 / d1) * x + 0.75
    } else if (x < 2.5 / d1) {
      return n1 * (x -= 2.25 / d1) * x + 0.9375
    } else {
      return n1 * (x -= 2.625 / d1) * x + 0.984375
    }
  }

  export function easeOutExpo(x: number): number {
    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x)
  }

  export function easeOutQuart(x: number): number {
    return 1 - Math.pow(1 - x, 4)
  }
  export function easeInOutCirc(x: number): number {
    return x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2
  }
  export function easeInOutSine(x: number): number {
    return -(Math.cos(Math.PI * x) - 1) / 2
  }
}
