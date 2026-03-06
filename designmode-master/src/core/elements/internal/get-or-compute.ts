/** @internal */
export function getOrCompute<K extends WeakKey, T>(cache: WeakMap<K, T>, key: K, compute: () => T) {
  let result = cache.get(key)
  if (!result) {
    result = compute()
    cache.set(key, result)
  }
  return result
}
