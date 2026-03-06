import { ElementContainer } from "src/core/elements/ElementContainer"
import { createUrn } from "src/lib/element/urn"
import { BoxGeometry } from "three"
import { ElementState } from "src/core/elements/ElementState"
import { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import type { TerrainShape } from "src/lib/element/types"
import type { LineString } from "geojson"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
import { describe, it, expect } from "vitest"
import { getInMapOrThrow } from "src/lib/map"
import {
  dummyBaseElementChild,
  dummyBaseElementContainer,
  dummyTerrainElementChild,
  dummyTerrainElementContainer,
  proposalPropertiesForBase,
} from "src/core/elements/testUtils"
import type { KnownRepresentations } from "src/core/elements/ElementRepresentations"

const terrainShapeFixture: TerrainShape = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0],
        ],
      } as LineString,
    },
  ],
}

function representations(values: Partial<KnownRepresentations>): KnownRepresentations {
  return {
    volumeMesh: undefined,
    footprint: undefined,
    terrainShape: undefined,
    terrainTexture: undefined,
    buildingFloors3DSketch_UNSTABLE: undefined,
    ...values,
  }
}

describe("derived data", () => {
  describe("renderables", () => {
    it("should be on ElementContainer if volumeMesh is set", () => {
      const child = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(),
        }),
      )
      expect(child.renderable3d.getOrCompute()).toHaveLength(1)
    })

    it("should be on nodes", () => {
      const child = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(),
        }),
      )
      const proposal = ElementContainer.fromServerElement(
        {
          urn: createUrn("proposal", "test", "id", "0"),
          children: [{ key: "child", urn: child.element.urn }, dummyBaseElementChild, dummyTerrainElementChild],
          properties: proposalPropertiesForBase(dummyBaseElementChild.key),
        },
        [child, dummyBaseElementContainer, dummyTerrainElementContainer],
      )
      const state = new ElementState().reset(new ElementSnapshot(ElementSnapshotStatus.Persisted, proposal))

      const node = getInMapOrThrow(state.currentSnapshot.value.nodes, mergePath(ROOT_KEY, "child"))
      expect(node.renderables3d.getOrCompute()).toHaveLength(1)
    })
  })
  describe("bbox", () => {
    it("should not be on ElementContainer if not explicitly calculated", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(10, 10, 10),
        }),
      )
      expect(() => container.bbox.get()).toThrow()
    })
    it("should be on ElementContainer if calculated", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(10, 10, 10),
        }),
      )
      container.bbox.compute()
      expect(() => container.bbox.get()).not.toThrow()
    })
  })
  describe("outlines", () => {
    it("should be present after computation if volumeMesh is set", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(10, 10, 10),
        }),
      )
      container.outlines.compute()
      expect(container.outlines.get()).toBeDefined()
    })
    it("should not be present after computation if only terrainShape is set", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          terrainShape: terrainShapeFixture,
        }),
      )
      container.outlines.compute()
      expect(container.outlines.get()).toBeUndefined()
    })
    it("should not be present without volumeMesh (or terrainShape)", () => {
      const container = ElementContainer.fromServerElement({ urn: createUrn("child", "test", "childA", "0") })
      container.outlines.compute()
      expect(container.outlines.get()).toBeUndefined()
    })
  })
  describe("snapping lines", () => {
    it("should be present after computation if volumeMesh is set", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(10, 10, 10),
        }),
      )
      container.snappingLines.compute()
      expect(container.snappingLines.get()).toHaveLength(12)
    })
    it("should be present after computation if footprint is set", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          footprint: terrainShapeFixture.features[0],
        }),
      )
      container.snappingLines.compute()
      expect(container.snappingLines.get()).toHaveLength(4)
    })
    it("should populate outlines fields when calculated", () => {
      const container = ElementContainer.fromServerElement(
        { urn: createUrn("child", "test", "childA", "0") },
        undefined,
        representations({
          volumeMesh: new BoxGeometry(10, 10, 10),
        }),
      )
      container.snappingLines.compute()
      expect(container.outlines.get()).toBeDefined()
    })
  })
})
