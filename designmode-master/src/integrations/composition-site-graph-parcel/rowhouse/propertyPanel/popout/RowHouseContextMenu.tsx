import { useTranslator } from "src/i18n"

export function RowhouseContextMenu({
  close,
  contextMenuOpenPosition,
  toggleEditName,
  onEditOpen,
  onDuplicate,
  onDelete,
}: {
  close: () => any
  contextMenuOpenPosition: {
    top: number
    left: number
  }
  toggleEditName: (t: boolean) => any
  onEditOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const t = useTranslator()
  return (
    <div
      style={`position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100001;`}
      onClick={(e) => {
        close()
        e.stopPropagation()
      }}
    >
      <forma-context-menu-container
        left={contextMenuOpenPosition.left}
        top={contextMenuOpenPosition.top}
        onClose={() => close()}
      >
        <forma-context-menu>
          <forma-context-menu-item
            text={t(($) => $.ui.rename)}
            onClick={() => {
              toggleEditName(true)
              close()
            }}
          />
          <forma-context-menu-item
            text={t(($) => $.ui.edit)}
            onClick={() => {
              onEditOpen()
              close()
            }}
          />
          <forma-context-menu-item
            text={t(($) => $.ui.duplicate)}
            onClick={() => {
              onDuplicate()
              close()
            }}
          />
          <forma-context-menu-item
            text={t(($) => $.ui.delete)}
            onClick={() => {
              onDelete()
              close()
            }}
          />
        </forma-context-menu>
      </forma-context-menu-container>
    </div>
  )
}
