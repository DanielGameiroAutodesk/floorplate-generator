import type { Child, FormaElement, JsonRepresentations, Representation, Urn } from "forma-elements"
import { feetToMeter } from "@spacemakerai/forma-units"

import { ElementContainer } from "src/core/elements/ElementContainer"
import { createUrn, newChildKey, newId, newRevision, replaceRevision } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import { Set_intersection } from "src/lib/set"
import { assertIsDefined } from "src/lib/assertions"
import type { Selectable, SelectionMode } from "src/core/elements/element-container-derived-data/selectables"
import type { SnappingLine } from "src/core/element-systems"
import ArrayUtils from "src/lib/array"

import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"

import {
  createDefaultAreaGraphGeneratorConfig,
  createDefaultBuildingsGeneratorConfig,
  type SiteExploreAreaGeneratorConfig,
  type SiteExploreAreaGeneratorId,
  siteExploreAreaGenerators,
} from "./generators"
import {
  createGraphWithEdgesWidth,
  createOuterPolygonsFromGraph,
  createPolygonCellsFromGraph,
  isGraphWithEdgesWidth,
  type SimpleGraph,
} from "./graph-utils"

type SiteExploreAreaGeneratorElement = FormaElement & {
  properties: { generator: SiteExploreAreaGeneratorConfig }
}

type SiteExploreAreaGeneratorElementT<T extends SiteExploreAreaGeneratorId> = FormaElement & {
  properties: { generator: Extract<SiteExploreAreaGeneratorConfig, { generatorId: T }> }
}

export type SiteExploreAreaChildrenGeneratorElement = SiteExploreAreaGeneratorElementT<"site-explore-area-buildings-v1">

export type SiteExploreAreaGraphGeneratorElement = SiteExploreAreaGeneratorElementT<"site-explore-area-graph-v2"> & {
  properties: { definingRepresentation: { graph: SimpleGraph<{ width: number }> } }
}

export class SiteExploreArea {
  private constructor(readonly elementContainer: ElementContainer) {
    const element = elementContainer.element
    if (!isSiteExploreAreaElement(element)) throw new Error("Element is not a SiteExploreAreaElement")
  }

  static of(polygon: Polygon, imperialFlag: boolean): SiteExploreArea
  static of(elementContainer: ElementContainer, imperialFlag: boolean): SiteExploreArea
  static of(obj: ElementContainer | Polygon, imperialFlag: boolean) {
    if (obj instanceof ElementContainer) {
      return new SiteExploreArea(obj)
    }
    return new SiteExploreArea(createDefaultAreaFromPolygon(obj, imperialFlag))
  }

  get element() {
    return this.elementContainer.element as SiteExploreAreaGeneratorElement
  }

  withGraph(graph: SimpleGraph, imperialFlag: boolean) {
    const elementContainer = updateAreaWithGraph(this, graph, imperialFlag)
    return SiteExploreArea.of(elementContainer, imperialFlag)
  }

  withGeneratorConfig(generatorConfig: SiteExploreAreaGeneratorConfig, imperialFlag: boolean) {
    const elementContainer = updateAreaWithGeneratorConfig(this, generatorConfig, imperialFlag)
    return SiteExploreArea.of(elementContainer, imperialFlag)
  }

  withRegenerate(imperialFlag: boolean) {
    const generatorConfig = this.element.properties.generator // TODO: Create a random generator config ?!
    const elementContainer = updateAreaWithGeneratorConfig(this, generatorConfig, imperialFlag)
    return SiteExploreArea.of(elementContainer, imperialFlag)
  }

  /**
   * Update the generator config of child elements
   * @param updates Array of childElement with new generator config
   * @returns A new SiteExploreArea with the child elements updated
   */
  withChildElementsGeneratorConfig(
    updates: Parameters<typeof updateAreaWithChildElementsGeneratorConfig>[1],
    imperialFlag: boolean,
  ) {
    const elementContainer = updateAreaWithChildElementsGeneratorConfig(this, updates, imperialFlag)
    return SiteExploreArea.of(elementContainer, imperialFlag)
  }
}

