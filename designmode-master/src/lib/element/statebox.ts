import type { FormaElement, Urn } from "forma-elements"
import { objectEntries } from "src/lib/record"

/**
 * Container to wrap both a FormaElement data model and a boolean
 * indicating if this is coming from the server or is a draft.
 *
 * If {@link isServerState} is true, the element exists on the server
 * and the FormaElement is the data _retrieved_ from the server and
 * should be a complete model.
 */
export class FormaElementBox<T extends FormaElement = FormaElement> {
  // This ensures the constructor must be invoked to create it.
  #_: symbol | undefined

  private constructor(
    public readonly element: T,
    public readonly isServerState: boolean,
  ) {}

  static fromServer(this: void, data: FormaElement) {
    return new FormaElementBox(data, true)
  }

  static fromDraft(this: void, data: FormaElement) {
    return new FormaElementBox(data, false)
  }
}

function createElementBoxMap(
  values: (Record<Urn, FormaElement> | Map<Urn, FormaElement> | FormaElement[] | FormaElement)[],
  factory: (element: FormaElement) => FormaElementBox,
): Map<Urn, FormaElementBox> {
  const result = new Map<Urn, FormaElementBox>()

  for (const item of values) {
    if (item instanceof Map) {
      for (const [urn, element] of item.entries()) {
        result.set(urn, factory(element))
      }
    } else if (Array.isArray(item)) {
      for (const element of item) {
        result.set(element.urn, factory(element))
      }
    } else if ("urn" in item) {
      result.set(item.urn, factory(item))
    } else {
      for (const [urn, element] of objectEntries(item)) {
        result.set(urn, factory(element))
      }
    }
  }

  return result
}

export function createElementBoxMapFromDraftElements(
  ...elements: (Record<Urn, FormaElement> | Map<Urn, FormaElement> | FormaElement[] | FormaElement)[]
) {
  return createElementBoxMap(elements, FormaElementBox.fromDraft)
}

export function createElementBoxMapFromServerElements(
  ...elements: (Record<Urn, FormaElement> | Map<Urn, FormaElement> | FormaElement[] | FormaElement)[]
) {
  return createElementBoxMap(elements, FormaElementBox.fromServer)
}

export function ejectElementBoxMapToRecord(elementBoxes: Map<Urn, FormaElementBox>): Record<Urn, FormaElement> {
  const result: Record<Urn, FormaElement> = {}
  for (const [urn, { element }] of elementBoxes) {
    result[urn] = element
  }
  return result
}
