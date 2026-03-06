import { ElementState } from "./ElementState"
import { createUrn, parseUrn, replaceRevision } from "src/lib/element/urn"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import type { Child, FormaElement, Urn } from "@spacemakerai/element-types"
import { computed, effect } from "@preact/signals"
import { ElementContainer } from "./ElementContainer"
import { beforeEach, describe, expect, it, onTestFinished, test, vitest } from "vitest"
import { ElementSnapshot } from "./ElementSnapshot"
import { editSnapshotWithNewBase, onlyForTesting } from "./snapshot-helpers/editSnapshot"
import { findBaseChild, findBasePath } from "src/lib/element/base"
import { ElementSnapshotStatus } from "./ElementSnapshotStatus"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import { getInMapOrThrow } from "src/lib/map"
import {
  createProposalForSnapshotForTest,
  createRepresentationsByUrnForTest,
  dummyBaseElementChild,
  dummyBaseElementContainer,
  dummyTerrainElement,
  dummyTerrainElementChild,
  dummyTerrainElementContainer,
  elementContainerTreeFromObjectsForTest,
  proposalPropertiesForBase,
} from "./testUtils"
import { Proposal } from "./Proposal"

const ROOT_URN = createUrn("proposal", "test", "id", "0")
const CHILD_URN_A = createUrn("child", "test", "childA", "0")
const BASE_URN_A = createUrn("group", "test", "baseA", "0")
const BASE_CHILD_KEY = "baseKey1234"

declare module "vitest" {
  interface TestContext {
    state?: ElementState
  }
}

