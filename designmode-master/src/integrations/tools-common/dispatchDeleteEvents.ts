import type { FormaElement } from "@spacemakerai/element-types"
import { parseUrn } from "src/lib/element/urn"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"
import { dispatchLimitEvent } from "src/core/events/limitEvents"
import { dispatchTransportationEvent } from "src/core/events/transportationEvents"
import { dispatchVegetationEvent } from "src/core/events/vegetationEvents"
import { dispatchGenericElementEvent, type GenericElementType } from "src/core/events/genericEvents"
import { EventName } from "@spacemakerai/webapp-analytics"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import transportationApi from "src/integrations/transportation/lib/transportationApi"
import { isParcelComposition } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"

function getGenericElementType(container: ElementContainer): GenericElementType | null {
  const hasVolumeMesh = !!container.representations.volumeMesh
  const footprint = container.representations.footprint

  if (hasVolumeMesh) {
    return "volume"
  } else if (footprint && footprint.geometry) {
    if (footprint.geometry.type === "LineString") {
      return "line"
    } else if (footprint.geometry.type === "Polygon") {
      return "surface"
    }
  }
  return null
}

function isGenericElement(element: FormaElement, container: ElementContainer): boolean {
  return (
    element.properties?.category === "generic" ||
    ((element.properties?.category === undefined || element.properties?.category === null) &&
      parseUrn(element.urn).system === "basic" &&
      !!container.representations.footprint)
  )
}

function dispatchElementDeleteEvent(element: FormaElement, container: ElementContainer): void {
  if (BasicBuildingAPI.isBasicBuilding(element)) {
    dispatchBuildingEvent("basic_building", EventName.Delete)
  } else if (lineBuildingApi.isLineBuildingFormaElement(element)) {
    dispatchBuildingEvent("line_building", EventName.Delete)
  } else if (isParcelComposition(element)) {
    dispatchBuildingEvent("row_house", EventName.Delete, undefined, { sub_feature: "single_row_house" })
  } else if (element.properties?.generator?.generatorId === "composition-graph-v0") {
    dispatchBuildingEvent("row_house", EventName.Delete, undefined, {
      sub_feature: "row_house_line",
      shape_type: "line",
    })
  } else if (element.properties?.category === "site_limit") {
    dispatchLimitEvent("site_limit", EventName.Delete)
  } else if (element.properties?.category === "zone") {
    dispatchLimitEvent("zone", EventName.Delete)
  } else if (element.properties?.category === "constraints") {
    dispatchLimitEvent("constraint", EventName.Delete)
  } else if (transportationApi.isTransportationElement(element)) {
    const category = element.properties?.category
    if (category === "road") {
      dispatchTransportationEvent("road", EventName.Delete)
    } else if (category === "rails") {
      dispatchTransportationEvent("rails", EventName.Delete)
    }
  } else if (element.properties?.category === "tree_line") {
    dispatchVegetationEvent("tree_line", EventName.Delete)
  } else if (element.properties?.category === "tree_area") {
    dispatchVegetationEvent("tree_area", EventName.Delete)
  } else if (isGenericElement(element, container)) {
    const genericType = getGenericElementType(container)
    if (genericType) {
      dispatchGenericElementEvent(genericType, EventName.Delete)
    }
  }
}

export function dispatchDeleteEvents(snapshot: ElementSnapshot, paths: string[]): void {
  for (const path of paths) {
    const node = snapshot.getNode(path)
    if (!node) continue

    const element = node.element
    const container = node.elementContainer

    dispatchElementDeleteEvent(element, container)
  }
}
