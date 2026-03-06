import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { Signal } from "@preact/signals"
import { computed, signal } from "@preact/signals"
import { ElementContainer } from "./ElementContainer"
import { ElementSnapshot } from "./ElementSnapshot"
import type { EditFunctions } from "./snapshot-helpers/editSnapshot"
import {
  createNewProposalOrBaseWithBumpedRevision,
  editSnapshotWithNewBase,
  editSnapshotWithNewProposal,
} from "./snapshot-helpers/editSnapshot"
import { UndoRedo } from "./undo-redo"
import { ElementSnapshotStatus } from "./ElementSnapshotStatus"
import { Analytics, analyticsAndBreadcrumbsForActions } from "src/core/analytics"
import { parseUrn } from "src/lib/element/urn"
import { getInMapOrThrow } from "src/lib/map"
import { assertIsDefined } from "src/lib/assertions"
import { Proposal } from "./Proposal"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

/**
 * This class is the main state object managing all elements and revisions. You typically do not instantiate it yourself,
 * but use the globally instantiated {@link elementState elementState} variable.
 */
export class ElementState {
  #undoRedo: UndoRedo<Urn> = new UndoRedo()
  #knownSnapshots: Map<Urn, ElementSnapshot> = new Map()
  #currentSnapshot: Signal<ElementSnapshot | undefined> = signal()
  #EXPERIMENTAL_previewSnapshot: Signal<ElementSnapshot | undefined> = signal()

