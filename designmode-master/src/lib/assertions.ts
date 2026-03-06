export function assertIsDefined<T>(message: string, value: T | undefined): T {
  if (value == null) {
    throw new Error(`Unexpected nullable value: ${message}`)
  }
  return value
}
