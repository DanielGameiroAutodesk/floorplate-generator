import type { FormaElement } from "forma-elements"
import type { Feature, LineString } from "geojson"
import { PROJECT_ID } from "src/core/project/project"
import { createUrn, newChildKey, newId, newRevision } from "src/lib/element/urn"
import transportationApi from "./lib/transportationApi"
import { DEFAULT_BUFFER_WIDTH_RAIL, DEFAULT_BUFFER_WIDTH_ROAD } from "./PropertyPanels/DrawingProperties"
import { createElementContainer } from "./glue"
import { elementState } from "src/core/elements/ElementState"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { getParentPath, mergePath } from "src/lib/element/path"
import { captureException } from "@sentry/browser"

function validateGeoJson(geojson: Feature) {
  if (geojson.geometry.type !== "LineString") {
    captureException(new Error("geojson is not a LineString"), { extra: { type: geojson.geometry.type } })
    return false
  }
  return true
}

function validateCategory(category: string | undefined) {
  if (!category || !["road", "rails"].includes(category)) {
    captureException("element is not a road or rail", { extra: { category } })
    return false
  }
  return true
}

export function migrateRoadOrRail(roadOrRailElement: FormaElement, node: ChildNodeContainer) {
  const geojson = node.elementContainer.representations.footprint as Feature
  const properties = roadOrRailElement.properties

  const category = roadOrRailElement.properties?.category
  if (!validateGeoJson(geojson) || !validateCategory(category)) {
    return
  }

  const legacyElementNodeKey = node.child.key
  const metadata = node.elementContainer.element.metadata
  const urn = createUrn(transportationApi.systemName, PROJECT_ID, newId(), newRevision())
  const defaultWidth = category === "road" ? DEFAULT_BUFFER_WIDTH_ROAD : DEFAULT_BUFFER_WIDTH_RAIL
  const element = transportationApi.createTransportationElementFromGeoJsonLineString(
    geojson as Feature<LineString>,
    geojson.properties?.lineWidth || defaultWidth,
    urn,
    properties,
    metadata,
  )

  if (!element) {
    captureException(new Error("Failed to create transportation element"))
    return
  }

  const contextRoot = scenarioModeSignal.peek() ? "base" : "proposal"
  const newKey = newChildKey()
  const container = createElementContainer(element)
  elementState.edit(({ addElement, removeElement }) => {
    addElement(contextRoot, { key: newKey, urn: container.element.urn, transform: node.child.transform }, container)
    removeElement(contextRoot, legacyElementNodeKey)
  })
  return mergePath(getParentPath(node.path), newKey)
}
