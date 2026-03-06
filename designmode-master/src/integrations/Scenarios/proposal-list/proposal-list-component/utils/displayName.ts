import type { Urn } from "forma-elements"

export function displayName(urn: Urn) {
  const [, , , , elementId] = urn.split(":")
  return elementId.substring(0, 8)
}
