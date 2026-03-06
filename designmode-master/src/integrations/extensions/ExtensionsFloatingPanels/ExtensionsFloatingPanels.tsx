import { EmbeddedViewPlacement, useExtensionsHavingInstallation } from "src/integrations/extensions/extension-service"

// TODO: Remove this at a later point.
export function ExtensionsFloatingPanels() {
  const extensions = useExtensionsHavingInstallation() ?? []

  return (
    <>
      {extensions
        .filter((extension) =>
          (extension.resources.embeddedViews ?? []).some((it) => it.placement === EmbeddedViewPlacement.FLOATING_PANEL),
        )
        .map((extension) => (
          <p key={extension.id} style="margin: 12px 0; color: red">
            The extension <i>{extension.name}</i> has a floating panel defined as an embedded view. This is no longer
            supported. Reconfigure the extension to open a floating panel using the new button feature instead.
          </p>
        ))}
    </>
  )
}
