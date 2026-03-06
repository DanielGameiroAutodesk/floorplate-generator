import { ElementSnapshot } from "./ElementSnapshot"
import { createUrn, replaceRevision } from "src/lib/element/urn"
import { ROOT_KEY } from "src/lib/element/path"
import { Matrix4 } from "three"
import { ElementSnapshotStatus } from "./ElementSnapshotStatus"
import { describe, it, expect } from "vitest"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import { ElementContainer } from "./ElementContainer"
import type { FormaElement, Urn } from "forma-elements"
import { getInMapOrThrow } from "src/lib/map"
import {
  createProposalForSnapshotForTest,
  dummyBaseElement,
  dummyBaseElementContainer,
  dummyTerrainElement,
  dummyTerrainElementContainer,
  elementContainerTreeFromObjectsForTest,
} from "./testUtils"

const ROOT_URN = createUrn("proposal", "test", "id", "0")
const CHILD_URN_A = createUrn("child", "test", "childA", "0")
const CHILD_URN_B = createUrn("child", "test", "childB", "0")

const rootContainer = elementContainerTreeFromObjectsForTest(
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
)

describe("ElementSnapshot", () => {
  it("should reuse nodes when passing old snapshot", () => {
    const initSnapshot = new ElementSnapshot(ElementSnapshotStatus.Persisted, rootContainer)
    const nextSnapshot = new ElementSnapshot(ElementSnapshotStatus.Persisted, rootContainer, initSnapshot.nodes)

    expect(nextSnapshot.nodes.get(ROOT_KEY)).toBe(initSnapshot.nodes.get(ROOT_KEY))
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child1`)).toBe(initSnapshot.nodes.get(`${ROOT_KEY}/child1`))
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child2`)).toBe(initSnapshot.nodes.get(`${ROOT_KEY}/child2`))
  })
  it("should reuse unchanged nodes", () => {
    const initSnapshot = new ElementSnapshot(ElementSnapshotStatus.Persisted, rootContainer)
    const nextSnapshot = initSnapshot.edit(({ updateElement }) => {
      updateElement(
        "proposal",
        { key: "child1", transform: new Matrix4().toArray(), urn: CHILD_URN_A }, // New child
        rootContainer.children.find((c) => c.element.urn == CHILD_URN_A)!,
      )
    })

    expect(nextSnapshot.nodes.get(ROOT_KEY)).not.toBe(initSnapshot.nodes.get(ROOT_KEY))
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child1`)).not.toBe(initSnapshot.nodes.get(`${ROOT_KEY}/child1`))
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child2`)).toBe(initSnapshot.nodes.get(`${ROOT_KEY}/child2`))
  })
  it("should correctly reuse nodes taking nested transforms into account", () => {
    // Create proposal with a child with a transform, where that child in turn has children with their own transforms
    const initSnapshot = new ElementSnapshot(
      ElementSnapshotStatus.Persisted,
      elementContainerTreeFromObjectsForTest(
        ROOT_URN,
        createElementBoxMapFromDraftElements(
          createProposalForSnapshotForTest({
            urn: ROOT_URN,
            children: [
              {
                key: "child1",
                transform: new Matrix4().makeTranslation(-10, -10, 0).toArray(),
                urn: CHILD_URN_A,
              },
            ],
          }),
          {
            urn: CHILD_URN_A,
            children: [
              // grandchild1 is effectively located at (10, 10, 0)
              { key: "grandchild1", transform: new Matrix4().makeTranslation(20, 20, 0).toArray(), urn: CHILD_URN_B },
              // grandchild2 is effectively located at (0, 0, 0)
              { key: "grandchild2", transform: new Matrix4().makeTranslation(10, 10, 0).toArray(), urn: CHILD_URN_B },
            ],
          },
          { urn: CHILD_URN_B },
        ),
      ),
    )
    // Move grandchild1 (update its local transform), but keep the transform for grandchild2 unchanged
    const nextSnapshot = initSnapshot.edit(({ updateElement }) => {
      const newChildAUrn = replaceRevision(CHILD_URN_A)
      const newChildAElement: FormaElement = {
        urn: newChildAUrn,
        children: [
          // grandchild1 is moved to a new location
          { key: "grandchild1", transform: new Matrix4().makeTranslation(30, 30, 0).toArray(), urn: CHILD_URN_B },
          // grandchild2 is still at its old location
          { key: "grandchild2", transform: new Matrix4().makeTranslation(10, 10, 0).toArray(), urn: CHILD_URN_B },
        ],
      }
      const childBContainer = getInMapOrThrow(initSnapshot.elements, CHILD_URN_B)
      const newChildA = ElementContainer.fromDraftElement(newChildAElement, [childBContainer])
      updateElement(
        "proposal",
        { key: "child1", transform: new Matrix4().makeTranslation(-10, -10, 0).toArray(), urn: newChildAUrn },
        newChildA,
      )
    })
    // Verify that we get a new ChildNodeContainer for grandchild1 but not for grandchild2
    expect(nextSnapshot.nodes.get(ROOT_KEY)).not.toBe(initSnapshot.nodes.get(ROOT_KEY))
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child1`)).not.toBe(initSnapshot.nodes.get(`${ROOT_KEY}/child1`))
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child1/grandchild1`)).not.toBe(
      initSnapshot.nodes.get(`${ROOT_KEY}/child1/grandchild1`),
    )
    expect(nextSnapshot.nodes.get(`${ROOT_KEY}/child1/grandchild2`)).toBe(
      initSnapshot.nodes.get(`${ROOT_KEY}/child1/grandchild2`),
    )
  })

  describe("reading from a snapshot should work", () => {
    const rootUrn = "urn:adsk-forma-elements:dummy:none:id-dummy:1337" satisfies Urn
    const baseUrn = dummyBaseElement.urn
    const terrainUrn = dummyTerrainElement.urn
    const snapshot = new ElementSnapshot(
      ElementSnapshotStatus.Persisted,
      ElementContainer.fromDraftElement(
        {
          urn: rootUrn,
          properties: { flags: { ["scenario"]: { scenario: true } } },
          children: [
            { key: "scenario", urn: baseUrn },
            { key: "terrain", urn: terrainUrn },
          ],
        },
        [dummyBaseElementContainer, dummyTerrainElementContainer],
      ),
    )

    it("should get rootUrn", () => {
      expect(snapshot.rootUrn).toBeDefined()
    })
    it("should get nodes", () => {
      expect(snapshot.nodes).toBeDefined()
    })
    it("should get elements", () => {
      expect(snapshot.elements).toBeDefined()
    })
  })
})
