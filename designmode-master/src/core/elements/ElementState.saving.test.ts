import { ElementState } from "./ElementState"
import { ElementSnapshot } from "./ElementSnapshot"
import { createUrn, parseUrn, replaceRevision } from "src/lib/element/urn"
import { ElementContainer } from "./ElementContainer"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { ElementSnapshotStatus } from "./ElementSnapshotStatus"
import { Matrix4 } from "three"
import { describe, expect, it } from "vitest"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import { getInMapOrThrow } from "src/lib/map"
import {
  createProposalForSnapshotForTest,
  createRepresentationsByUrnForTest,
  dummyBaseElementChild,
  dummyBaseElementContainer,
  dummyTerrainElementChild,
  dummyTerrainElementContainer,
  elementContainerTreeFromObjectsForTest,
  proposalPropertiesForBase,
} from "./testUtils"
import { elementContainerTreeFromObjects } from "./elementContainersFromObjects"

const ROOT_URN = createUrn("proposal", "test", "id", "0")
const CHILD_URN_A = createUrn("child", "test", "childA", "0")
const CHILD_URN_B = createUrn("child", "test", "childB", "0")

// Most of the saving tests don't deal with terrain and base,
// while this is needed for a valid proposal.
function withRequiredProposalData(rootContainer: ElementContainer) {
  return ElementContainer.fromServerElement(
    {
      ...rootContainer.element,
      properties: {
        ...rootContainer.element.properties,
        ...proposalPropertiesForBase(dummyBaseElementChild.key),
      },
      children: [...(rootContainer.element.children ?? []), dummyBaseElementChild, dummyTerrainElementChild],
    },
    [...rootContainer.children, dummyBaseElementContainer, dummyTerrainElementContainer],
  )
}

