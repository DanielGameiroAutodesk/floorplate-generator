import type { Child, FormaElement } from "@spacemakerai/element-types"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { replaceRevision } from "src/lib/element/urn"
import { assertNever } from "src/lib/assertNever"
import { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { createNewProposalFromNewBase } from "src/lib/element/proposal"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
import type { RootContext } from "src/core/elements/ChildNodeContainer"
import { getInMapOrThrow } from "src/lib/map"
import type { Proposal } from "src/core/elements/Proposal"

const DEBUG = false

let lastReturnedRevision: number = 0
const newUnusedProposalOrBaseRevision = () => {
  const toReturn = Math.max(Date.now(), lastReturnedRevision + 1)
  lastReturnedRevision = toReturn
  return toReturn.toString()
}

/** @internal */
export const onlyForTesting = {
  newUnusedProposalOrBaseRevision,
}

/** @internal */
export function createNewProposalOrBaseWithBumpedRevision(proposal: FormaElement, childrenAfter?: Child[]) {
  return {
    ...proposal,
    urn: replaceRevision(proposal.urn, newUnusedProposalOrBaseRevision()),
    ...(childrenAfter ? { children: childrenAfter } : {}),
  }
}

/** @internal */
export function editSnapshot(proposal: Proposal, performEdit: (editFunctions: EditFunctions) => void): ElementSnapshot {
  const basePath = proposal.base.path.value
  const baseChildKeyOnProposal = proposal.base.path.leafKey()

  const changes: Record<RootContext, ChildChange[]> = {
    proposal: [],
    base: [],
  }

  const addElement = (context: RootContext, child: Child, rootContainer: ElementContainer): void => {
    if (DEBUG) console.log("add", child, rootContainer)

    if (child.urn !== rootContainer.element.urn) throw new Error("Child urn must match element urn")
    if (context == "proposal" && child.key == baseChildKeyOnProposal) {
      throw new Error("Not allowed to edit base element on proposal")
    }

    changes[context].push({ operation: "add", child, container: rootContainer })
  }
  const removeElement = (context: RootContext, key: Child["key"]): void => {
    if (DEBUG) console.log("remove", key)
    if (context == "proposal" && key == baseChildKeyOnProposal) {
      throw new Error("Not allowed to delete base element from proposal")
    }
    changes[context].push({ operation: "remove", key })
  }

  /**
   *
   * @param {RootContext} context
   * @param {Child} child
   * @param {ElementContainer} rootContainer Root container for the new subtree to use
   */
  const updateElement = (context: RootContext, child: Child, rootContainer: ElementContainer): void => {
    if (DEBUG) console.log("update", child, rootContainer)
    // Check if node exist, if not, throw
    const contextRootPath = context == "base" ? basePath : ROOT_KEY
    const path = mergePath(contextRootPath, child.key)
    const node = proposal.snapshot.getNode(path)
    if (!node) throw new Error("Node not existing")

    if (context == "proposal" && child.key == baseChildKeyOnProposal) {
      throw new Error("Not allowed to edit base element on proposal")
    }

    changes[context].push({ operation: "update", child, container: rootContainer })
  }

  performEdit({
    addElement,
    removeElement,
    updateElement,
  })

  const childContainersAfterChanges = (
    oldContainers: readonly ElementContainer[],
    children: readonly Child[],
    changes: readonly ChildChange[],
  ): ElementContainer[] => {
    const newContainers = changes.flatMap((change) => (change.operation == "remove" ? [] : [change.container]))
    const oldContainersMap = new Map(oldContainers.map((container) => [container.element.urn, container]))
    const newContainersMap = new Map(newContainers.map((container) => [container.element.urn, container]))
    const urnsForChildren = new Set(children.map((child) => child.urn))
    return [...urnsForChildren].map((urn) =>
      newContainersMap.has(urn) ? getInMapOrThrow(newContainersMap, urn) : getInMapOrThrow(oldContainersMap, urn),
    )
  }

  if (changes.base.length > 0) {
    if (!basePath || !baseChildKeyOnProposal) throw new Error("Could not find base path for proposal")
    const base = proposal.snapshot.getNode(basePath)?.elementContainer.element
    if (!base) throw new Error("Could not find base element in proposal")

    const baseChildrenAfter: Child[] = applyChanges(base.children, changes.base)
    const newBase = createNewProposalOrBaseWithBumpedRevision(base, baseChildrenAfter)

    const newBaseChildContainers = childContainersAfterChanges(
      proposal.base.container.children,
      baseChildrenAfter,
      changes.base,
    )
    const newBaseContainer = ElementContainer.fromDraftElement(newBase, newBaseChildContainers)
    changes.proposal.push({
      operation: "update",
      child: { key: baseChildKeyOnProposal, urn: newBase.urn },
      container: newBaseContainer,
    })
  }

  const childrenAfter: Child[] = applyChanges(proposal.element.children, changes.proposal)
  const newProposal = createNewProposalOrBaseWithBumpedRevision(proposal.element, childrenAfter)

  const newChildContainers = childContainersAfterChanges(proposal.container.children, childrenAfter, changes.proposal)
  const newProposalContainer = ElementContainer.fromDraftElement(newProposal, newChildContainers)
  return new ElementSnapshot(ElementSnapshotStatus.Draft, newProposalContainer, proposal.snapshot.nodes)
}

export type EditFunctions = {
  addElement(this: void, context: RootContext, child: Child, rootContainer: ElementContainer): void
  removeElement(this: void, context: RootContext, key: Child["key"]): void
  updateElement(this: void, context: RootContext, child: Child, rootContainer: ElementContainer): void
}
export type ChildChange = RemovedChild | UpdateOrAddChild
type UpdateOrAddChild = {
  operation: "update" | "add"
  child: Child
  container: ElementContainer
}
type RemovedChild = {
  operation: "remove"
  key: Child["key"]
}

function applyChanges(
  children: Child[] | undefined,
  changes: ({ operation: "remove"; key: Child["key"] } | { operation: "update" | "add"; child: Child })[],
): Child[] {
  return changes.reduce((acc, change) => {
    switch (change.operation) {
      case "remove":
        return applyRemove(acc, change.key)
      case "update":
        return applyUpdate(acc, change.child)
      case "add":
        return applyAdd(acc, change.child)
      default:
        return assertNever(change)
    }
  }, children ?? [])
}

function applyRemove(children: Child[], key: Child["key"]): Child[] {
  return children.filter((child) => child.key !== key)
}

function applyUpdate(children: Child[], child: Child): Child[] {
  return children.map((c) => (c.key === child.key ? child : c))
}

function applyAdd(children: Child[], child: Child): Child[] {
  return [child, ...children]
}

/** @internal */
export function editSnapshotWithNewProposal(snapshot: ElementSnapshot, newProposal: ElementContainer): ElementSnapshot {
  return new ElementSnapshot(
    newProposal.isServerState ? ElementSnapshotStatus.Persisted : ElementSnapshotStatus.Draft,
    newProposal,
    snapshot.nodes,
  )
}

/** @internal */
export function editSnapshotWithNewBase(proposal: Proposal, newBase: ElementContainer): ElementSnapshot {
  const existingBaseChild = proposal.base.node.child
  const newBaseChild = { ...existingBaseChild, urn: newBase.element.urn }
  const newProposalFromBase = createNewProposalFromNewBase(proposal.element, newBaseChild, existingBaseChild.key)
  const updatedProposalEl = {
    ...newProposalFromBase,
    urn: replaceRevision(proposal.urn, newUnusedProposalOrBaseRevision()),
  }
  const oldBase = proposal.base.container
  const children = [...proposal.container.children.filter((c) => c != oldBase), newBase]
  const updatedProposalContainer = ElementContainer.fromDraftElement(updatedProposalEl, children)
  return new ElementSnapshot(ElementSnapshotStatus.Draft, updatedProposalContainer, proposal.snapshot.nodes)
}
