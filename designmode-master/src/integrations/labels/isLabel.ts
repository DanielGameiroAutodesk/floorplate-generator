import { ANNOTATION_LABEL_CATEGORY } from "./constants"
import type { FormaElement } from "forma-elements"

export function isLabelElement(element: FormaElement): boolean {
  return element.properties?.category === ANNOTATION_LABEL_CATEGORY
}

export default isLabelElement