describe("ElementState.saving", () => {
  it("should write saved changes back", () => {
    const state = new ElementState().reset(
      new ElementSnapshot(
        ElementSnapshotStatus.Persisted,
        elementContainerTreeFromObjectsForTest(
          ROOT_URN,
          createElementBoxMapFromDraftElements(createProposalForSnapshotForTest({ urn: ROOT_URN })),
        ),
      ),
    )

    state.edit((edit) => {
      const childA = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
      edit.addElement("proposal", { key: "same-key", urn: childA.element.urn }, childA)
    })

    const saveResponse: Map<Urn, FormaElement> = new Map(
      [...state.currentSnapshot.value.elements.entries()].map(([urn, container]) => [urn, container.element]),
    )

    // Pretend like save initiates here

    state.edit((edit) => {
      const childB = ElementContainer.fromDraftElement({ urn: CHILD_URN_B })
      edit.updateElement("proposal", { key: "same-key", urn: childB.element.urn }, childB)
    })
    const proposalUrnAfterBothChanges = state.currentSnapshot.value.rootUrn

    // Saving "lands"
    state.updateElementStateFromSaveResponse_INTERNAL(saveResponse)

    // should still be a draft proposal
    expect(state.currentSnapshot.value.rootUrn).toEqual(proposalUrnAfterBothChanges) // Post save should not update root urn
    expect(state.currentSnapshot.value.status).toEqual(ElementSnapshotStatus.Draft) // As childB is still unpersisted

    state.undo()

    // should update old snapshots with newest persisted status
    const childA = state.currentSnapshot.value.getNode(`${ROOT_KEY}/same-key`)?.elementContainer

    expect(childA?.isServerState).toBeTruthy()
  })

  it("should handle element being moved right after added", () => {
    const state = new ElementState().reset(
      new ElementSnapshot(
        ElementSnapshotStatus.Persisted,
        withRequiredProposalData(
          elementContainerTreeFromObjects(
            ROOT_URN,
            createElementBoxMapFromDraftElements({ urn: ROOT_URN }),
            createRepresentationsByUrnForTest(),
          ),
        ),
      ),
    )

    const childA = ElementContainer.fromDraftElement({ urn: CHILD_URN_A })
    const childAChild = { key: "same-key", urn: childA.element.urn }

    state.edit((edit) => {
      edit.addElement("proposal", childAChild, childA)
    })

    const saveResponse: Map<Urn, FormaElement> = new Map(
      [...state.currentSnapshot.value.elements.entries()].map(([urn, container]) => [urn, container.element]),
    )

    // Pretend like save initiates here

    state.updateProposal(
      ElementContainer.fromDraftElement(
        {
          urn: replaceRevision(ROOT_URN, "1"),
          children: [
            ...(state.currentSnapshot.value.rootNode.elementContainer.element.children ?? []).filter(
              (child) => child.key !== childAChild.key,
            ),
            {
              ...childAChild,
              // Pretend element is moved
              transform: new Matrix4().toArray(),
            },
          ],
        },
        state.currentSnapshot.value.rootNode.elementContainer.children,
      ),
    )
    const snapshotAfterBothChanges = state.currentSnapshot.value

    // Saving "lands"
    state.updateElementStateFromSaveResponse_INTERNAL(saveResponse)

    // should still be a draft proposal
    expect(state.currentSnapshot.value.rootUrn).toEqual(snapshotAfterBothChanges.rootUrn) // Post save should not update root urn
    expect(state.currentSnapshot.value.status).toEqual(ElementSnapshotStatus.Draft) // Proposal is still unpersisted

    expect(
      state.currentSnapshot.value.getNode(mergePath(ROOT_KEY, childAChild.key))?.elementContainer.isServerState,
    ).toBeTruthy()
  })

  it("should not create more ElementContainers than necessary when rebuilding snapshots with save results", () => {
    // Helper functions
    const formaElements = new Map<Urn, FormaElement>() // Needed to build save response below
    const dummyUrn = (name: string, revision: number) => createUrn(name, "test", "test", revision.toString())
    const dummyElement = (name: string, revision: number, persisted: boolean, children: ElementContainer[]) => {
      const element = {
        urn: dummyUrn(name, revision),
        children: children.map((childContainer) => ({
          key: parseUrn(childContainer.element.urn).system,
          urn: childContainer.element.urn,
        })),
      }
      formaElements.set(element.urn, element)
      return persisted
        ? ElementContainer.fromServerElement(element, children)
        : ElementContainer.fromDraftElement(element, children)
    }
    const dummySaveResponse = (urns: Urn[]) => new Map(urns.map((urn) => [urn, getInMapOrThrow(formaElements, urn)]))
    const countUniqueContainersAndCheckForDuplicates = (snapshots: ReadonlyMap<Urn, ElementSnapshot>): number => {
      const urnToContainerMap: Record<Urn, ElementContainer> = {}
      snapshots.forEach((snapshot) => {
        snapshot.elements.forEach((container) => {
          const urn = container.element.urn
          if (!urnToContainerMap[urn]) urnToContainerMap[urn] = container
          expect(urnToContainerMap[urn]).toBe(container)
        })
      })
      return Object.entries(urnToContainerMap).length
    }

    // The final tree will look like this:
    //             B
    //           /   \
    // Root --> A     C
    //           \   /
    //             D -- (E)

    // ------------------------------------------------------------
    // SNAPSHOT 1: The initial tree (A -> B -> C, A -> D -> C, all at revision 1)
    const C1 = dummyElement("C", 1, true, [])
    const state = new ElementState().reset(
      new ElementSnapshot(
        ElementSnapshotStatus.Persisted,
        withRequiredProposalData(
          dummyElement("A", 1, true, [dummyElement("B", 1, true, [C1]), dummyElement("D", 1, true, [C1])]),
        ),
      ),
    )
    const firstSnapshot = state.currentSnapshot.value

    // Ensure that we have the expected number of unique element containers (e.g. for each URN, we
    // should always point to the same container across snapshots), in this case A.1, B.1, C.1, D.1
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(6)

    // ------------------------------------------------------------
    // SNAPSHOT 2: Make edit to C (bumping all four elements to revisions A.2, B.2, C.2, D.2)
    const C2 = dummyElement("C", 2, false, [])
    state.edit(({ updateElement }) => {
      const B2 = dummyElement("B", 2, false, [C2])
      const D2 = dummyElement("D", 2, false, [C2])
      updateElement("proposal", { key: "B", urn: B2.element.urn }, B2)
      updateElement("proposal", { key: "D", urn: D2.element.urn }, D2)
    })
    const urnA2 = state.currentSnapshot.value.rootNode.elementContainer.element.urn
    formaElements.set(urnA2, state.currentSnapshot.value.rootNode.elementContainer.element)

    // Expect 10 unique containers: A.1, A.2, B.1, B.2, C.1, C.2, D.1, D.2, base, terrain
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(10)

    // ------------------------------------------------------------
    // SNAPSHOT 3: Add D -> E (creating E.1 and bumping revisions to D.3, A.3)
    state.edit(({ updateElement }) => {
      const E1 = dummyElement("E", 1, false, [])
      const D3 = dummyElement("D", 3, false, [C2, E1])
      updateElement("proposal", { key: "D", urn: D3.element.urn }, D3)
    })
    const urnA3 = state.currentSnapshot.value.rootNode.elementContainer.element.urn
    formaElements.set(urnA3, state.currentSnapshot.value.rootNode.elementContainer.element)

    // Expect 13 unique containers: A.1, A.2, A.3, B.1, B.2, C.1, C.2, D.1, D.2, D.3, E.1, base, terrain
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(13)

    // ------------------------------------------------------------
    // SAVING: Save for C.2 lands
    const B2_beforeSave = state.currentSnapshot.value.getNode("root/B")!.elementContainer
    const C2_beforeSave = state.currentSnapshot.value.getNode("root/B/C")!.elementContainer
    state.updateElementStateFromSaveResponse_INTERNAL(dummySaveResponse([dummyUrn("C", 2)]))

    // The total number of unique containers should be unchanged at 13 (though some may have gone from draft to persisted)
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(13)

    // Ensure we have a new persisted element container for C.2, shared between snapshots A2 and A3
    const C2_afterSave = state.currentSnapshot.value.getNode("root/B/C")!.elementContainer
    expect(C2_afterSave).toBe(
      getInMapOrThrow(state.knownSnapshots_onlyForTesting, urnA2).getNode("root/B/C")!.elementContainer,
    )
    expect(C2_afterSave).not.toBe(C2_beforeSave)
    expect(C2_afterSave.isServerState).toBe(true)

    // Ensure we have a rebuilt B.2 element container (pointing to persisted C.2), shared between snapshots A2 and A3
    const B2_afterSave1 = state.currentSnapshot.value.getNode("root/B")!.elementContainer
    expect(B2_afterSave1).toBe(
      getInMapOrThrow(state.knownSnapshots_onlyForTesting, urnA2).getNode("root/B")!.elementContainer,
    )
    expect(B2_afterSave1).not.toBe(B2_beforeSave)
    expect(B2_afterSave1.isServerState).toBe(false)
    expect(B2_afterSave1.children[0]).toBe(C2_afterSave)

    // ------------------------------------------------------------
    // SAVING: Save for E.1 lands
    state.updateElementStateFromSaveResponse_INTERNAL(dummySaveResponse([dummyUrn("E", 1)]))

    // The total number of unique containers should be unchanged at 13
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(13)

    // Ensure that nothing has happened to the containers for B.2 and C.2
    expect(state.currentSnapshot.value.getNode("root/B")!.elementContainer).toBe(B2_afterSave1)
    expect(state.currentSnapshot.value.getNode("root/B/C")!.elementContainer).toBe(C2_afterSave)

    // ------------------------------------------------------------
    // SAVING: Save for B.2 lands
    state.updateElementStateFromSaveResponse_INTERNAL(dummySaveResponse([dummyUrn("B", 2)]))

    // The total number of unique containers should be unchanged at 13
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(13)

    // Ensure we have a new persisted element container for B.2, shared between snapshots A2 and A3
    const B2_afterSave2 = state.currentSnapshot.value.getNode("root/B")!.elementContainer
    expect(B2_afterSave2).toBe(
      getInMapOrThrow(state.knownSnapshots_onlyForTesting, urnA2).getNode("root/B")!.elementContainer,
    )
    expect(B2_afterSave2).not.toBe(B2_afterSave1)
    expect(B2_afterSave2.isServerState).toBe(true)
    expect(B2_afterSave2.children[0]).toBe(C2_afterSave)

    // ------------------------------------------------------------
    // SAVING: Save for A.2, A.3, D.2 and D.3 land simultaneously -- should work without crashing
    state.updateElementStateFromSaveResponse_INTERNAL(
      dummySaveResponse([urnA2, urnA3, dummyUrn("D", 2), dummyUrn("D", 3)]),
    )

    // The total number of unique containers should be unchanged at 13
    expect(countUniqueContainersAndCheckForDuplicates(state.knownSnapshots_onlyForTesting)).toBe(13)

    // All known snapshots should now be persisted
    state.knownSnapshots_onlyForTesting.forEach((snapshot) =>
      expect(snapshot.status).toBe(ElementSnapshotStatus.Persisted),
    )

    // Ensure we haven't unnecessarily rebuilt the first snapshot (where all elements were already persisted)
    expect(getInMapOrThrow(state.knownSnapshots_onlyForTesting, dummyUrn("A", 1))).toBe(firstSnapshot)
  })
})
