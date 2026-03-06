import { clipboardContentPastable } from "src/integrations/tools-common/CopyPasteDuplicate/isClipboardContentPastable"
import { useCallback, useEffect, useState } from "preact/compat"
import { useCanvasPaste } from "src/integrations/tools-common/CopyPasteDuplicate/useCanvasPaste"
import { useCanvasCopy } from "src/integrations/tools-common/CopyPasteDuplicate/useCanvasCopy"
import { useDeleteSelected } from "src/integrations/tools-common/deleteSelected"
import { useTranslator } from "src/i18n"

export const ContextMenuCopyPaste = ({ canDelete, canCopy }: { canDelete: boolean; canCopy: boolean }) => {
  const t = useTranslator()
  const { copy, candidates } = useCanvasCopy()
  const deleteSelected = useDeleteSelected()
  const cut = useCallback(() => {
    copy()
    deleteSelected()
  }, [copy, deleteSelected])
  const paste = useCanvasPaste()

  const [canPaste, setCanPaste] = useState(false)
  useEffect(() => {
    void clipboardContentPastable().then(setCanPaste)
  }, [])
  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.contextMenu.copy)}
        onClick={copy}
        disabled={!canCopy || !candidates?.length}
        shortcut-mac={"⌘C"}
        shortcut-win={"Ctrl+C"}
      />
      <forma-context-menu-item
        text={t(($) => $.contextMenu.cut)}
        onClick={cut}
        disabled={!canDelete || !candidates?.length}
        shortcut-mac={"⌘X"}
        shortcut-win={"Ctrl+X"}
      />
      <forma-context-menu-item
        text={t(($) => $.contextMenu.paste)}
        onClick={() => void paste()}
        disabled={!canPaste}
        shortcut-mac={"⌘V"}
        shortcut-win={"Ctrl+V"}
      />
      <forma-context-menu-item
        text={t(($) => $.contextMenu.pasteInPlace)}
        onClick={() => void paste(true)}
        disabled={!canPaste}
        shortcut-mac={"⌘⇧V"}
        shortcut-win={"Ctrl+Shift+V"}
      />
      <forma-context-menu-divider />
    </>
  )
}
