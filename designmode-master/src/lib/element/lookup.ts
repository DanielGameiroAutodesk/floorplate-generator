import type { FormaElement, Urn } from "forma-elements"
import type { FormaElementBox } from "./statebox"
import { objectFromEntries } from "src/lib/record"

// This must be an interface otherwise it will be incorrectly assignable to record types.
export interface FormaElementLookup {
  has(urn: Urn): boolean
  get(urn: Urn): FormaElement | undefined
  getOrThrow(urn: Urn): FormaElement
  toRecord(): Record<Urn, FormaElement>
  toMap(): Map<Urn, FormaElement>
  [Symbol.iterator](): IterableIterator<FormaElement>
}

export function withDerivedMethods(
  obj: Omit<FormaElementLookup, "getOrThrow" | "has" | "toMap" | "toRecord">,
): FormaElementLookup {
  function toMap() {
    const result = new Map<Urn, FormaElement>()
    for (const element of obj) {
      result.set(element.urn, element)
    }
    return result
  }

  return {
    ...obj,
    has(urn: Urn) {
      return obj.get(urn) !== undefined
    },
    getOrThrow(urn: Urn) {
      const element = obj.get(urn)
      if (!element) {
        throw new Error(`Element with urn ${urn} not found`)
      }
      return element
    },
    toMap,
    toRecord() {
      return objectFromEntries(toMap())
    },
  }
}

export function bindFormaElementLookupForMap(values: Map<Urn, FormaElement>): FormaElementLookup {
  return withDerivedMethods({
    get(urn: Urn) {
      return values.get(urn)
    },
    *[Symbol.iterator]() {
      for (const value of values.values()) {
        yield value
      }
    },
  })
}

export function bindFormaElementLookupForBoxMap(values: Map<Urn, FormaElementBox>): FormaElementLookup {
  return withDerivedMethods({
    get(urn: Urn) {
      return values.get(urn)?.element
    },
    *[Symbol.iterator]() {
      for (const value of values.values()) {
        yield value.element
      }
    },
  })
}

export function bindFormaElementLookupForRecord(values: Record<Urn, FormaElement>): FormaElementLookup {
  return withDerivedMethods({
    get(urn: Urn) {
      return values[urn]
    },
    *[Symbol.iterator]() {
      for (const value of Object.values(values)) {
        yield value
      }
    },
  })
}