export function isSiteExploreAreaGraphGeneratorElement(
  element: FormaElement,
): element is SiteExploreAreaGraphGeneratorElement {
  const generatorId = element.properties?.generator?.generatorId
  if (!isSiteExploreAreaGeneratorId(generatorId)) return false
  return generatorId === "site-explore-area-graph-v2"
}

export function isSiteExploreAreaChildrenGeneratorElement(
  element: FormaElement,
): element is SiteExploreAreaChildrenGeneratorElement {
  const generatorId = element.properties?.generator?.generatorId
  if (!isSiteExploreAreaGeneratorId(generatorId)) return false
  return generatorId === "site-explore-area-buildings-v1" // TODO: add more children generators
}

export function isSiteExploreAreaElement(element: FormaElement): element is SiteExploreAreaGeneratorElement {
  return isSiteExploreAreaGeneratorId(element.properties?.generator?.generatorId)
}

function isSiteExploreAreaGeneratorId(generatorId: any): generatorId is SiteExploreAreaGeneratorId {
  if (typeof generatorId !== "string") return false
  return siteExploreAreaGenerators[generatorId as SiteExploreAreaGeneratorId] != null
}

type Polygon = [number, number][]

export const SITE_EXPLORE_AREA_ELEMENT_CATEGORY = "site_explore_area"

const createPolygonMatcher = (p1: Polygon) => (p2: Polygon) => {
  const p1AsStrings = p1.map((c) => `${c[0].toFixed(2)}-${c[1].toFixed(2)}`)
  const p2AsStrings = p2.map((c) => `${c[0].toFixed(2)}-${c[1].toFixed(2)}`)
  if (p1AsStrings.every((c1, i) => c1 === p2AsStrings[i])) {
    return "equal"
  }
  const p1Set = new Set(p1AsStrings)
  const p2Set = new Set(p2AsStrings)
  const commonSet = Set_intersection(p1Set, p2Set)
  if (commonSet.size >= 2) {
    return "almost-equal"
  }
  return false
}

