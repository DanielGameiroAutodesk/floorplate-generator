export function objectMap<T, V>(object: Record<string, T>, mapFn: (t: T) => V | undefined) {
  return Object.keys(object).reduce<Record<string, V>>((result, key) => {
    const res = mapFn(object[key])
    if (res) {
      result[key] = res
    }
    return result
  }, {})
}