  /**
   * Returns the current {@link ElementSnapshot} as a signal, which is an immutable snapshot of the current element state.
   *
   * When doing a calculation, you always want to base that calculation on a specific {@link ElementSnapshot}, which
   * guarantees that all elements in the element tree are loaded and available, and that the state does not update during
   * your calculation
   *
   * ```ts
   * function myCalculation(snapshot: ElementSnapshot) {
   *    // Some calculation
   * }
   *
   * const snapshot = elementState.currentSnapshot.peek()
   * myCalculation(snapshot)
   * ```
   *
   * Avoid passing the whole elementState into a function, as `elementState.currentSnapshot.peek()` can resolve to different
   * values when called multiple times
   *
   * ```ts
   * const snapshotA = elementState.currentSnapshot.peek()
   *
   * // Some calculation
   *
   * const snapshotB = elementState.currentSnapshot.peek()
   *
   * assert(snapshotA === snapshotB) // Might fail
   * ```
   */
  // Lint override: Deferring this rename to a later time due
  // to the large impact of changes.
  // eslint-disable-next-line local/signals-explicit-naming
  currentSnapshot = computed<ElementSnapshot>(() => {
    return assertIsDefined("Initialization expected", this.#currentSnapshot.value)
  })

  EXPERIMENTAL_previewProposalSignal = computed<Proposal | undefined>(() => {
    const snapshot = this.#EXPERIMENTAL_previewSnapshot.value
    if (snapshot) {
      return Proposal.of(snapshot)
    }
    return undefined
  })

  /**
   * Current snapshot or undefined if it has not been initialized.
   */
  currentSnapshotOrUndefinedSignal = computed<ElementSnapshot | undefined>(() => {
    return this.#currentSnapshot.value
  })

  currentProposalSignal = computed<Proposal>(() => Proposal.of(this.currentSnapshot.value))
  currentBaseSignal = computed(() => this.currentProposalSignal.value.base)
  currentBasePathSignal = computed(() => this.currentBaseSignal.value.path)
  currentTerrainSignal = computed(() => this.currentProposalSignal.value.terrain)

  currentProposalIdSignal = computed(() => this.currentProposalSignal.value.id)
  currentProjectIdSignal = computed(() => {
    const authcontext = parseUrn(this.currentProposalSignal.value.urn).authcontext
    return authcontext
  })

  isInitializedSignal = computed(() => {
    return this.currentSnapshotOrUndefinedSignal.value != null
  })

  undo() {
    const oldSnapshotRootUrn = this.#undoRedo.undo()
    if (!oldSnapshotRootUrn) {
      return
    }
    const oldSnapshot = this.#knownSnapshots.get(oldSnapshotRootUrn)
    if (!oldSnapshot) {
      throw new Error(`Unknown snapshot ${oldSnapshotRootUrn}`)
    }
    this.#set(snapshotWithBumpedProposalAndBase(oldSnapshot, this.currentSnapshot.peek()))
    Analytics.track(EventName.Edit, {
      feature_category: FeatureCategory.DesignTool,
      feature: "undo",
    })
    analyticsAndBreadcrumbsForActions("undo")
  }

  redo() {
    const newSnapshotRootUrn = this.#undoRedo.redo()
    if (!newSnapshotRootUrn) {
      return
    }
    const newSnapshot = this.#knownSnapshots.get(newSnapshotRootUrn)
    if (!newSnapshot) {
      throw new Error(`Unknown snapshot ${newSnapshotRootUrn}`)
    }
    this.#set(snapshotWithBumpedProposalAndBase(newSnapshot, this.currentSnapshot.peek()))
    Analytics.track(EventName.Edit, {
      feature_category: FeatureCategory.DesignTool,
      feature: "redo",
    })
    analyticsAndBreadcrumbsForActions("redo")
  }

  canUndo() {
    return this.#undoRedo.canUndo()
  }

  canRedo() {
    return this.#undoRedo.canRedo()
  }

  edit(performEdit: (editFunctions: EditFunctions) => void): void {
    const prevSnapshot = this.currentSnapshot.peek()
    const newSnapshot = prevSnapshot.edit(performEdit)
    this.#undoRedo.push(newSnapshot.rootUrn)
    this.#set(newSnapshot)
  }

  preview(performEdit: (editFunctions: EditFunctions) => void): void {
    const prevSnapshot = this.currentSnapshot.peek()
    const newSnapshot = prevSnapshot.edit(performEdit)
    this.#set(newSnapshot, true)
  }

  resetPreview() {
    const currentPreview = this.#EXPERIMENTAL_previewSnapshot.peek()
    this.#EXPERIMENTAL_previewSnapshot.value = undefined
    if (currentPreview) {
      disposeUnusedDerivedData(currentPreview, this.currentSnapshot.peek())
    }
  }

  updateProposal(newProposal: ElementContainer) {
    const prevSnapshot = this.currentSnapshot.peek()
    const newSnapshot = editSnapshotWithNewProposal(prevSnapshot, newProposal)
    this.#undoRedo.push(newSnapshot.rootUrn)

    this.#set(newSnapshot)
  }

  updateBase(newBase: ElementContainer) {
    const prevSnapshot = this.currentSnapshot.peek()
    const newSnapshot = editSnapshotWithNewBase(Proposal.of(prevSnapshot), newBase)
    this.#undoRedo.push(newSnapshot.rootUrn)

    this.#set(newSnapshot)
  }

  #set(snapshot: ElementSnapshot, preview: boolean = false): this {
    if (this.#knownSnapshots.get(snapshot.rootUrn)?.status === ElementSnapshotStatus.Persisted) {
      console.log(this.#knownSnapshots)
      console.log(this.currentSnapshot.peek())
      console.log(snapshot)
      console.log(Date.now())
      throw new Error("Should not happen: Why are we overwriting a snapshot that's already persisted?")
    }
    this.#knownSnapshots.set(snapshot.rootUrn, snapshot)
    const currentSnapshot = this.currentSnapshotOrUndefinedSignal.peek()
    const nextSnapshot = snapshot
    if (preview) {
      this.#EXPERIMENTAL_previewSnapshot.value = snapshot
    } else {
      const currentPreviewSnapshot = this.#EXPERIMENTAL_previewSnapshot.peek()
      if (currentPreviewSnapshot) {
        disposeUnusedDerivedData(currentPreviewSnapshot, nextSnapshot)
      }
      this.#EXPERIMENTAL_previewSnapshot.value = undefined

      this.#currentSnapshot.value = snapshot
      if (currentSnapshot) {
        disposeUnusedDerivedData(currentSnapshot, nextSnapshot)
      }
    }

    return this
  }

  reset(snapshot: ElementSnapshot): this {
    this.#undoRedo.clear()
    this.#knownSnapshots.clear()
    this.#set(snapshot)
    this.#undoRedo.push(snapshot.rootUrn)
    return this
  }

  /**
   * Update all snapshots with a response from a save call
   *
   * @internal
   */
  updateElementStateFromSaveResponse_INTERNAL(persistedElements: Map<Urn, FormaElement>) {
    const updatedContainers: Map<Urn, ElementContainer> = new Map()
    for (const [urn, snapshot] of this.#knownSnapshots) {
      const nextSnapshot = snapshot.cloneWithPersistedElements_INTERNAL(persistedElements, updatedContainers)
      this.#knownSnapshots.set(urn, nextSnapshot)
      disposeUnusedDerivedData(snapshot, nextSnapshot)
    }
    this.#currentSnapshot.value = getInMapOrThrow(this.#knownSnapshots, this.currentSnapshot.peek().rootUrn)
  }

  get knownSnapshots_onlyForTesting(): ReadonlyMap<Urn, ElementSnapshot> {
    return this.#knownSnapshots
  }
}

/**
 * Used to make sure proposal and base is bumped when undoing and redoing.
 * This must be done because both the proposal and the base is made sure to be pinned on their latest revisions when
 * initializing a proposal
 * @param nextSnapshot The snapshot to undo or redo to.
 * @param currentSnapshot The snapshot that is in effect before the undo/redo operation is performed
 */
function snapshotWithBumpedProposalAndBase(
  nextSnapshot: ElementSnapshot,
  currentSnapshot: ElementSnapshot,
): ElementSnapshot {
  const nextProposal = Proposal.of(nextSnapshot)
  const currentProposal = Proposal.of(currentSnapshot)

  const newBaseContainer = hasBaseBeenEdited(nextProposal, currentProposal)
    ? ElementContainer.fromDraftElement(
        createNewProposalOrBaseWithBumpedRevision(nextProposal.base.element),
        nextProposal.base.container.children,
      )
    : undefined
  const newProposalChildren = newBaseContainer
    ? nextProposal.element.children?.map((c) =>
        c.key === nextProposal.base.node.child.key
          ? { ...nextProposal.base.node.child, urn: newBaseContainer.element.urn }
          : c,
      )
    : undefined
  const newProposalChildContainers = newBaseContainer
    ? nextProposal.container.children.map((childContainer) =>
        childContainer === nextProposal.base.container ? newBaseContainer : childContainer,
      )
    : nextProposal.container.children
  const newProposal = createNewProposalOrBaseWithBumpedRevision(nextProposal.element, newProposalChildren)

  const newProposalContainer = ElementContainer.fromDraftElement(newProposal, newProposalChildContainers)
  return new ElementSnapshot(ElementSnapshotStatus.Draft, newProposalContainer)
}

function hasBaseBeenEdited(nextProposal: Proposal, currentProposal: Proposal) {
  if (nextProposal.base.elementId !== currentProposal.base.elementId) {
    //Base has not been edited – it has been swapped with another one.
    return false
  }
  return nextProposal.base.element.urn !== currentProposal.base.element.urn
}

/**
 * The global instance of {@link ElementState}. See {@link ElementState} for usage
 * @type {ElementState}
 *
 */
export const elementState = new ElementState()

function disposeUnusedDerivedData(currentSnapshot: ElementSnapshot, nextSnapshot: ElementSnapshot) {
  if (currentSnapshot === nextSnapshot) return
  for (const [urn, container] of currentSnapshot.elements.entries()) {
    if (!nextSnapshot.elements.has(urn)) {
      container.derivedDataDisposables.dispose()
    }
  }
  for (const [path, node] of currentSnapshot.nodes.entries()) {
    const nextNode = nextSnapshot.getNode(path)
    if (!(nextNode && nextNode === node)) {
      node.derivedDataDisposables.dispose()
    }
  }
}
