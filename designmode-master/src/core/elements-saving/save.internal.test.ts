import { beforeEach, describe, expect, it } from "vitest"
import { createUrn } from "src/lib/element/urn"
import { save } from "./save.internal"
import { ok } from "./result"
import { createElementBoxMapFromDraftElements, createElementBoxMapFromServerElements } from "src/lib/element/statebox"
import { mapOfFormaElements } from "src/lib/element/utils"
import { registerElementSystem, removeAllRegisteredSystems } from "src/core/element-systems"
import type { FormaElement } from "forma-elements"
import {
  dummyBaseElement,
  dummyBaseElementChild,
  dummyTerrainElement,
  dummyTerrainElementChild,
  elementContainerTreeFromObjectsForTest,
} from "src/core/elements/testUtils"
import { mergeMaps } from "src/lib/map"
import { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"

const SYSTEM_NAME = "proposal"

const ROOT_SYSTEM_NAME = "proposal"
const ROOT_URN = createUrn(ROOT_SYSTEM_NAME, "test", "id", "0")

const proposal: FormaElement = {
  urn: ROOT_URN,
  properties: {
    flags: {
      [dummyBaseElementChild.key]: {
        scenario: true,
      },
    },
  },
  children: [dummyBaseElementChild, dummyTerrainElementChild],
}

const rootContainer = elementContainerTreeFromObjectsForTest(
  ROOT_URN,
  mergeMaps(
    createElementBoxMapFromDraftElements(proposal),
    createElementBoxMapFromServerElements(dummyBaseElement, dummyTerrainElement),
  ),
)

const snapshot = new ElementSnapshot(ElementSnapshotStatus.Draft, rootContainer)

describe("saving", () => {
  it("should fail without registered element systems", async () => {
    const saved = await save(snapshot)

    expect(saved.type).toEqual("error")
    expect(saved.data).toContainEqual({ type: "SAVING_FOR_SYSTEM_NOT_IMPLEMENTED", system: SYSTEM_NAME })
  })

  describe("with registered element system", () => {
    beforeEach(() => {
      removeAllRegisteredSystems()
    })

    it("should not fail when system correctly returns saved elements", async () => {
      registerElementSystem(SYSTEM_NAME, {
        saveHandler: () => {
          return Promise.resolve([
            ok({
              updatedElementsFromSystem: mapOfFormaElements({ urn: ROOT_URN }),
            }),
          ])
        },
      })

      const saved = await save(snapshot)

      expect(saved.type).toEqual("ok")
    })

    it("should succeed when system returns none", async () => {
      registerElementSystem(SYSTEM_NAME, {
        saveHandler: () => {
          return Promise.resolve([
            ok({
              updatedElementsFromSystem: new Map(),
            }),
          ])
        },
      })

      const saved = await save(snapshot)

      expect(saved.type).toEqual("error")
      expect(saved.data).toContainEqual({ type: "URN_NOT_SAVED_AFTER_MAX_DEPTH", urn: ROOT_URN })
    })
  })
})