function createAreaChildrenGeneratorElementPolygonCellUpdater(area: SiteExploreArea, imperialFlag: boolean) {
  if (!isSiteExploreAreaGraphGeneratorElement(area.element))
    throw new Error("Element is not a SiteExploreAreaGraphGeneratorElement")

  // Handles matching existing elements to a given cell (polygon).
  // Will only return the same matching element once / considered "used" after the first match
  const matchExistingElement = (() => {
    const children = area.elementContainer.children
      .map(({ element }) => element)
      .filter(isSiteExploreAreaChildrenGeneratorElement)

    return (cell: Polygon) => {
      const matchPolygon = createPolygonMatcher(cell)

      const match = (() => {
        for (let i = 0; i < children.length; i++) {
          const m = matchPolygon(children[i].properties.generator.parameters.polygon)
          if (m) return { type: m, index: i } as const
        }
      })()

      if (!match) return

      // Remove the element matched, so it can't be matched again.
      // This is to ensure we're not reusing the same element for multiple cells.
      const element = children.splice(match.index, 1)[0]

      return { type: match.type, element }
    }
  })()

  const pickClosestElement = (() => {
    const children = area.elementContainer.children
      .map(({ element }) => element)
      .filter(isSiteExploreAreaChildrenGeneratorElement)

    return (cell: Polygon) => {
      // Find a child element that shares a common edge with the given cell
      for (let i = 0; i < children.length; i++) {
        const childPolygon = children[i].properties.generator.parameters.polygon
        for (let j = 0; j < cell.length; j++) {
          const edge = [cell[j], cell[(j + 1) % cell.length]]
          for (let k = 0; k < childPolygon.length; k++) {
            const childEdge = [childPolygon[k], childPolygon[(k + 1) % childPolygon.length]]
            if (
              edge[0][0] === childEdge[0][0] &&
              edge[0][1] === childEdge[0][1] &&
              edge[1][0] === childEdge[1][0] &&
              edge[1][1] === childEdge[1][1]
            ) {
              return children[i]
            }
          }
        }
      }

      // Find the element that is closest in terms of distance of vertices
      return children
        .map((child) => ({
          element: child,
          distance: Math.min(
            ...cell.map((cellPoint) =>
              Math.min(
                ...child.properties.generator.parameters.polygon.map((p) =>
                  Math.hypot(cellPoint[0] - p[0], cellPoint[1] - p[1]),
                ),
              ),
            ),
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .shift()?.element
    }
  })()

  /**
   * Create or update a child ChildrenGeneratorElement of a AreaGraphGeneratorElement based on the given polygon cell
   */
  return function createOrUpdate(cell: Polygon) {
    const match = matchExistingElement(cell)
    if (!match) {
      const closestElement = pickClosestElement(cell)
      if (closestElement) {
        // Found a neighbor element, so creating a new element based on the neighbor element config
        return createChildrenGeneratorElements(
          {
            ...closestElement.properties.generator,
            parameters: { ...closestElement.properties.generator.parameters, polygon: cell },
          },
          imperialFlag,
        )
      }

      // No match found, so creating a new element
      return createDefaultChildrenGeneratorElements(cell, imperialFlag)
    }

    if (match.type === "equal") {
      // Exact match, so keeping the same children generator config
      const existingChild = assertIsDefined(
        "Child not found",
        (area.element.children || []).find((child) => child.urn === match.element.urn),
      )
      return {
        elementContainer: assertIsDefined(
          "Element container not found",
          area.elementContainer.childrenByUrn.get(match.element.urn),
        ),
        child: existingChild,
      }
    }

    // Almost equal, so keeping the same children generator config with updated polygon
    const existingChild = assertIsDefined(
      "Child not found",
      (area.element.children || []).find((child) => child.urn === match.element.urn),
    )
    const childrenGeneratorConfig = {
      ...match.element.properties.generator,
      parameters: { ...match.element.properties.generator.parameters, polygon: cell },
    }
    const children = [
      updateZoneElement(area.elementContainer.childrenByUrn.get(match.element.urn)!, cell),
      ...siteExploreAreaGenerators[childrenGeneratorConfig.generatorId](
        childrenGeneratorConfig.parameters,
        imperialFlag,
      ),
    ]
    const element = {
      ...match.element,
      urn: replaceRevision(match.element.urn),
      properties: {
        ...match.element.properties,
        generator: childrenGeneratorConfig,
      },
      children: children.map(({ child }) => child),
    }
    return {
      elementContainer: ElementContainer.fromDraftElement(
        element,
        children.map(({ elementContainer }) => elementContainer),
      ),
      child: { ...existingChild, urn: element.urn },
    }
  }
}

function updateZoneElement(childrenGeneratorElementContainer: ElementContainer, cell: Polygon) {
  if (!isSiteExploreAreaChildrenGeneratorElement(childrenGeneratorElementContainer.element))
    throw new Error("Element is not a SiteExploreAreaChildrenGeneratorElement")

  // It should only ever exist 1 zone for a given cell
  const existingZoneElement = assertIsDefined(
    "Zone element not found",
    childrenGeneratorElementContainer.children.find((c) => c.element.properties?.category === "zone")
      ?.element as ZoneElement,
  )
  const existingZoneChild = assertIsDefined(
    "Zone child not found",
    (childrenGeneratorElementContainer.element.children || []).find((child) => child.urn === existingZoneElement.urn),
  )
  const updatedZoneElement = {
    ...createZoneElementFromPolygon(existingZoneElement.urn, cell),
    urn: replaceRevision(existingZoneElement.urn),
  }
  return {
    elementContainer: ElementContainer.fromDraftElement(updatedZoneElement, undefined, {
      terrainShape: updatedZoneElement.representations.terrainShape.data,
      footprint: updatedZoneElement.representations.footprint.data.features[0],
      terrainTexture: undefined,
      volumeMesh: undefined,
      buildingFloors3DSketch_UNSTABLE: undefined,
    }),
    child: { ...existingZoneChild, urn: updatedZoneElement.urn },
  }
}

function updateAreaWithGraph(area: SiteExploreArea, graph: SimpleGraph, imperialFlag: boolean) {
  if (!isSiteExploreAreaGraphGeneratorElement(area.element))
    throw new Error("Element is not a SiteExploreAreaGraphGeneratorElement")

  const defaultEdgeWidth = imperialFlag ? feetToMeter(40) : 12
  const graphWithEdgesWidth = isGraphWithEdgesWidth(graph)
    ? graph
    : createGraphWithEdgesWidth(
        graph,
        Object.values(area.element.properties.definingRepresentation.graph.edges)[0]?.width ?? defaultEdgeWidth,
      )

  const polygonCells = createPolygonCellsFromGraph(graphWithEdgesWidth)
  const polygons = createOuterPolygonsFromGraph(graphWithEdgesWidth)
  const children = polygonCells.map(createAreaChildrenGeneratorElementPolygonCellUpdater(area, imperialFlag))

  const element: SiteExploreAreaGraphGeneratorElement = {
    ...area.element,
    urn: replaceRevision(area.element.urn),
    properties: {
      ...area.element.properties,
      generator: {
        ...area.element.properties.generator,
        parameters: { ...area.element.properties.generator.parameters, polygons },
      },
      definingRepresentation: { ...area.element.properties.definingRepresentation, graph: graphWithEdgesWidth },
    },
    children: children.map(({ child }) => child),
  }

  return ElementContainer.fromDraftElement(
    element,
    children.map(({ elementContainer }) => elementContainer),
  )
}

function updateAreaWithChildElementsGeneratorConfig(
  area: SiteExploreArea,
  updates: {
    childElement: SiteExploreAreaGeneratorElement
    generatorConfig: SiteExploreAreaGeneratorConfig
  }[],
  imperialFlag: boolean,
) {
  const existingChildren = area.element.children ?? []
  const updatedChildren: { child: Child; elementContainer: ElementContainer }[] = []

  if (isSiteExploreAreaGraphGeneratorElement(area.element)) {
    for (const { childElement, generatorConfig } of updates) {
      if (
        isSiteExploreAreaChildrenGeneratorElement(childElement) &&
        generatorConfig.generatorId === "site-explore-area-buildings-v1"
      ) {
        const replaceChild = assertIsDefined(
          "Existing child not found",
          existingChildren.find((child) => child.urn === childElement.urn),
        )
        const children = [
          updateZoneElement(
            area.elementContainer.childrenByUrn.get(childElement.urn)!,
            childElement.properties.generator.parameters.polygon,
          ),
          ...siteExploreAreaGenerators[generatorConfig.generatorId](generatorConfig.parameters, imperialFlag),
        ]
        const element: SiteExploreAreaChildrenGeneratorElement = {
          ...childElement,
          urn: replaceRevision(childElement.urn),
          properties: {
            ...childElement.properties,
            generator: generatorConfig,
          },
          children: children.map(({ child }) => child),
        }

        updatedChildren.push({
          elementContainer: ElementContainer.fromDraftElement(
            element,
            children.map(({ elementContainer }) => elementContainer),
          ),
          child: { ...replaceChild, urn: element.urn },
        })
      }
    }
  }

  if (updatedChildren.length === 0) {
    // TODO: throw error instead ?
    return area.elementContainer
  }

  // Replace existingChildren with updatedChildren based on matching child key
  const children = existingChildren.map(
    (child) =>
      updatedChildren.find((updatedChild) => updatedChild.child.key === child.key) || {
        elementContainer: area.elementContainer.childrenByUrn.get(child.urn)!,
        child,
      },
  )

  return ElementContainer.fromDraftElement(
    {
      ...area.element,
      urn: replaceRevision(area.element.urn),
      children: children.map(({ child }) => child),
    },
    children.map(({ elementContainer }) => elementContainer),
  )
}

function updateAreaWithGeneratorConfig(
  area: SiteExploreArea,
  generatorConfig: SiteExploreAreaGeneratorConfig,
  imperialFlag: boolean,
) {
  if (
    isSiteExploreAreaGraphGeneratorElement(area.element) &&
    generatorConfig.generatorId === "site-explore-area-graph-v2"
  ) {
    const simpleGraph = siteExploreAreaGenerators[area.element.properties.generator.generatorId](
      generatorConfig.parameters,
    )
    const defaultEdgeWidth = imperialFlag ? feetToMeter(40) : 12
    const previousEdgesWidth =
      Object.values(area.element.properties.definingRepresentation.graph.edges)[0]?.width ?? defaultEdgeWidth
    const graphWithEdgesWidth = createGraphWithEdgesWidth(simpleGraph, previousEdgesWidth)
    const polygonCells = createPolygonCellsFromGraph(graphWithEdgesWidth)
    const children = polygonCells.map(createAreaChildrenGeneratorElementPolygonCellUpdater(area, imperialFlag))
    const element: SiteExploreAreaGraphGeneratorElement = {
      ...area.element,
      urn: replaceRevision(area.element.urn),
      properties: {
        ...area.element.properties,
        generator: generatorConfig,
        definingRepresentation: { ...area.element.properties.definingRepresentation, graph: graphWithEdgesWidth },
      },
      children: children.map(({ child }) => child),
    }

    return ElementContainer.fromDraftElement(
      element,
      children.map(({ elementContainer }) => elementContainer),
    )
  }

  throw new Error("Not implemented")
}

function createDefaultAreaFromPolygon(areaPolygon: Polygon, imperialFlag: boolean) {
  const areaGraphGeneratorConfig = createDefaultAreaGraphGeneratorConfig([areaPolygon])
  const simpleGraph = siteExploreAreaGenerators[areaGraphGeneratorConfig.generatorId](
    areaGraphGeneratorConfig.parameters,
  )
  const defaultEdgeWidth = imperialFlag ? feetToMeter(40) : 12
  const graphWithEdgesWidth = createGraphWithEdgesWidth(simpleGraph, defaultEdgeWidth)
  const polygonCells = createPolygonCellsFromGraph(graphWithEdgesWidth)
  const children = polygonCells.map((cell) => createDefaultChildrenGeneratorElements(cell, imperialFlag))

  const element: SiteExploreAreaGraphGeneratorElement = {
    urn: createUrn("parametric", PROJECT_ID, newId(), newRevision()),
    properties: {
      generator: areaGraphGeneratorConfig,
      definingRepresentation: { graph: graphWithEdgesWidth },
      category: SITE_EXPLORE_AREA_ELEMENT_CATEGORY,
    },
    children: children.map(({ child }) => child),
  }

  return ElementContainer.fromDraftElement(
    element,
    children.map(({ elementContainer }) => elementContainer),
  )
}

function createDefaultChildrenGeneratorElements(polygon: Polygon, imperialFlag: boolean) {
  const childrenGeneratorConfig = createDefaultBuildingsGeneratorConfig(polygon, imperialFlag, false)
  return createChildrenGeneratorElements(childrenGeneratorConfig, imperialFlag)
}

type ChildrenGeneratorConfig = Extract<
  SiteExploreAreaGeneratorConfig,
  { generatorId: "site-explore-area-buildings-v1" }
>

function createChildrenGeneratorElements(childrenGeneratorConfig: ChildrenGeneratorConfig, imperialFlag: boolean) {
  const elementId = newId()
  const zoneElement = createZoneElementFromPolygon(
    createUrn("basic", PROJECT_ID, `${elementId}+${newId()}`, newRevision()),
    childrenGeneratorConfig.parameters.polygon,
  )
  const children = [
    {
      // Zone element
      elementContainer: ElementContainer.fromDraftElement(zoneElement, undefined, {
        terrainShape: zoneElement.representations.terrainShape.data,
        footprint: zoneElement.representations.footprint.data.features[0],
        terrainTexture: undefined,
        volumeMesh: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      }),
      child: { key: newChildKey(), urn: zoneElement.urn },
    },
    ...siteExploreAreaGenerators[childrenGeneratorConfig.generatorId](childrenGeneratorConfig.parameters, imperialFlag),
  ]
  const element: SiteExploreAreaChildrenGeneratorElement = {
    urn: createUrn("parametric", PROJECT_ID, elementId, newRevision()),
    properties: {
      generator: childrenGeneratorConfig,
      category: SITE_EXPLORE_AREA_ELEMENT_CATEGORY,
    },
    children: children.map(({ child }) => child),
  }
  return {
    elementContainer: ElementContainer.fromDraftElement(
      element,
      children.map(({ elementContainer }) => elementContainer),
    ),
    child: { key: newChildKey(), urn: element.urn },
  }
}

type ZoneElement = FormaElement & {
  representations: {
    footprint: Extract<Representation<JsonRepresentations["footprint"]>, { type: "embedded-json" }>
    terrainShape: Extract<Representation<JsonRepresentations["terrainShape"]>, { type: "embedded-json" }>
  }
}

function createZoneElementFromPolygon(urn: Urn, polygon: Polygon): ZoneElement {
  // ensures polygon is closed
  function closePolygon(polygon: Polygon) {
    if (polygon.length <= 1) return polygon
    const p0 = polygon[0]
    const p1 = polygon[polygon.length - 1]
    if (p0[0] === p1[0] && p0[1] === p1[1]) return polygon
    return [...polygon, polygon[0]]
  }

  const footprint: JsonRepresentations["footprint"] = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [closePolygon(polygon)] },
        properties: {},
      },
    ],
  }
  const terrainShape: JsonRepresentations["terrainShape"] = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [closePolygon(polygon)] },
        properties: { fill: { opacity: 0, color: "#505050" }, stroke: { color: "#656565" } },
      },
    ],
  }

  return {
    urn,
    properties: basicElementPresets.zone,
    representations: {
      footprint: {
        type: "embedded-json",
        data: footprint,
      },
      terrainShape: {
        type: "embedded-json",
        data: terrainShape,
      },
    },
  }
}

