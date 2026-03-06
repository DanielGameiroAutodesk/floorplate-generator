import type { Child, FormaElement, Urn } from "forma-elements"
import type { Feature } from "geojson"
import type { BufferGeometry } from "three"
import { Mesh } from "three"
import type { FormaElementBox } from "src/lib/element/statebox"
import type { TerrainShape } from "src/lib/element/types"
import { getInMapOrThrow } from "src/lib/map"
import { ElementContainer } from "./ElementContainer"
import { elementContainerTreeFromObjects } from "./elementContainersFromObjects"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import { createTerrainCustomData, TerrainData } from "./terrain-data"
import type { TerrainTexture } from "src/core/elements-loading/loading"
import type { RepresentationsByUrn } from "./ElementRepresentations"

export const dummyBaseElement: FormaElement = {
  urn: "urn:adsk-forma-elements:group:pro_test:base1:1234",
}

export const dummyTerrainElement: FormaElement = {
  urn: "urn:adsk-forma-elements:terrain:pro_test:terrain1:1234",
  properties: {
    category: "terrain",
  },
}

export const dummyBaseElementChild: Child = {
  key: "base",
  urn: dummyBaseElement.urn,
}

export const dummyTerrainElementChild: Child = {
  key: "terrain",
  urn: dummyTerrainElement.urn,
}

export const dummyBaseElementContainer = ElementContainer.fromServerElement(dummyBaseElement)

export const dummyTerrainElementContainer = ElementContainer.fromServerElement(
  dummyTerrainElement,
  undefined,
  undefined,
  createTerrainCustomData(getDummyTerrainData()),
)

export function proposalPropertiesForBase(baseKey: string) {
  return {
    flags: {
      [baseKey]: {
        scenario: true,
      },
    },
  }
}

/**
 * Update a proposal element to have a base and terrain child.
 *
 * Returns the proposal and the base and terrain elements.
 */
export function createProposalForSnapshotForTest(template: FormaElement): [FormaElement, ...FormaElement[]] {
  const children: Child[] = [...(template.children ?? [])]

  const proposal: FormaElement = {
    ...template,
    properties: {
      ...template.properties,
      flags: {
        [dummyBaseElementChild.key]: {
          scenario: true,
        },
      },
    },
    children,
  }

  const result: [FormaElement, ...FormaElement[]] = [proposal]

  // All proposals must have a base.
  result.push(dummyBaseElement)
  children.push(dummyBaseElementChild)

  // All proposals must have a terrain.
  result.push(dummyTerrainElement)
  children.push(dummyTerrainElementChild)

  return result
}

function findTerrainElement(rootUrn: Urn, elements: Map<Urn, FormaElementBox>): FormaElementBox {
  const proposal = getInMapOrThrow(elements, rootUrn).element

  for (const child of proposal.children ?? []) {
    const element = getInMapOrThrow(elements, child.urn)
    if (isTerrainElement(element.element)) {
      return element
    }
  }

  throw new Error("Terrain element not found")
}

function getDummyTerrainData(): TerrainData {
  return new TerrainData(new Mesh(), undefined, undefined)
}

/**
 * Create ElementContainer tree with a valid dummy terrain element.
 */
export function elementContainerTreeFromObjectsForTest(
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  representationsByUrn: RepresentationsByUrn = createRepresentationsByUrnForTest(),
  terrainData: TerrainData = getDummyTerrainData(),
): ElementContainer {
  // Create a valid ElementContainer for the terrain element.
  const terrainElement = findTerrainElement(rootUrn, elements)
  const containers = new Map<Urn, ElementContainer>()
  containers.set(
    terrainElement.element.urn,
    ElementContainer.fromServerElement(
      terrainElement.element,
      undefined,
      undefined,
      createTerrainCustomData(terrainData),
    ),
  )

  return elementContainerTreeFromObjects(rootUrn, elements, representationsByUrn, containers)
}

export function createRepresentationsByUrnForTest(input?: {
  volumeMesh?: Map<Urn, BufferGeometry>
  footprint?: Map<Urn, Feature>
  terrainShape?: Map<Urn, TerrainShape>
  terrainTexture?: Map<Urn, TerrainTexture>
}): RepresentationsByUrn {
  return {
    volumeMesh: input?.volumeMesh ?? new Map([]),
    footprint: input?.footprint ?? new Map([]),
    terrainShape: input?.terrainShape ?? new Map([]),
    terrainTexture: input?.terrainTexture ?? new Map([]),
    buildingFloors3DSketch_UNSTABLE: new Map(),
  }
}