describe("ElementStateV3", () => {
  it("should be possible to create state", () => {
    const state = new ElementState().reset(
      new ElementSnapshot(
        ElementSnapshotStatus.Persisted,
        elementContainerTreeFromObjectsForTest(
          ROOT_URN,
          createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
          createRepresentationsByUrnForTest(),
        ),
      ),
    )

    expect(state).toBeInstanceOf(ElementState)
    expect(state.currentSnapshot.value.elements.size).toEqual(3)
    expect(state.currentSnapshot.value.nodes.size).toEqual(3)

    expect(state.currentSnapshot.value.elements.get(ROOT_URN)?.element.urn).toEqual(ROOT_URN)
    expect(state.currentSnapshot.value.getNode(ROOT_KEY)).toBeDefined()
    expect(state.currentSnapshot.value.getNode(ROOT_KEY)?.child.urn).toEqual(ROOT_URN)
  })

  it("should be possible to traverse childNodes", () => {
    const state = new ElementState().reset(
      new ElementSnapshot(
        ElementSnapshotStatus.Persisted,
        elementContainerTreeFromObjectsForTest(
          ROOT_URN,
          createElementBoxMapFromDraftElements(
            createProposalForSnapshotForTest({
              urn: ROOT_URN,
              children: [
                { key: "child1", urn: CHILD_URN_A },
                { key: "child2", urn: CHILD_URN_A },
              ],
            }),
            { urn: CHILD_URN_A },
          ),
          createRepresentationsByUrnForTest(),
        ),
      ),
    )

    const ss = state.currentSnapshot.value

    expect(ss.elements.size).toEqual(4)
    expect(ss.nodes.size).toEqual(5)

    const rootNode = ss.getNode(ROOT_KEY)!
    expect(ss.getChildrenOfNode(rootNode)).toHaveLength(4)
    const firstChildNode = ss.getChildrenOfNode(rootNode)[0]
    expect(firstChildNode).toBeDefined()
    expect(ss.getParentOfNode(firstChildNode)).toEqual(rootNode)

    expect(ss.getParentOfNode(ss.getChildrenOfNode(rootNode)[0])).toEqual(rootNode)
  })

  describe("editing", () => {
    it("should be possible to add elements to proposal", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const urn = createUrn("child", "test", "child1", "0")
      const element: FormaElement = { urn: urn }
      const child: Child = { key: "child1", urn: urn }

      // TODO: What about persisted if element already in state
      const container = ElementContainer.fromServerElement(element)

      // TODO: Feels weird about side effect here
      // Get new state instance back?
      // Nice to still be able to get back old state
      // Preview functionality
      state.edit(({ addElement }) => addElement("proposal", child, container))

      // const newState = state.edit((editAPI) => {
      //   editAPI.addElement()
      //   editAPI.updateElement()
      // })
      // setState(newState)

      expect(state.currentSnapshot.value.elements.size).toEqual(4)
      expect(state.currentSnapshot.value.rootUrn).not.toEqual(ROOT_URN)
      expect(state.currentSnapshot.value.getNode(ROOT_KEY)?.child.urn).toEqual(state.currentSnapshot.value.rootUrn)

      const node = state.currentSnapshot.value.getNode(mergePath(ROOT_KEY, "child1"))
      expect(node).toBeDefined()
    })

    it("should be possible to add subtree to proposal", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const grandChildElement = { urn: createUrn("dummy", "dummy", "grandchild", "0") }
      const childElement: FormaElement = {
        urn: createUrn("dummy", "dummy", "child", "0"),
        children: [{ urn: grandChildElement.urn, key: "grandchild" }],
      }

      const grandChildContainer = ElementContainer.fromDraftElement(grandChildElement, [])
      const childContainer = ElementContainer.fromDraftElement(childElement, [grandChildContainer])
      state.edit(({ addElement }) => addElement("proposal", { key: "child", urn: childElement.urn }, childContainer))

      expect(state.currentSnapshot.value.elements.size).toEqual(5)
      expect(state.currentSnapshot.value.nodes.size).toEqual(5)

      /**
       * Current interface is ElementContainer
       * Want to reuse child, as it is not changed
       */
    })

    it("should be possible to update a subtree on proposal with pure elements", () => {
      // -- create initial tree --
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const container = myCustomDomainLogicCreate()
      state.edit(({ addElement }) => addElement("proposal", { key: "child", urn: container.element.urn }, container))

      // --update tree --

      const newContainer = myCustomDomainLogicUpdate2(state)
      state.edit(({ updateElement }) =>
        updateElement("proposal", { key: "child", urn: newContainer.element.urn }, newContainer),
      )

      expect(
        state.currentSnapshot.value.getNode(mergePath(ROOT_KEY, "child"))?.elementContainer?.element.children,
      ).toHaveLength(2)
    })

    it("should be possible to update a subtree on proposal with elementContainers", () => {
      // -- create initial tree --
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const container = myCustomDomainLogicCreate()
      state.edit(({ addElement }) => addElement("proposal", { key: "child", urn: container.element.urn }, container))

      // --update tree --

      const newContainer = myCustomDomainLogicUpdate(state)
      const newRootUrn = newContainer.element.urn
      state.edit(({ updateElement }) => updateElement("proposal", { key: "child", urn: newRootUrn }, newContainer))

      expect(state.currentSnapshot.value.elements.get(newRootUrn)?.representations.volumeMesh).not.toBeDefined()
      //console.log(state.currentSnapshot.getChildNode(mergePath(ROOT_KEY, "child"))?.elementContainer?.element)
      expect(
        state.currentSnapshot.value.getNode(mergePath(ROOT_KEY, "child"))?.elementContainer?.element.children,
      ).toHaveLength(2)
    })

    it("should be possible to remove elements from proposal", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(
              createProposalForSnapshotForTest({
                urn: ROOT_URN,
                children: [
                  { key: "child1", urn: CHILD_URN_A },
                  { key: "child2", urn: CHILD_URN_A },
                ],
              }),
              { urn: CHILD_URN_A },
            ),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      state.edit(({ removeElement }) => removeElement("proposal", "child1"))

      expect(state.currentSnapshot.value.elements.size).toEqual(4)
      expect(state.currentSnapshot.value.rootUrn).not.toEqual(ROOT_URN)
      expect(state.currentSnapshot.value.rootNode.element.children).toHaveLength(3)
      expect(
        state.currentSnapshot.value.getChildrenOfNode(state.currentSnapshot.value.getNode(ROOT_KEY)!),
      ).toHaveLength(3)
    })

    it("should be possible to update elements on proposal", () => {
      const child = { urn: CHILD_URN_A }

      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(
              createProposalForSnapshotForTest({
                urn: ROOT_URN,
                children: [
                  { key: "child1", urn: CHILD_URN_A },
                  { key: "child2", urn: CHILD_URN_A },
                ],
              }),
              child,
            ),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const container = getInMapOrThrow(state.currentSnapshot.value.elements, CHILD_URN_A)

      const newUrn = replaceRevision(child.urn)
      const newContainer = ElementContainer.fromDraftElement(
        {
          ...child,
          urn: newUrn,
          properties: { answer: 42 },
        },
        undefined,
        container.representations,
      )

      state.edit(({ updateElement }) => updateElement("proposal", { key: "child1", urn: newUrn }, newContainer))

      expect(state.currentSnapshot.value.elements.size).toEqual(5)
      expect(state.currentSnapshot.value.rootUrn).not.toEqual(ROOT_URN)
      expect(state.currentSnapshot.value.rootNode.element.children).toHaveLength(4)
      expect(
        state.currentSnapshot.value.getChildrenOfNode(state.currentSnapshot.value.getNode(ROOT_KEY)!),
      ).toHaveLength(4)

      expect(state.currentSnapshot.value.getNode(mergePath(ROOT_KEY, "child1"))?.child.urn).toEqual(newUrn)
      expect(state.currentSnapshot.value.elements.get(newUrn)).toBeDefined()
    })
  })

  describe("listening to changes in state", () => {
    it("should be possible for rootUrn", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      const rootUrnSignal = computed(() => {
        return state.currentSnapshot.value.rootUrn
      })
      expect(rootUrnSignal.value).toEqual(state.currentSnapshot.value.rootUrn)
      const child = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, child))
      expect(rootUrnSignal.value).not.toEqual(ROOT_URN)
    })

    it("should be possible for proposal children", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      const childrenSignal = computed(() => {
        return state.currentSnapshot.value.rootNode.element.children
      })
      expect(childrenSignal.value).toHaveLength(2)
      const child = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, child))
      expect(childrenSignal.value).toBeDefined()
      expect(childrenSignal.value).toHaveLength(3)
    })
  })

  describe("syncing from design mode", () => {
    it("should update the element tree correctly", () => {
      const firstStateRootUrn = createUrn("proposal", "test", "id", "0")
      const firstStateChildUrn = createUrn("child", "test", "childA", "0")
      const firstState = createElementBoxMapFromDraftElements(
        createProposalForSnapshotForTest({
          urn: firstStateRootUrn,
          children: [{ key: "child", urn: firstStateChildUrn }],
        }),
        { urn: firstStateChildUrn },
      )
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(firstStateRootUrn, firstState, createRepresentationsByUrnForTest()),
        ),
      )

      const secondStateRootUrn = createUrn("proposal", "test", "id", "1")
      const secondStateChildUrn = createUrn("child", "test", "childA", "1")
      const secondStateChild2Urn = createUrn("child", "test", "childB", "0")
      const secondState = createElementBoxMapFromDraftElements(
        createProposalForSnapshotForTest({
          urn: secondStateRootUrn,
          children: [
            { key: "child", urn: secondStateChildUrn },
            { key: "child2", urn: secondStateChild2Urn },
          ],
        }),
        { urn: secondStateChildUrn },
        { urn: secondStateChild2Urn },
      )
      state.reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(secondStateRootUrn, secondState, createRepresentationsByUrnForTest()),
        ),
      )
      expect(state.currentSnapshot.value.rootUrn).toEqual(secondStateRootUrn)
      expect(state.currentSnapshot.value.elements.get(secondStateChildUrn)).toBeDefined()
      expect(state.currentSnapshot.value.elements.get(secondStateChild2Urn)).toBeDefined()
      expect(state.currentSnapshot.value.elements.size).toEqual(5)
    })
  })

  describe("subscription", () => {
    it("should only run subscription callback the expected number of times", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Draft,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const callbackCounter = vitest.fn()

      state.currentSnapshot.subscribe(callbackCounter)
      expect(callbackCounter).toHaveBeenCalledTimes(1)

      const childA = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, childA))
      expect(callbackCounter).toHaveBeenCalledTimes(2)
    })

    it("should update representation signals when mutated", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Draft,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(
              createProposalForSnapshotForTest({ urn: ROOT_URN }),
              createRepresentationsByUrnForTest(),
            ),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const callbackCounter = vitest.fn()

      const exampleSignal = computed(() => {
        // Return an object to force an output change whenever the effect runs.
        return {
          result: state.currentSnapshot.value.elements.get(CHILD_URN_A)?.representations.volumeMesh,
        }
      })

      const unsubscribe = exampleSignal.subscribe(callbackCounter)
      onTestFinished(() => unsubscribe())

      expect(callbackCounter).toHaveBeenCalledTimes(1)

      const childA = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, childA))
      expect(callbackCounter).toHaveBeenCalledTimes(2)
    })
  })

  describe("undo/redo", () => {
    it("undo should give last state with updated revision", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(
              createProposalForSnapshotForTest({ urn: ROOT_URN }),
              createRepresentationsByUrnForTest(),
            ),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      const child = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, child))
      state.undo()
      const parsedRootUrn = parseUrn(state.currentSnapshot.value.rootUrn)
      expect(parsedRootUrn.id).toEqual(parseUrn(ROOT_URN).id)
      expect(parsedRootUrn.revision).not.toEqual(parseUrn(ROOT_URN).revision)
    })
    it("undo should give last state with updated revision on base if base had changes", () => {
      const baseElement = { urn: BASE_URN_A }
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(
              {
                urn: ROOT_URN,
                children: [{ key: BASE_CHILD_KEY, urn: baseElement.urn }, dummyTerrainElementChild],
                properties: { flags: { [BASE_CHILD_KEY]: { scenario: true } } },
              },
              baseElement,
              dummyTerrainElement,
            ),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      const newChildOfBase = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      const newBaseElement = {
        ...baseElement,
        urn: replaceRevision(baseElement.urn, "1"),
        children: [{ urn: CHILD_URN_A, key: BASE_CHILD_KEY }],
      }
      const newBase = ElementContainer.fromDraftElement(newBaseElement, [newChildOfBase])
      state.updateBase(newBase)
      state.undo()
      const startBaseUrn = parseUrn(BASE_URN_A)
      const baseUrnAfterUndo = parseUrn(state.currentProposalSignal.value.base.urn)
      expect(baseUrnAfterUndo).not.toEqual(newBaseElement.urn)
      expect(baseUrnAfterUndo.id).toEqual(startBaseUrn.id)
      expect(baseUrnAfterUndo.revision).not.toEqual(startBaseUrn.revision)
    })
    it("undo should not undo past the first state", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      state.undo()
      expect(state.currentSnapshot.value.rootUrn).toEqual(ROOT_URN)
      state.undo()
    })
    it("redo should give next state", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      const child = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, child))
      state.undo()
      state.redo()
      expect(state.currentSnapshot.value.rootUrn).not.toEqual(ROOT_URN)
      expect(state.currentSnapshot.value.elements.get(CHILD_URN_A)).toEqual(child)
    })
    it("redo should not redo past the last state", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      state.redo()
      expect(state.currentSnapshot.value.rootUrn).toEqual(ROOT_URN)
      state.redo()
      expect(state.currentSnapshot.value.rootUrn).toEqual(ROOT_URN)
    })
    it("adding to state after undo should remove redo states", () => {
      const START_ROOT_URN = replaceRevision(ROOT_URN, onlyForTesting.newUnusedProposalOrBaseRevision())
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            START_ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: START_ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      const child = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      const child2 = ElementContainer.fromDraftElement({ urn: createUrn("child", "test", "child200", "0") })
      state.edit(({ addElement }) => addElement("proposal", { key: "child1", urn: CHILD_URN_A }, child))
      state.undo()
      state.edit(({ addElement }) => addElement("proposal", { key: "child200", urn: child2.element.urn }, child2))
      const rootUrn4 = state.currentSnapshot.value.rootUrn
      state.redo() // Should not do anything
      const rootUrn5 = state.currentSnapshot.value.rootUrn

      expect(rootUrn4).toEqual(rootUrn5)
    })
    test("should be able to undo saved state", () => {
      const childInit = ElementContainer.fromServerElement({ urn: createUrn("child", "test", "childA", "0") })
      const proposal = ElementContainer.fromServerElement(
        {
          urn: createUrn("proposal", "test", "id", "0"),
          children: [{ key: "childA", urn: childInit.element.urn }, dummyBaseElementChild, dummyTerrainElementChild],
          properties: proposalPropertiesForBase(dummyBaseElementChild.key),
        },
        [childInit, dummyBaseElementContainer, dummyTerrainElementContainer],
      )

      const childEdited = ElementContainer.fromDraftElement({ urn: createUrn("child", "test", "childA", "1") })

      // Initial state
      const state = new ElementState().reset(new ElementSnapshot(ElementSnapshotStatus.Persisted, proposal))

      // Updating the child
      state.edit(({ updateElement }) => {
        updateElement("proposal", { key: "childA", urn: childEdited.element.urn }, childEdited)
      })

      expect(state.currentSnapshot.value.elements.get(childEdited.element.urn)).toEqual(childEdited)
      expect(state.currentSnapshot.value.elements.get(childInit.element.urn)).toBeUndefined()
      expect(state.currentSnapshot.value.elements.get(childEdited.element.urn)?.isServerState).toEqual(false)

      // Saving lands
      const containers = [state.currentSnapshot.value.rootNode.elementContainer, childEdited]
      const saveResponses: Map<Urn, FormaElement> = new Map(containers.map((c) => [c.element.urn, c.element]))
      state.updateElementStateFromSaveResponse_INTERNAL(saveResponses)

      // Undoing
      state.undo()

      // State should equal initial state, except proposal should have bumped revision
      expect(state.currentSnapshot.value.rootNode.elementContainer.isServerState).toEqual(false)
      expect(state.currentSnapshot.value.elements.get(childInit.element.urn)).toBeDefined()
      expect(state.currentSnapshot.value.elements.get(childInit.element.urn)?.isServerState).toEqual(true)
    })
  })
  describe("batch edit", () => {
    it("should do several operations and update proposal once", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )

      let hasBeenRun = 0
      effect(() => {
        //Do not run on initial state
        if (state.currentSnapshot.value.rootUrn !== ROOT_URN) {
          hasBeenRun = hasBeenRun + 1
        }
      })
      state.edit(({ addElement }) => {
        addElement(
          "proposal",
          { key: "child1", urn: CHILD_URN_A },
          ElementContainer.fromDraftElement({ urn: CHILD_URN_A }),
        )
        addElement(
          "proposal",
          { key: "child2", urn: createUrn("child", "test", "child2", "0") },
          ElementContainer.fromDraftElement({ urn: createUrn("child", "test", "child2", "0") }),
        )
      })
      expect(hasBeenRun).toEqual(1)
    })
    it("should delete an element after it's added if a user instructs it to", () => {
      const state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(
            ROOT_URN,
            createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
            createRepresentationsByUrnForTest(),
          ),
        ),
      )
      state.edit(({ addElement, removeElement }) => {
        addElement(
          "proposal",
          { key: "child1", urn: CHILD_URN_A },
          ElementContainer.fromDraftElement({ urn: CHILD_URN_A }),
        )
        removeElement("proposal", "child1")
      })
      expect(state.currentSnapshot.value.elements.get(CHILD_URN_A)).toBeUndefined()
    })
  })
  describe("base", () => {
    beforeEach((context) => {
      const elements = createElementBoxMapFromDraftElements(
        {
          urn: ROOT_URN,
          children: [
            { key: "child1", urn: CHILD_URN_A },
            { key: BASE_CHILD_KEY, urn: BASE_URN_A },
            dummyTerrainElementChild,
          ],
          properties: {
            flags: {
              [BASE_CHILD_KEY]: {
                base: true,
                scenario: true,
                fixed: true,
                lock: true,
              },
            },
          },
        },
        { urn: CHILD_URN_A },
        { urn: BASE_URN_A },
        dummyTerrainElement,
      )
      context.state = new ElementState().reset(
        new ElementSnapshot(
          ElementSnapshotStatus.Persisted,
          elementContainerTreeFromObjectsForTest(ROOT_URN, elements, createRepresentationsByUrnForTest()),
        ),
      )
    })
    const expectUrnToHaveBumpedRevision = (oldUrn: Urn, newUrn: Urn) => {
      const a = parseUrn(oldUrn)
      const b = parseUrn(newUrn)
      expect(a.system).toEqual(b.system)
      expect(a.authcontext).toEqual(b.authcontext)
      expect(a.id).toEqual(b.id)
      expect(parseInt(a.revision)).toBeLessThan(parseInt(b.revision))
    }
    it("should not be possible to add proposal child with same key as base element", ({ state }) => {
      expect(() => {
        state!.edit(({ addElement }) => {
          addElement(
            "proposal",
            { key: BASE_CHILD_KEY, urn: CHILD_URN_A },
            getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
          )
        })
      }).toThrow()
    })
    it("should not be possible to update base element through normal edit API", ({ state }) => {
      expect(() => {
        state!.edit(({ updateElement }) => {
          updateElement(
            "proposal",
            { key: BASE_CHILD_KEY, urn: CHILD_URN_A },
            getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
          )
        })
      }).toThrow()
    })
    it("should not be possible to remove base element through normal edit API", ({ state }) => {
      expect(() => {
        state!.edit(({ removeElement }) => {
          removeElement("proposal", BASE_CHILD_KEY)
        })
      }).toThrow()
    })
    it("adding child to base should bump base and proposal URN", ({ state }) => {
      state!.edit(({ addElement }) => {
        addElement(
          "base",
          { key: "child1", urn: CHILD_URN_A },
          getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
        )
      })
      expectUrnToHaveBumpedRevision(ROOT_URN, state!.currentSnapshot.value.rootUrn)
      const baseChild = findBaseChild(state!.currentSnapshot.value.rootNode.element)
      expectUrnToHaveBumpedRevision(BASE_URN_A, baseChild!.urn)
    })
    it("should be possible to edit both base and proposal children simultaneously", ({ state }) => {
      state!.edit(({ addElement, updateElement, removeElement }) => {
        addElement(
          "base",
          { key: "child1", urn: CHILD_URN_A },
          getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
        )
        addElement(
          "base",
          { key: "child2", urn: CHILD_URN_A },
          getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
        )
        addElement(
          "proposal",
          { key: "child2", urn: CHILD_URN_A },
          getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
        )
        removeElement("base", "child2")
        updateElement(
          "proposal",
          { key: "child1", urn: CHILD_URN_A },
          getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
        )
      })
      expectUrnToHaveBumpedRevision(ROOT_URN, state!.currentSnapshot.value.rootUrn)
      const proposalElement = state!.currentSnapshot.value.rootNode.element
      expectUrnToHaveBumpedRevision(BASE_URN_A, findBaseChild(proposalElement)!.urn)
      const basePath = findBasePath(proposalElement)
      const baseElement = state!.currentSnapshot.value.getNode(basePath!)?.elementContainer.element
      expect(proposalElement.children?.length).toEqual(4) // base + terrain + child1 + child2
      expect(baseElement?.children?.length).toEqual(1) // child1
    })
    it("should be possible to replace the base element", ({ state }) => {
      const newBaseUrn = replaceRevision(BASE_URN_A, "1000")
      const newBaseElement: FormaElement = {
        urn: newBaseUrn,
        properties: { name: "Base name ABC" },
        children: [{ key: "child100", urn: CHILD_URN_A }],
      }

      // Check that creating new base fails if we don't provide containers for all children
      expect(() => ElementContainer.fromDraftElement(newBaseElement)).toThrow()

      // Check that updating base correctly works as expected
      const baseChildren = [getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A)]
      const newBaseContainer = ElementContainer.fromDraftElement(newBaseElement, baseChildren)
      const newSnapshot = editSnapshotWithNewBase(Proposal.of(state!.currentSnapshot.value), newBaseContainer)
      expect(newSnapshot).not.toBe(state!.currentSnapshot.value) // updateBase returns new snapshot without setting it
      expectUrnToHaveBumpedRevision(ROOT_URN, newSnapshot.rootUrn)

      // Accessing base by using findBaseChild (uses the proposal's children list)
      const proposalElement = newSnapshot.rootNode.element
      const baseChildOnProposal = findBaseChild(proposalElement)!
      expect(baseChildOnProposal.urn).toBe(newBaseUrn)
      const basePathA = mergePath(ROOT_KEY, baseChildOnProposal.key)
      const baseElementA = newSnapshot.getNode(basePathA)!.elementContainer.element
      expect(baseElementA).toBe(newBaseElement)

      // Accessing base by using findBasePath (uses properties.flags on the proposal element)
      const basePathB = findBasePath(proposalElement)
      expect(basePathB).toBe(basePathA)

      // Old base element should be gone
      const oldBaseElementContainer = newSnapshot.elements.get(BASE_URN_A)
      expect(oldBaseElementContainer).toBeUndefined()

      // Get the base's child element
      const childAElementOfProposal = newSnapshot.getNode(mergePath(ROOT_KEY, "child1"))! // added in beforeEach above
      const childAElementOfBase = newSnapshot.getNode(mergePath(basePathA, "child100"))!
      expect(childAElementOfBase.elementContainer).toBe(childAElementOfProposal.elementContainer)
    })
    it("should be possible to do changes to base via ElementState for undo/redo, which will bump base revision", ({
      state,
    }) => {
      const newBaseUrn = replaceRevision(BASE_URN_A, "1000")
      const newBaseElement: FormaElement = {
        urn: newBaseUrn,
        properties: { name: "Base name ABC" },
        children: [{ key: "child100", urn: CHILD_URN_A }],
      }
      const baseChildren = [getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A)]
      const newBaseContainer = ElementContainer.fromDraftElement(newBaseElement, baseChildren)

      state!.updateBase(newBaseContainer)
      const rootUrn2 = state!.currentSnapshot.value.rootUrn
      const baseUrn2 = findBaseChild(state!.currentSnapshot.value.rootNode.element)!.urn
      expectUrnToHaveBumpedRevision(ROOT_URN, rootUrn2)
      expectUrnToHaveBumpedRevision(BASE_URN_A, baseUrn2)

      state!.undo()
      const rootUrn3 = state!.currentSnapshot.value.rootUrn
      const baseUrn3 = findBaseChild(state!.currentSnapshot.value.rootNode.element)!.urn
      expectUrnToHaveBumpedRevision(rootUrn2, rootUrn3)
      expectUrnToHaveBumpedRevision(baseUrn2, baseUrn3)

      state!.redo()
      const rootUrn4 = state!.currentSnapshot.value.rootUrn
      const baseUrn4 = findBaseChild(state!.currentSnapshot.value.rootNode.element)!.urn
      expectUrnToHaveBumpedRevision(rootUrn3, rootUrn4)
      expectUrnToHaveBumpedRevision(baseUrn3, baseUrn4)
    })
    it("should be possible to swap base via ElementState for undo/redo, which should not bump revision", ({
      state,
    }) => {
      const BASE_URN_B = createUrn("group", "test", "baseB", "0")
      const newBaseElement: FormaElement = {
        urn: BASE_URN_B,
        properties: { name: "Base name ABC" },
        children: [{ key: "child100", urn: CHILD_URN_A }],
      }

      state!.updateBase(
        ElementContainer.fromDraftElement(newBaseElement, [
          getInMapOrThrow(state!.currentSnapshot.value.elements, CHILD_URN_A),
        ]),
      )
      const rootUrn2 = state!.currentSnapshot.value.rootUrn
      const baseUrn2 = findBaseChild(state!.currentSnapshot.value.rootNode.element)!.urn
      expectUrnToHaveBumpedRevision(ROOT_URN, rootUrn2)
      expect(baseUrn2).toEqual(BASE_URN_B)

      state!.undo()
      const rootUrn3 = state!.currentSnapshot.value.rootUrn
      const baseUrn3 = findBaseChild(state!.currentSnapshot.value.rootNode.element)!.urn
      expectUrnToHaveBumpedRevision(rootUrn2, rootUrn3)
      expect(baseUrn3).toEqual(BASE_URN_A)

      state!.redo()
      const rootUrn4 = state!.currentSnapshot.value.rootUrn
      const baseUrn4 = findBaseChild(state!.currentSnapshot.value.rootNode.element)!.urn
      expectUrnToHaveBumpedRevision(rootUrn3, rootUrn4)
      expect(baseUrn4).toEqual(BASE_URN_B)
    })
    it("should not be possible to replace base element with an invalid subtree", ({ state }) => {
      const unknownElementUrn = replaceRevision(CHILD_URN_A, "5000")
      const newBaseUrn = replaceRevision(BASE_URN_A, "2000")
      const newBaseElement: FormaElement = {
        urn: newBaseUrn,
        properties: { name: "Base name ABC" },
        children: [
          { key: "child100", urn: unknownElementUrn },
          { key: "child200", urn: unknownElementUrn },
        ],
      }
      expect(() => {
        editSnapshotWithNewBase(
          Proposal.of(state!.currentSnapshot.value),
          ElementContainer.fromDraftElement(newBaseElement),
        )
      }).toThrow()
    })
  })
})

