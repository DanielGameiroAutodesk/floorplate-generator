// wraps around and supports negative numbers
// will always return a value unless the array is empty
export function at<T>(array: T[], index: number) {
  return array[((index % array.length) + array.length) % array.length]
}
