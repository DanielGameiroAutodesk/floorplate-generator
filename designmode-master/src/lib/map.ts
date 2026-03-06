// Since Object.entries doesn't carry the key type, this helpers method
// isolates the key cast and still ensures the input Record key type is as expected.
export function recordToMap<K extends string, T>(value: Record<K, T>): Map<K, T> {
  return new Map(Object.entries(value) as [K, T][])
}

export function addToMap<K extends string, T>(target: Map<K, T>, source: ReadonlyMap<K, T>): void {
  for (const [key, value] of source) {
    target.set(key, value)
  }
}

export function mergeMaps<K, T>(...input: Map<K, T>[]): Map<K, T> {
  const result = new Map<K, T>()

  for (const map of input) {
    for (const [key, value] of map) {
      result.set(key, value)
    }
  }

  return result
}

/**
 * Utility to avoid non-null assertions when getting from a map
 * (or other structure that has a compatible get method) and producing errors
 * that are helpful rather than obscure undefined errors.
 */
export function getInMapOrThrow<K, T>(map: Pick<ReadonlyMap<K, T>, "get">, key: K): T {
  const box = map.get(key)
  if (box === undefined) {
    throw new Error(`Item with key ${String(key)} not found in map`)
  }
  return box
}
