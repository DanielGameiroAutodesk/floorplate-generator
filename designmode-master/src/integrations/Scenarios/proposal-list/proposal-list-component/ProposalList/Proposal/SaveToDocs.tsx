import { useEffect, useState, useRef } from "preact/hooks"
import { createPortal } from "preact/compat"
import type { Urn } from "forma-elements"

import { createExport } from "./ExportProposalToDocs"
import { Modal } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/Modal/Modal"
import { getTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

interface Props {
  proposalUrn: Urn
  filename: string
  setSaveToDocs: (state: boolean) => void
}

interface CloudDataPickerSaveOptions {
  name: string
}

interface HubDatum {
  sourceId: string
}

interface ProjectDatum {
  sourceId: string
  type: string
  parentId: string
  iconUrl?: string
  isDisabled?: boolean
  description?: string
}

interface FileSystemDatum {
  id: string
  type: string
  parentId: string
  url?: string
  referenceUrl?: string
  isDisabled?: boolean
  description?: string
}

// This is a subtype of "ProjectLocationDatum" from "@adsk/uda-mediator";
type ProjectLocationDatum = {
  hub: HubDatum
  project: ProjectDatum
  fileFolder: FileSystemDatum
}

export function SaveToDocs({ proposalUrn, filename, setSaveToDocs }: Props) {
  const docsFileSaverRef = useRef<HTMLElement | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!docsFileSaverRef.current) {
      return
    }

    const docsFileSaver = docsFileSaverRef.current

    async function handleSave(
      event: CustomEvent<{
        items: Array<ProjectLocationDatum>
        saveFileOptions: CloudDataPickerSaveOptions
      }>,
    ) {
      const { items, saveFileOptions } = event.detail
      if (items.length < 1) {
        // Error state -- Need a location to save to
        return
      }
      const location = items[0]
      const projectId = `b.${location.project.sourceId}`
      const folderId = location.fileFolder.id

      // This will hide UDA component and show progress modal
      setExporting(true)
      await createExport({
        proposalUrn,
        filename: saveFileOptions.name,
        docsHubId: location.hub.sourceId,
        docsProjectId: projectId,
        docsFolderId: folderId,
      })

      setSaveToDocs(false)
    }

    function handleClose() {
      setSaveToDocs(false)
    }

    docsFileSaver.addEventListener("save", handleSave as unknown as EventListener)
    docsFileSaver.addEventListener("cancel", handleClose)

    return () => {
      docsFileSaver.removeEventListener("save", handleSave as unknown as EventListener)
      docsFileSaver.removeEventListener("cancel", handleClose)
    }
  }, [docsFileSaverRef, setSaveToDocs, proposalUrn])

  return createPortal(
    <div>
      {exporting && <Modal />}
      {!exporting && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
            }}
            onClick={() => {
              // TODO / Note: We use this as our "ClickOutside" handler because the UDA component
              // will use createPortal to render the Hub selector
              // which has a z-index set to 3. If we try to use a backdrop other components
              // in design-mode will be visible as they have a higher z-index (e.g. Toolbar has z-index: 3000).
              // They made a fix that allows a user to change the z-index in this commit:
              // https://git.autodesk.com/universal-data-access/uda-components/commit/a28736b9a73f5705ba11fbb3d18ff0ae94abaef6
              // but due to their release cycle being monthly and their planned 20250331 release does not appear to include it,
              // it might be out in a 20250430 release (or later).
              setSaveToDocs(false)
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              height: "600px",
              transform: "translate(-50%, -50%)",
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0px 0px 16px 0px rgba(0, 0, 0, 0.2)",
            }}
          >
            <forma-docs-file-saver
              ref={docsFileSaverRef}
              defaultFilename={filename}
              primaryButtonTitle={getTranslator()(($) => $.exportModal.exportPrimaryButtonTitle)}
            />
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
