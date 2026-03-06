import { useMemo } from "preact/hooks"
import { useInstallationsWithExtension } from "src/integrations/extensions/extension-service"
import { mockAddEntrypointsToExtensions } from "./mock"
import { filterApplicableEntrypoints } from "./filters"
import type { ExtensionWithEntrypoints } from "./types"
import { invokeExtensionHandler, OpenFloatingPanelFromEntrypoint } from "./applyAction"
import { selectedNodesSignal } from "src/core/selection/selectionState"

export function EditSelectionWithExtensionContextMenuItems({ projectId }: { projectId: string }) {
  const selectedNodes = selectedNodesSignal.value
  const extensionsAndInstallations = useInstallationsWithExtension()

  const extensionsWithEntrypoints: ExtensionWithEntrypoints[] = useMemo(() => {
    const extensions = (extensionsAndInstallations ?? []).map(({ extension }) => extension)
    return mockAddEntrypointsToExtensions(extensions)
  }, [extensionsAndInstallations])

  const entrypoints = useMemo(() => {
    const selectedElements = selectedNodes.map((it) => it.element)
    return filterApplicableEntrypoints(selectedElements, extensionsWithEntrypoints)
  }, [extensionsWithEntrypoints, selectedNodes])

  return (
    <>
      {entrypoints.map((action, i) => (
        <forma-context-menu-item
          key={i}
          text={
            action.buttonTitle ??
            `Edit with ${extensionsWithEntrypoints?.find((ext) => ext.id === action.extensionId)?.name ?? "extension"}`
          }
          onClick={() => {
            const data = extensionsAndInstallations?.find((ext) => ext.extension.id === action.extensionId)
            if (!data) {
              throw new Error("Data out of sync when trying to open extension.")
            }
            if (action.action.type === "INVOKE_HANDLER") {
              void invokeExtensionHandler(data.extension, data.installation, projectId, action)
            } else if (action.action.type === "OPEN_FLOATING_PANEL") {
              void OpenFloatingPanelFromEntrypoint(data.extension, data.installation, projectId, action)
            }
          }}
          disabled={false}
        />
      ))}
      {entrypoints.length > 0 && <forma-context-menu-divider />}
    </>
  )
}