function createTerrainShapeFromGraphElement(
  element: SiteExploreAreaGraphGeneratorElement,
): JsonRepresentations["terrainShape"] {
  return {
    type: "FeatureCollection",
    features: element.properties.generator.parameters.polygons.map((polygon) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[...polygon, polygon[0]]] },
      properties: {},
    })),
  }
}

export function generateSiteExploreAreaGraphGeneratorElementSelectables(
  element: SiteExploreAreaGraphGeneratorElement,
): { selectionMode: SelectionMode; selectables: Selectable[] } {
  if (!isSiteExploreAreaGraphGeneratorElement(element)) {
    throw new Error("Element is not a SiteExploreAreaGraphGeneratorElement")
  }
  return {
    selectionMode: "custom-selectables-only",
    selectables: [
      {
        target: { type: "element" },
        selectable2d: {
          terrainShape: createTerrainShapeFromGraphElement(element),
        },
      },
    ],
  }
}

export function generateSiteExploreAreaGeneratorElementSnappingLines(
  element: SiteExploreAreaGeneratorElement,
): SnappingLine[] | undefined {
  if (isSiteExploreAreaGraphGeneratorElement(element)) {
    const polygons = element.properties.generator.parameters.polygons
    return polygons.flatMap((polygon) =>
      ArrayUtils.sliding2([...polygon, polygon[0]]).map(([start, end]) => ({ start, end, onTerrain: true })),
    )
  }
  return undefined
}
