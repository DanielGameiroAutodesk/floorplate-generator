export const mod = (n: number, m: number) => ((n % m) + m) % m

export function argMin(array: number[]) {
  let argmin = 0
  let min_value = 99999999999999
  for (let i = 0; i < array.length; i++) {
    if (array[i] < min_value) {
      argmin = i
      min_value = array[i]
    }
  }
  return argmin
}
