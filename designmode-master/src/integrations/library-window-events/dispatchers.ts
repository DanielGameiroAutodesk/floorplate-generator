import { SOURCE_DESIGNMODE } from "./constants"

type CustomEventDetail<T extends keyof WindowEventMap> = WindowEventMap[T] extends CustomEvent<infer U> ? U : never

export function setLibraryVisibility(libraryItemId: string | undefined, libraryItemUrn: string | undefined) {
  window.dispatchEvent(
    new CustomEvent<CustomEventDetail<"sm-library/item-selected">>("sm-library/item-selected", {
      detail: { libraryItemId, libraryItemUrn, source: SOURCE_DESIGNMODE },
      bubbles: true,
      composed: true,
    }),
  )
}
