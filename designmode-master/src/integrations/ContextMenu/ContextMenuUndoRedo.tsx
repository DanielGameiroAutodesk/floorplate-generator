import { elementState } from "src/core/elements/ElementState"
import { useTranslator } from "src/i18n"

export const ContextMenuUndoRedo = () => {
  const t = useTranslator()
  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.ui.undo)}
        onClick={() => elementState.undo()}
        disabled={!elementState.canUndo()}
        shortcut-mac={"⌘Z"}
        shortcut-win={"Ctrl+Z"}
      />
      <forma-context-menu-item
        text={t(($) => $.ui.redo)}
        onClick={() => elementState.redo()}
        disabled={!elementState.canRedo()}
        shortcut-mac={"⇧⌘Z"}
        shortcut-win={"Ctrl+Y"}
      />
      <forma-context-menu-divider />
    </>
  )
}
