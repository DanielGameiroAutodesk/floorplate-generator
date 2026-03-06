import { useCallback, useMemo, useRef } from "preact/hooks"
import { SubLayer } from "./SubLayer"
import { elementState } from "src/core/elements/ElementState"
import { getLeafKey, getParentPath, ROOT_KEY } from "src/lib/element/path"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { replaceRevision } from "src/lib/element/urn"
import type { Category } from "src/core/categories"
import { findPathsForCategory } from "src/integrations/NavigatorTab/layer-list/utils"
import type { FormaElement } from "forma-elements"

type Props = {
  category: Category
  isScenario: boolean
}

export const SubLayers = ({ category, isScenario }: Props) => {
  const proposal = elementState.currentProposalSignal.value
  const base = proposal.base
  const snapshot = elementState.currentSnapshot.value
  const toplevel = proposal.getToplevelNodes()
  const paths = useMemo(
    () => Array.from(findPathsForCategory(toplevel, isScenario, category, true, true)),
    [toplevel, category, isScenario],
  )
  const dragItem = useRef<string>()
  const dragItemNode = useRef<EventTarget | null>()

  const handleDragStart = useCallback((e: DragEvent, item: string) => {
    e.dataTransfer!.dropEffect = "move"
    dragItemNode.current = e.target
    dragItem.current = item
  }, [])

  const moveElement = (arr: readonly ElementContainer[], fromIndex: number, toIndex: number): ElementContainer[] => {
    const newChildren = [...arr]
    newChildren.splice(fromIndex, 1)
    newChildren.splice(toIndex, 0, arr[fromIndex])
    return newChildren
  }

  const handleDrop = useCallback(
    (e: DragEvent, targetItem: string) => {
      if (dragItem.current! !== targetItem) {
        const parentPath = getParentPath(dragItem.current!) || ROOT_KEY
        const isInBase = parentPath === base.path.value
        const parent = snapshot.getNode(parentPath)?.element
        if (!parent || !parent.children) return

        const moveFromIndex = parent.children.findIndex((c) => c.key === getLeafKey(dragItem.current!))
        const moveToIndex = parent.children.findIndex((c) => c.key === getLeafKey(targetItem))

        const parentContainer = isInBase ? base.container : proposal.container

        const newChildContainers = moveElement(parentContainer.children, moveFromIndex, moveToIndex)
        const draftElement: FormaElement = {
          ...parentContainer.element,
          urn: replaceRevision(parentContainer.element.urn),
          children: newChildContainers.map(
            (c) => parentContainer.element.children!.find((child) => child.urn === c.element.urn)!,
          ),
        }
        const newParentContainer = ElementContainer.fromDraftElement(draftElement, newChildContainers)
        if (isInBase) {
          elementState.updateBase(newParentContainer)
        } else {
          elementState.updateProposal(newParentContainer)
        }

        dragItem.current = undefined
        dragItemNode.current = null
      }
    },
    [dragItem, dragItemNode, proposal, base, snapshot],
  )

  return (
    <>
      {paths.map((path, index) => (
        <SubLayer
          index={index}
          key={path}
          category={category}
          isScenario={isScenario}
          path={path}
          handleDragStart={handleDragStart}
          dragItem={dragItem}
          handleDrop={handleDrop}
        />
      ))}
    </>
  )
}
