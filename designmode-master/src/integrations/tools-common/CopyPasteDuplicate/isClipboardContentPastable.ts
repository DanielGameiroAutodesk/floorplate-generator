import type { ClipboardValue } from "./types"
import { isElement } from "./types"

export async function clipboardContentPastable() {
  try {
    const clipboardContent = await navigator.clipboard.readText()
    if (!clipboardContent) return false
    const parsed = JSON.parse(clipboardContent)

    if (!parsed.candidates) return false
    const clipboardValues = parsed.candidates as ClipboardValue[]

    const regularElements = clipboardValues.filter(isElement)

    if (
      regularElements.length > 0 &&
      !regularElements.every(({ urn }) => urn && urn.startsWith("urn:adsk-forma-elements"))
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}
