import type { FloatingPanelPlacement } from "src/integrations/extensions/EmbeddedViews/EmbeddedViewHost"
import type { Extension } from "src/integrations/extensions/extension-service"

export interface Entrypoint {
  type: "ELEMENT_CONTEXT_MENU"
  buttonTitle: string
  /**
   * The filter is a list of conditions that must be met for the action to be applicable.
   * - For every list entry, the properties within have an AND relationship.
   * - Between list entries, there exists an OR relationship.
   */
  filters: {
    elementProvider?: string
    representation?: string
  }[]
  action:
    | {
        type: "INVOKE_HANDLER"
        url: string
        handler: string
        viewOptions?: {
          embeddedViewId?: string
          preferredSize?: { width: number; height: number }
          placement?: FloatingPanelPlacement | undefined
        }
      }
    | {
        type: "OPEN_FLOATING_PANEL"
        url: string
        viewOptions?: {
          embeddedViewId?: string
          preferredSize?: { width: number; height: number }
          placement?: FloatingPanelPlacement | undefined
        }
      }
}

export type ExtensionWithEntrypoints = Extension & { entrypoints?: Entrypoint[] }
