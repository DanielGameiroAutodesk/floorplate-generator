import type { Extension, OpenFloatingPanelAction } from "src/integrations/extensions/extension-service"
import type { ExtensionWithEntrypoints, Entrypoint } from "./types"

const RightClickToOpenExtensions = [
  "f5644f38-34ef-41d3-8334-ebeca9d06e67",
  "c49f6b11-9a36-4f87-ac37-4f57d0544d7e",
  "73026788-9b04-46e6-b69f-63dc771518c3",
  "085ab776-db2e-411b-9bb8-29ff378f0a7c",
]

export function mockAddEntrypointsToExtensions(extensions: Extension[]): ExtensionWithEntrypoints[] {
  return extensions.map((extension) => {
    const ext = extension as ExtensionWithEntrypoints
    if (RightClickToOpenExtensions.includes(ext.id)) {
      const buttonAction = ext.buttons?.[0].actions?.click
      if (buttonAction != null && (buttonAction as OpenFloatingPanelAction).type === "OPEN_FLOATING_PANEL") {
        const openOnRightClick: Entrypoint = {
          type: "ELEMENT_CONTEXT_MENU",
          filters: [{ elementProvider: `extension:${ext.id}` }],
          buttonTitle: `Edit in ${ext.name}`,
          action: {
            type: "OPEN_FLOATING_PANEL",
            url: (buttonAction as OpenFloatingPanelAction).url,
            viewOptions: {
              embeddedViewId: "FLOATING_PANEL",
              placement: { type: "fullscreen" },
            },
          },
        }
        return { ...ext, entrypoints: [openOnRightClick] }
      }
    }
    return ext
  })
}
