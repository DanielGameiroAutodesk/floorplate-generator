import { ElementSnapshot } from "./ElementSnapshot"
import { createUrn } from "src/lib/element/urn"
import { ElementSnapshotStatus } from "./ElementSnapshotStatus"
import { describe, it, expect } from "vitest"
import { ElementContainer } from "./ElementContainer"
import {
  dummyBaseElementChild,
  dummyBaseElementContainer,
  dummyTerrainElement,
  dummyTerrainElementChild,
  proposalPropertiesForBase,
} from "./testUtils"
import { Proposal } from "./Proposal"

describe("Proposal", () => {
  it("should fail if missing terrain data", () => {
    const container = ElementContainer.fromServerElement(
      {
        urn: createUrn("proposal", "test", "id", "0"),
        properties: {
          ...proposalPropertiesForBase(dummyBaseElementChild.key),
        },
        children: [dummyBaseElementChild, dummyTerrainElementChild],
      },
      [dummyBaseElementContainer, ElementContainer.fromServerElement(dummyTerrainElement)],
    )

    expect(() =>
      Proposal.of(new ElementSnapshot(ElementSnapshotStatus.Persisted, container)),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Unexpected nullable value: Terrain should be loaded]`)
  })
})
