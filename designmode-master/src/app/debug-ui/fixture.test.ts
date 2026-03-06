import { elementContainerTreeFromObjects } from "src/core/elements/elementContainersFromObjects"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
import { createTerrainCustomData, TerrainData } from "src/core/elements/terrain-data"
import { createRepresentationsByUrnForTest } from "src/core/elements/testUtils"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import { createElementBoxMapFromDraftElements } from "src/lib/element/statebox"
import { objectEntries } from "src/lib/record"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { expect, test } from "vitest"
import { type FixtureData, parseFixtureData } from "./createAndLoadFixture"
import fixtureRaw from "./state-for-test.json?raw"
import { Proposal } from "src/core/elements/Proposal"
import { parseUrn } from "src/lib/element/urn"

test("should be able to work on fixture data", () => {
  const fixtureData: FixtureData = parseFixtureData(fixtureRaw)

  const terrainElement = Object.values(fixtureData.elements).find(isTerrainElement)!
  const terrainElementContainer = ElementContainer.fromDraftElement(
    terrainElement,
    undefined,
    undefined,
    createTerrainCustomData(new TerrainData(fixtureData.meshTerrain!, undefined, undefined)),
  )
  const fixtureSnapshot = new ElementSnapshot(
    ElementSnapshotStatus.Draft,
    elementContainerTreeFromObjects(
      fixtureData.rootUrn,
      createElementBoxMapFromDraftElements(fixtureData.elements),
      createRepresentationsByUrnForTest({
        volumeMesh: new Map(objectEntries(fixtureData.geometries)),
      }),
      new Map([[terrainElement.urn, terrainElementContainer]]),
    ),
  )

  const proposal = Proposal.of(fixtureSnapshot)

  expect(parseUrn(proposal.urn).system).toBe("proposal")
})
