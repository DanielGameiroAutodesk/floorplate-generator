export function Set_shallowEquals<T>(a: Set<T>, b: Set<T>) {
  return a.size === b.size && Array.from(a).every((i) => b.has(i))
}

export function Set_filter<T>(data: Set<T>, predicate: (item: T, index?: number) => boolean) {
  return new Set(Array.from(data).filter(predicate))
}

export function Set_add<T>(data: Set<T>, item: T) {
  return data.has(item) ? data : new Set(data).add(item)
}

export function Set_delete<T>(data: Set<T>, item: T) {
  if (!data.has(item)) return data
  const result = new Set(data)
  result.delete(item)
  return result
}

export function Set_union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set<T>([...a, ...b])
}

export function Set_intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>()
  for (const item of a) {
    if (b.has(item)) {
      result.add(item)
    }
  }
  return result
}

export function Sets_have_intersection<T>(a: Set<T>, b: Set<T>) {
  const smallest = a.size < b.size ? a : b
  const largest = a.size < b.size ? b : a
  for (const item of smallest) {
    if (largest.has(item)) return true
  }
}

export function Set_toggle<T>(set: Set<T>, item: T) {
  const result = new Set(set)
  if (result.has(item)) result.delete(item)
  else result.add(item)
  return result
}
