import type { LibraryItem } from "./integrations/library/api"

declare global {
  interface WindowEventMap {
    "forma/imports/edit": CustomEvent<{ libraryItem?: LibraryItem }>
    "forma/marketplace/open": CustomEvent<{ tab: "order" | "import" }>
    "forma/marketplace/order-placed": CustomEvent
  }
}
