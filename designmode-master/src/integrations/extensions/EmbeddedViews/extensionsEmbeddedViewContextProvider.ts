import type { EmbeddedViewHostContext as Context } from "./generated-types"
import { createEmbeddedViewContextSignal } from "./context-api"

declare global {
  interface Window {
    extensionsEmbeddedViewContextProvider: {
      // This is used from forma-embedded-view-host to create and
      // subscribe to a context value.
      subscribe: (options: { callback: (value: Context | null) => void }) => {
        unsubscribe: () => void
      }
    }
  }
}

// An embedded view host will subscribe to EmbeddedViewHostContext
// scoped to an extension's embedded view through this method.
window.extensionsEmbeddedViewContextProvider = {
  subscribe: ({ callback }) => {
    const renderScope = `extension-${Math.random()}`
    const [embeddedViewContextSignal, cleanupContext] = createEmbeddedViewContextSignal(renderScope)

    const disableSubscription = embeddedViewContextSignal.subscribe((context) => {
      callback(context)
    })

    return {
      unsubscribe: () => {
        disableSubscription()
        cleanupContext()
        callback(null)
      },
    }
  },
}
