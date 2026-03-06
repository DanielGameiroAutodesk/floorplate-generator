import { type MutableRef, useCallback, useState } from "preact/hooks"
import { useOperationPending } from "src/integrations/PendingOperation/useOperationPending"
import { type Category } from "src/core/categories"
import { pathStateSignal, setPathStateSignalValue, togglePathFlag } from "src/core/paths"
import {
  hoveredIdsSignal,
  selectionSetSignal,
  setHoveredIdsSignalValue,
  setSelectionSetSignalValue,
} from "src/core/selection/selectionState"
import { LayerItem } from "./LayerItem"
import { ContextMenu } from "src/integrations/ContextMenu/ContextMenu"
import { allCategories } from "src/integrations/NavigatorTab/layer-list/LayerListCategorized"
import { elementState } from "src/core/elements/ElementState"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { useTranslator } from "src/i18n"

type Props = {
  category: Category
  isScenario: boolean
  path: string
  index: number
  handleDragStart: (e: DragEvent, item: string) => void
  handleDrop: (e: DragEvent, targetItem: string) => void
  dragItem: MutableRef<string | undefined>
}

export const SubLayer = ({ category, isScenario, path, index, handleDragStart, handleDrop, dragItem }: Props) => {
  const t = useTranslator()
  const node = elementState.currentSnapshot.value.getNode(path)!
  const name =
    node.child?.name ?? node.element.properties?.name ?? `${t.getText(allCategories[category].title)} ${index + 1}`

  const hoveredIds = hoveredIdsSignal.value
  const selection = selectionSetSignal.value
  const pathState = pathStateSignal.value
  const setPathState = setPathStateSignalValue

  const toggleVisible = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPathState((current) => togglePathFlag(current, isScenario, "hidden", path))
    },
    [setPathState, isScenario, path],
  )
  const toggleLock = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPathState((current) => togglePathFlag(current, isScenario, "locked", path))
    },
    [setPathState, isScenario, path],
  )
  const onMouseOver = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setHoveredIdsSignalValue(new Set([path]))
    },
    [path],
  )

  const { isOperationPending, markOperationBlocked } = useOperationPending()

  const onClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (isOperationPending) {
        markOperationBlocked()
        return
      }
      const isPathSelectable = !(
        pathState.proposal.hidden.has(path) ||
        pathState.scenario.hidden.has(path) ||
        pathState.scenario.locked.has(path) ||
        pathState.proposal.locked.has(path)
      )
      if (!isPathSelectable) return
      setSelectionSetSignalValue((current) => (e.shiftKey ? new Set([...current, path]) : new Set([path])))
    },
    [isOperationPending, markOperationBlocked, path, pathState],
  )

  const [contextMenuPos, setContextMenuPos] = useState<null | { x: number; y: number }>(null)
  const onContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      onClick(e)
      setContextMenuPos({ x: e.clientX, y: e.clientY })
    },
    [onClick],
  )

  const isHidden = isScenario ? pathState.scenario.hidden.has(path) : pathState.proposal.hidden.has(path)
  const isLocked = isScenario ? pathState.scenario.locked.has(path) : pathState.proposal.locked.has(path)
  return (
    <>
      <div
        style={{ transform: "translate3d(0, 0, 0)" }}
        draggable
        key={path}
        onDragStart={(e) => handleDragStart(e, path)}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer!.dropEffect = "move"
        }}
        onDrop={(e) => dragItem.current && handleDrop(e, path)}
      >
        <LayerItem
          title={name}
          category={category}
          isScenario={isScenario}
          toggleVisible={toggleVisible}
          toggleLock={toggleLock}
          onMouseOver={onMouseOver}
          onContextMenu={onContextMenu}
          onClick={onClick}
          hidden={isHidden}
          locked={isLocked}
          hovered={hoveredIds.has(path)}
          selected={selection.has(path)}
          isSubLayer={true}
        />
      </div>
      {contextMenuPos && (
        <IfEditAccess>
          <forma-context-menu-container
            left={contextMenuPos.x}
            top={contextMenuPos.y}
            onClose={() => setContextMenuPos(null)}
          >
            <ContextMenu />
          </forma-context-menu-container>
        </IfEditAccess>
      )}
    </>
  )
}
