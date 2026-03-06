import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath, mergePath, ROOT_KEY } from "src/lib/element/path"
import type { RootContext } from "./ChildNodeContainer"
import { ChildNodeContainer } from "./ChildNodeContainer"
import { ElementContainer } from "./ElementContainer"
import type { EditFunctions } from "./snapshot-helpers/editSnapshot"
import { editSnapshot } from "./snapshot-helpers/editSnapshot"
import { Matrix4 } from "three"
import { findBaseChild } from "src/lib/element/base"
import type { ElementSnapshotStatusKey } from "./ElementSnapshotStatus"
import { ElementSnapshotStatus } from "./ElementSnapshotStatus"
import type { ElementsValidationError } from "./validation/element-validation/types"
import { getInMapOrThrow } from "src/lib/map"
import moize from "moize"
import type { ChildNodePredicate } from "./predicates"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { withDerivedMethods } from "src/lib/element/lookup"
import type { FormaElementBox } from "src/lib/element/statebox"
import { Proposal } from "./Proposal"

const IDENTITY = new Matrix4()

export class ElementSnapshot {
  readonly rootUrn: Urn
  readonly status: ElementSnapshotStatusKey
  #childNodes: Map<InternalPath, ChildNodeContainer>

  readonly rootNode: ChildNodeContainer
  readonly validationErrors?: ElementsValidationError[]

