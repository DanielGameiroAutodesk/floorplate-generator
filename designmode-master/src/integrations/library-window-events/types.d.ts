import type { Urn } from "forma-elements"

declare global {
  interface WindowEventMap {
    "sm-library/visible": CustomEvent<{ urn: Urn; isVisible: boolean; source: "designmode" | "sm-library" }>
    "sm-library/convert-to-terrain": CustomEvent<{
      item: {
        authContext: string
        id: string
        name: string
        status: "success" | "pending" | "failed"
        urn: Urn
      }
    }>
    "sm-library/item-selected": CustomEvent<{
      libraryItemId: string | undefined
      libraryItemUrn: string | undefined
      source: "designmode" | "sm-library"
    }>
    "sm-library/refresh": CustomEvent
  }
}
