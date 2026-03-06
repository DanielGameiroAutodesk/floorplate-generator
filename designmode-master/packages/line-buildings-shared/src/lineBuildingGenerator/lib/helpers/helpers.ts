export function deepCopy(object: any) {
  return JSON.parse(JSON.stringify(object))
}

export function reverseArray(array: any) {
  array = deepCopy(array)
  array.reverse()
  return array
}

export function intersectionOfArrays(array1: any[], array2: any[]) {
  return array1.filter((value) => array2.includes(value))
}

export function antiIntersectionOfArrays(array1: any[], array2: any[]) {
  const intersection = intersectionOfArrays(array1, array2)
  return [...array1, ...array2].filter((value) => !intersection.includes(value))
}

export function round(number: number, decimals: number) {
  const f = Math.pow(10, decimals)
  return Math.round((number + Number.EPSILON) * f) / f
}
