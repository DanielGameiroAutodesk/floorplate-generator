import { useCallback } from "preact/compat"
import {
  selectedNodesSignal,
  selectedTopLevelNodesSignal,
  selectionArraySignal,
  selectionSetSignal,
} from "src/core/selection/selectionState"
import { getLeafKey, getParentPath, ROOT_KEY } from "src/lib/element/path"
import { replaceRevision } from "src/lib/element/urn"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { elementState } from "src/core/elements/ElementState"
import { isDefined } from "src/lib/array"
import { useComputed } from "@preact/signals"
import type { Proposal } from "src/core/elements/Proposal"
import { captureException } from "@sentry/browser"
import { useTranslator } from "src/i18n"

function useSelectionIncludes2DShapesSignal() {
  return useComputed<boolean>(() => {
    const selected = selectedTopLevelNodesSignal.value

    return selected.some((node) => {
      const footprint = node.elementContainer.representations.footprint
      const volumeMesh = node.elementContainer.representations.volumeMesh
      return footprint && !volumeMesh
    })
  })
}

function useDisableMoveToFrontSignal() {
  const childIndexOfCurrentSelectionSignal = useChildIndexOfCurrentSelectionSignal()

  return useComputed<boolean>(() => {
    const selected = Array.from(selectionSetSignal.value)
    if (selected.length === 0) return false
    if (selected.length > 1) return false
    return childIndexOfCurrentSelectionSignal.value[0] === 0
  })
}

function useNumProposalChildrenSignal() {
  return useComputed<number>(() => {
    return elementState.currentProposalSignal.value.element.children?.length || 0
  })
}

function useChildIndexOfCurrentSelectionSignal() {
  return useComputed<number[]>(() => {
    const snapshot = elementState.currentSnapshot.value
    const result: number[] = []

    for (const node of selectedNodesSignal.value) {
      const parentPath = getParentPath(node.path)
      if (!isDefined(parentPath)) continue

      const leafKey = getLeafKey(node.path)
      const parentChildren = snapshot.getNodeOrThrow(parentPath).elementContainer.element.children ?? []
      const childIndex = parentChildren.findIndex((c) => c.key === leafKey)
      if (childIndex !== -1) {
        result.push(childIndex)
      }
    }

    return result
  })
}

function useDisableShowMoveToBackSignal() {
  const childIndexOfCurrentSelectionSignal = useChildIndexOfCurrentSelectionSignal()
  const numProposalChildrenSignal = useNumProposalChildrenSignal()

  return useComputed<boolean>(() => {
    const selected = selectionSetSignal.value
    if (selected.size === 0) return false
    if (selected.size > 1) return true
    const indexesOfSelected = childIndexOfCurrentSelectionSignal.value
    const numChildren = numProposalChildrenSignal.value
    return indexesOfSelected[0] === numChildren - 1
  })
}

function getContainer(proposal: Proposal, parentPath: string) {
  const parentContainer = proposal.base.path.equals(parentPath)
    ? proposal.base.container
    : proposal.path.equals(parentPath)
      ? proposal.container
      : undefined
  if (!parentContainer) {
    captureException(new Error("Moved to front/back on element not a child of proposal or base"))
    return
  }
  return parentContainer
}

export const ReorderLayers = () => {
  const t = useTranslator()
  const disableMoveToFront = useDisableMoveToFrontSignal().value
  const disableMoveToBack = useDisableShowMoveToBackSignal().value

  const selection = selectionArraySignal.value
  const moveToFront = useCallback(() => {
    const proposal = elementState.currentProposalSignal.peek()
    const paths = selection
    const parentPath = getParentPath(paths[0]) || ROOT_KEY
    const parent = proposal.snapshot.getNode(parentPath)?.element
    if (!parent || !parent.children) return

    const keys = paths.map(getLeafKey)

    const parentContainer = getContainer(proposal, parentPath)
    if (!parentContainer) return
    const parentEl = parentContainer.element
    const newParentContainer = ElementContainer.fromDraftElement(
      {
        ...parentEl,
        urn: replaceRevision(parentEl.urn),
        children: parentEl.children?.slice().sort((a, b) => {
          const aScore = keys.includes(a.key) ? -1 : 1
          const bScore = keys.includes(b.key) ? -1 : 1
          return aScore - bScore
        }),
      },
      parentContainer.children,
    )
    if (proposal.base.path.equals(parentPath)) {
      elementState.updateBase(newParentContainer)
      return
    }
    if (proposal.path.equals(parentPath)) {
      elementState.updateProposal(newParentContainer)
    }
  }, [selection])

  const moveToBack = useCallback(() => {
    const proposal = elementState.currentProposalSignal.peek()
    const paths = selection
    const parentPath = getParentPath(paths[0]) || ROOT_KEY
    const parent = proposal.snapshot.getNode(parentPath)?.element
    if (!parent || !parent.children) return

    const keys = paths.map(getLeafKey)

    const parentContainer = getContainer(proposal, parentPath)
    if (!parentContainer) return
    const parentEl = parentContainer.element
    const newParentContainer = ElementContainer.fromDraftElement(
      {
        ...parentEl,
        urn: replaceRevision(parentEl.urn),
        children: parentEl.children?.slice().sort((a, b) => {
          const aScore = keys.includes(a.key) ? 1 : -1
          const bScore = keys.includes(b.key) ? 1 : -1
          return aScore - bScore
        }),
      },
      parentContainer.children,
    )
    if (proposal.base.path.equals(parentPath)) {
      elementState.updateBase(newParentContainer)
      return
    }
    if (proposal.path.equals(parentPath)) {
      elementState.updateProposal(newParentContainer)
    }
  }, [selection])

  if (!useSelectionIncludes2DShapesSignal().value) return null

  return (
    <>
      <forma-context-menu-item
        disabled={disableMoveToFront}
        text={t(($) => $.contextMenu.moveToFront)}
        onClick={moveToFront}
      />
      <forma-context-menu-item
        disabled={disableMoveToBack}
        text={t(($) => $.contextMenu.moveToBack)}
        onClick={moveToBack}
      />
      <forma-context-menu-divider />
    </>
  )
}