const initialChild: Urn = createUrn("dummy", "dummy", "child", "0")

function myCustomDomainLogicCreate(): ElementContainer {
  const grandChildElement = { urn: createUrn("dummy", "dummy", "grandchild", "0") }
  const grandChildContainer = ElementContainer.fromDraftElement(grandChildElement, [])
  const childElement: FormaElement = {
    urn: initialChild,
    children: [{ urn: grandChildElement.urn, key: "grandchild" }],
  }
  const childContainer = ElementContainer.fromDraftElement(childElement, [grandChildContainer])
  return childContainer
}

/**
 * Adds a new grandchild, keep existing grandchild
 * */
function myCustomDomainLogicUpdate(state: ElementState): ElementContainer {
  const parentContainer = getInMapOrThrow(state.currentSnapshot.peek().elements, initialChild)

  const grandChild2ContainerElement = ElementContainer.fromDraftElement({
    urn: createUrn("dummy", "dummy", "grandchild-2", "0"),
  })

  const newParentContainerElement = ElementContainer.fromDraftElement(
    {
      ...parentContainer.element,
      urn: replaceRevision(parentContainer.element.urn, "newRevision"),
      children: [
        ...(parentContainer.element.children ?? []),
        { key: "grandchild-2", urn: grandChild2ContainerElement.element.urn },
      ],
    },
    [...parentContainer.children, grandChild2ContainerElement],
    parentContainer.representations,
  )

  return newParentContainerElement
}

function myCustomDomainLogicUpdate2(state: ElementState): ElementContainer {
  const parentContainer = getInMapOrThrow(state.currentSnapshot.peek().elements, initialChild)

  const grandChild2Element: FormaElement = { urn: createUrn("dummy", "dummy", "grandchild-2", "0") }
  const grandChild2Container = ElementContainer.fromDraftElement(grandChild2Element)

  const newParentElement = {
    ...parentContainer.element,
    urn: replaceRevision(parentContainer.element.urn, "newRevision"),
    children: [...(parentContainer.element.children ?? []), { key: "grandchild-2", urn: grandChild2Element.urn }],
  }

  return ElementContainer.fromDraftElement(newParentElement, [...parentContainer.children, grandChild2Container])
}
