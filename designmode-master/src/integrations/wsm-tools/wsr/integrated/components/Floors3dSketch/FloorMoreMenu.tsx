import { useEffect, useState } from "preact/hooks"
import { useTranslator } from "src/i18n"
import { ClickOutside } from "src/lib/components/ClickOutside2"

type FloorMoreMenuProps = {
  level: number
  onDelete: (index: number) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

const FloorMoreMenu = ({ level, onDelete, isOpen, onOpen, onClose }: FloorMoreMenuProps) => {
  const t = useTranslator()
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | undefined>()

  const deleteFloor = () => {
    onDelete(level)
    onClose()
  }

  useEffect(() => {
    if (!isOpen) setMenuPosition(undefined)
  }, [isOpen, setMenuPosition])

  return (
    <>
      {menuPosition && (
        <ClickOutside onClickOutside={() => setMenuPosition(undefined)}>
          <forma-context-menu-container
            left={menuPosition.left - 10}
            top={menuPosition.top + 30}
            style={{ position: "absolute", zIndex: 1000 }}
          >
            <forma-context-menu min-width="100%">
              <forma-context-menu-item
                text="Delete"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuPosition(undefined)
                  deleteFloor()
                }}
              />
            </forma-context-menu>
          </forma-context-menu-container>
        </ClickOutside>
      )}
      <weave-tooltip text={t(($) => $.wsm.floors.moreOptions)}>
        <weave-icon-button
          style={{ flex: 0 }}
          onClick={(e) => {
            e.stopPropagation()
            const rect = e.currentTarget.getBoundingClientRect()
            setMenuPosition({ top: rect.top, left: rect.left })
            onOpen()
          }}
        >
          <weave-tripple-dot style={{ transform: "rotate(90deg)" }} />
        </weave-icon-button>
      </weave-tooltip>
    </>
  )
}

export default FloorMoreMenu
