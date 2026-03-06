// Type-preserving variant of Object.assign that ensure the target and source type
// is the same.
export function objectAssign<K extends string, V>(target: Record<K, V>, source: Record<K, V>) {
  for (const [key, value] of Object.entries(source)) {
    target[key as K] = value as V
  }
}

// A type-preserving variant than Object.entries.
//
// E.g. Object.entries(false) does not complain but causes any types which
// we currently don't catch with the current linting setup.
//
// This isn't strictly correct, as an object can contain additional properties.
// See https://stackoverflow.com/a/55012175 for more insight.
export function objectEntries<T extends Record<string, any>>(value: T): [keyof T, T[keyof T]][] {
  return Object.entries(value)
}

// A type-preserving variant than Object.fromEntries.
//
// Object.entries does not preserve key type, and there also exists a
// variant of Object.entries causing _any_ types.
//
// This isn't strictly correct, as an object can contain additional properties.
// See https://stackoverflow.com/a/55012175 for more insight.
export function objectFromEntries<T extends { [key: string]: any }>(value: Iterable<[keyof T, T[keyof T]]>): T {
  return Object.fromEntries(value) as T
}

// A type-preserving variant than Object.keys.
//
// Object.keys does not preserve key type, and there also exists a
// variant of Object.keys, e.g. Object.keys(garbage), causing _any_ types.
//
// This isn't strictly correct, as an object can contain additional properties.
// See https://stackoverflow.com/a/55012175 for more insight.
export function objectKeys<T extends { [key: string]: any }>(value: T): Exclude<keyof T, number>[] {
  return Object.keys(value) as Exclude<keyof T, number>[]
}

// A type-preserving variant than Object.values.
//
// E.g. Object.values(false) does not complain but causes any types which
// we currently don't catch with the current linting setup.
//
// This isn't strictly correct, as an object can contain additional properties.
// See https://stackoverflow.com/a/55012175 for more insight.
export function objectValues<T extends { [key: string]: any }>(value: T): T[keyof T][] {
  return Object.values(value)
}