  constructor(
    status: ElementSnapshotStatusKey,
    rootContainer: ElementContainer,
    previousNodes?: ReadonlyMap<InternalPath, ChildNodeContainer>,
    validationErrors?: ElementsValidationError[],
  ) {
    const rootUrn = rootContainer.element.urn

    this.rootUrn = rootUrn
    this.status = status
    this.#childNodes = new Map()

    this.validationErrors = validationErrors

    //console.log(`new ElementSnapshot (previousNodes: ${isDefined(previousNodes)})`)
    this.addChildNodesRecursive(
      ROOT_KEY,
      { urn: rootUrn, key: ROOT_KEY },
      rootContainer,
      IDENTITY,
      previousNodes ?? new Map([]),
      "proposal",
    )

    // These need to be called after building the tree structure with `addChildNodesRecursive`
    this.rootNode = getInMapOrThrow(this.#childNodes, ROOT_KEY)
  }

  #memoizedElements = moize(
    () =>
      new Map<Urn, ElementContainer>(
        [...this.#childNodes.values()].map((node) => [node.elementContainer.element.urn, node.elementContainer]),
      ),
  )
  get elements(): ReadonlyMap<Urn, ElementContainer> {
    return this.#memoizedElements()
  }

  private addChildNodesRecursive(
    path: InternalPath,
    child: Child,
    elementContainer: ElementContainer,
    parentMatrix: Matrix4,
    previousNodes: ReadonlyMap<InternalPath, ChildNodeContainer>,
    context: RootContext,
  ) {
    // If we find an identical node in the previous snapshot, we can reuse that node, however we need to still
    // iterate through children, as they might have been persisted in the meantime, meaning the node will be new
    const newNode: ChildNodeContainer =
      previousNodes?.has(path) &&
      previousNodes.get(path)!.canBeReused(path, child, elementContainer, parentMatrix, context)
        ? previousNodes.get(path)!
        : new ChildNodeContainer(path, child, elementContainer, parentMatrix, context)
    this.#childNodes.set(path, newNode)

    if (elementContainer.element.children) {
      // If the current element is the proposal, find the baseChild
      const baseChild = path === ROOT_KEY ? findBaseChild(elementContainer.element) : undefined

      elementContainer.element.children.forEach((child) => {
        const contextForChildren: RootContext = child === baseChild ? "base" : context
        const childContainer = getInMapOrThrow(elementContainer.childrenByUrn, child.urn)
        this.addChildNodesRecursive(
          mergePath(path, child.key),
          child,
          childContainer,
          newNode.globalMatrix,
          previousNodes,
          contextForChildren,
        )
      })
    }
  }

  getNode(path: InternalPath): ChildNodeContainer | undefined {
    return this.#childNodes.get(path)
  }

  getNodeOrThrow(path: InternalPath): ChildNodeContainer {
    return getInMapOrThrow(this.#childNodes, path)
  }

  getElementContainer(urn: Urn): ElementContainer | undefined {
    return this.elements.get(urn)
  }

  getElementContainerOrThrow(urn: Urn): ElementContainer {
    return getInMapOrThrow(this.elements, urn)
  }

  getFormaElement(urn: Urn): FormaElement | undefined {
    return this.elements.get(urn)?.element
  }

  getFormaElementOrThrow(urn: Urn): FormaElement {
    return getInMapOrThrow(this.elements, urn).element
  }

  getChildrenOfNode(node: ChildNodeContainer): ChildNodeContainer[] {
    const children = node.elementContainer.element.children ?? []
    return children.map((child) => this.getNode(mergePath(node.path, child.key))!)
  }

  getParentOfNode(node: ChildNodeContainer): ChildNodeContainer | undefined {
    const parentPath = getParentPath(node.path)
    if (!parentPath) return undefined
    return this.getNode(parentPath)
  }

  get nodes(): ReadonlyMap<InternalPath, ChildNodeContainer> {
    return this.#childNodes
  }

  edit(performEdit: (editFunctions: EditFunctions) => void): ElementSnapshot {
    return editSnapshot(Proposal.of(this), performEdit)
  }

  /**
   * Creates a new {@link ElementSnapshot} where {@link ElementContainer}s are updated with new persisted status.
   *
   * If snapshot does not include any of the persisted elements, it instead returns "this", as it is already up to date
   *
   * @param persistedElements The returned response from a save call
   * @param updatedContainers Map to keep track of already-udpated
   * containers across multiple calls to this function (for different snapshots). Will be mutated
   * @returns {ElementSnapshot}
   */
  cloneWithPersistedElements_INTERNAL(
    persistedElements: Map<Urn, FormaElement>,
    updatedContainers: Map<Urn, ElementContainer>,
  ): ElementSnapshot {
    // Rebuild the container tree while swapping all references to the old ElementContainers. By
    // storing references to the updated containers into the map passed into this function, we
    // ensure we don't get duplicate containers for same URN across multiple snapshots
    const snapshotElements = this.elements
    function updateContainer(urn: Urn): ElementContainer {
      if (updatedContainers.has(urn)) return getInMapOrThrow(updatedContainers, urn)

      const oldContainer = getInMapOrThrow(snapshotElements, urn)
      const persistedElement = persistedElements.get(urn)
      const needsUpdating =
        persistedElement ||
        oldContainer.element?.children?.some((child) => {
          const oldChildContainer = getInMapOrThrow(oldContainer.childrenByUrn, child.urn)
          const updatedChildContainer = updateContainer(child.urn)
          return updatedChildContainer !== oldChildContainer
        })
      if (!needsUpdating) {
        updatedContainers.set(urn, oldContainer)
        return oldContainer
      }

      const element = persistedElement || oldContainer.element
      const persisted = persistedElement || oldContainer.isServerState ? true : false
      const children = element.children?.map((child) => updateContainer(child.urn)) ?? []
      const updatedContainer = persisted
        ? ElementContainer.fromServerElement(element, children, oldContainer.representations, oldContainer.customData)
        : ElementContainer.fromDraftElement(element, children, oldContainer.representations, oldContainer.customData)
      updatedContainers.set(urn, updatedContainer)
      return updatedContainer
    }

    const updatedRootContainer = updateContainer(this.rootUrn)
    // Only construct new ElementSnapshot if the root container was updated
    if (updatedRootContainer === this.rootNode.elementContainer) return this
    return new ElementSnapshot(
      updatedRootContainer.isServerState ? ElementSnapshotStatus.Persisted : ElementSnapshotStatus.Draft,
      updatedRootContainer,
      this.nodes,
    )
  }

  traverseNodes(node: ChildNodeContainer, predicate: ChildNodePredicate): ChildNodeContainer[] {
    if (!predicate(node)) return []
    return [node, ...this.getChildrenOfNode(node).flatMap((childNode) => this.traverseNodes(childNode, predicate))]
  }

  /**
   * Traverse all nodes in the snapshot, depth-first, including the root node.
   */
  *traverseNodesDepthFirstIterable(): Iterable<ChildNodeContainer> {
    const self = this

    function* visit(node: ChildNodeContainer): Iterable<ChildNodeContainer> {
      yield node
      for (const childNode of self.getChildrenOfNode(node)) {
        yield* visit(childNode)
      }
    }

    yield* visit(this.rootNode)
  }

  getDescendantsOfNode(node: ChildNodeContainer): ChildNodeContainer[] {
    const result: ChildNodeContainer[] = []
    for (const childNode of this.getChildrenOfNode(node)) {
      result.push(childNode)
      result.push(...this.getDescendantsOfNode(childNode))
    }
    return result
  }

  getNodesWithAllDescendants(nodes: Iterable<ChildNodeContainer>): ChildNodeContainer[] {
    const result = new Set<ChildNodeContainer>()

    for (const node of nodes) {
      if (result.has(node)) continue

      result.add(node)
      for (const descendantNode of this.getDescendantsOfNode(node)) {
        result.add(descendantNode)
      }
    }

    return Array.from(result)
  }

  getFormaElementLookup(): FormaElementLookup {
    const self = this
    return withDerivedMethods({
      get(urn: Urn) {
        return self.elements.get(urn)?.element
      },
      *[Symbol.iterator]() {
        for (const container of self.elements.values()) {
          yield container.element
        }
      },
    })
  }

  getFormaElementBoxes(): Map<Urn, FormaElementBox> {
    const result = new Map<Urn, FormaElementBox>()
    for (const [urn, container] of this.elements) {
      result.set(urn, container.toFormaElementBox())
    }
    return result
  }

  get isPersisted() {
    return this.status === ElementSnapshotStatus.Persisted
  }
}
