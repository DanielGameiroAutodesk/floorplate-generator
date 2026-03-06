import type { FormaElement, Urn } from "forma-elements"
import { freezeFormaElement } from "./freeze"

export function mapOfFormaElements(...elements: (FormaElement | FormaElement[])[]): Map<Urn, FormaElement> {
  const result = new Map<Urn, FormaElement>()
  for (const element of elements.flat()) {
    result.set(element.urn, freezeFormaElement(element))
  }
  return result
}
