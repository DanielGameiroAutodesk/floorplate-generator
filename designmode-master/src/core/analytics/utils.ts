export function withSideEffect<Args extends any[], ReturnType>(
  fn: (...args: Args) => ReturnType,
  track: (...args: Args) => void,
): (...args: Args) => ReturnType {
  return (...args) => {
    track(...args)
    return fn(...args)
  }
}
