import type { FormaElement } from "@spacemakerai/element-types"
import type { ExtensionWithEntrypoints, Entrypoint } from "./types"
import { objectKeys } from "src/lib/record"

type ApplicableEntrypoint = Entrypoint & { extensionId: string }

const isFromElementProvider = (element: FormaElement, elementProvider?: string) =>
  elementProvider != null &&
  element.properties?.elementProvider &&
  element.properties?.elementProvider === elementProvider

const hasRepresentation = (element: FormaElement, representation?: string) =>
  representation != null && element.representations?.[representation] != null

export function filterApplicableEntrypoints(
  elements: FormaElement[],
  extensions: ExtensionWithEntrypoints[],
): ApplicableEntrypoint[] {
  if (!elements.length || !extensions.length) return []

  return extensions
    .flatMap((ext) => ext.entrypoints?.map((action) => ({ ...action, extensionId: ext.id })) ?? [])
    .filter((action) => {
      return elements.every((element) =>
        action.filters.some((filter) => {
          if (objectKeys(filter).length === 0) {
            // Empty filter doesn't match anything
            return false
          }
          if ("elementProvider" in filter && !isFromElementProvider(element, filter.elementProvider)) {
            return false
          }
          if ("representation" in filter && !hasRepresentation(element, filter.representation)) {
            return false
          }
          return true
        }),
      )
    })
}
