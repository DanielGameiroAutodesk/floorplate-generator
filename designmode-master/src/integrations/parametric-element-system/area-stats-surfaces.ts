import type { ElementContainer } from "src/core/elements/ElementContainer"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import { rowHouseApi, type RowHouseParameters } from "src/integrations/composition-row-house-generator/api"
import { isParcelComposition } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { transformMultiRingPolygon } from "src/integrations/area-stats/polygon-helpers"
import { getInMapOrThrow } from "src/lib/map"
import { Matrix4 } from "three"
import {
  isPrivateOutdoorSpaceElement,
  type PrivateOutdoorSpaceElement,
} from "src/integrations/composition-site-graph-parcel/privateOutdoorSpace/privateOutdoorSpaceGenerator"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { BuiltInSurfaceFunctions, type Surface } from "src/integrations/area-stats/surface"
import type { FormaElement, MultiRingPolygon } from "forma-elements"
import transportationApi, { type TransportationElement } from "src/integrations/transportation/lib/transportationApi"

export function getParametricAreaStatsSurfaces(container: ElementContainer): Surface[] {
  const element = container.element

  if (transportationApi.isTransportationElement(element)) {
    return areaStatsSurfacesTransportationElement(element)
  }
  if (lineBuildingApi.isLineBuildingFormaElement(element)) {
    return areaStatsSurfacesForLineBuilding(element)
  }

  if (isParcelComposition(element) || isCompositionElement(element)) {
    return areaStatsSurfacesForComposition(container)
  }

  if (isPrivateOutdoorSpaceElement(element)) {
    return areaStatsForPrivateOutdoorSpace(element)
  }

  if (rowHouseApi.isRowHouseElement(element)) {
    return [
      {
        polygon: groundPolygonFromRowHouse(element.properties.generator.parameters),
        functions: [{ id: BuiltInSurfaceFunctions.Building }],
        horizontalProjection: { type: "atElevation", elevation: 0 },
      },
    ]
  }
  return []
}

function areaStatsForPrivateOutdoorSpace(element: PrivateOutdoorSpaceElement) {
  return element.properties.privateOutdoorSpace.spaces.flatMap((space) =>
    space.polygons.map<Surface>((p) => ({
      functions: [{ id: BuiltInSurfaceFunctions.Vegetation }],
      polygon: [p],
      horizontalProjection: { type: "onGround" },
    })),
  )
}

function areaStatsSurfacesTransportationElement(element: TransportationElement) {
  const polygons = transportationApi.getPolygonsForAreaMetric(element)
  const transportationType = transportationApi.getTransportationType(element)
  const surfaceFunctionId =
    transportationType === "road" ? BuiltInSurfaceFunctions.Road : BuiltInSurfaceFunctions.RailRoad
  return polygons.map<Surface>((p) => ({
    functions: [{ id: surfaceFunctionId }],
    polygon: [p],
    horizontalProjection: { type: "onGround" },
  }))
}

function areaStatsSurfacesForLineBuilding(element: FormaElement): Surface[] {
  const simpleBuildings = lineBuildingApi.generateSimpleBuildings(element)
  return simpleBuildings.flatMap((building): Surface[] => {
    if (building.floors.length < 1) return []
    const groundFloor = building.floors[0]
    return groundFloor.outerShapes.map<Surface>((p) => ({
      functions: [{ id: BuiltInSurfaceFunctions.Building }],
      polygon: [p.polygon, ...p.holes],
      horizontalProjection: {
        type: "atElevation",
        elevation: 0,
      },
    }))
  })
}

function areaStatsSurfacesForComposition(container: ElementContainer) {
  const children = container.element.children ?? []
  return children.flatMap((child) => {
    const childContainer = getInMapOrThrow(container.childrenByUrn, child.urn)
    const childSurfaces = childContainer.areaStatsSurfaces.getOrCompute()
    const transform = child.transform ? new Matrix4().fromArray(child.transform) : undefined
    return transform
      ? childSurfaces.map((s) => ({ ...s, polygon: transformMultiRingPolygon(s.polygon, transform) }))
      : childSurfaces
  })
}

function groundPolygonFromRowHouse(parameters: RowHouseParameters): MultiRingPolygon {
  const l = -parameters.buildingWidth / 2
  const r = parameters.buildingWidth / 2
  const t = parameters.buildingDepth / 2
  const b = -parameters.buildingDepth / 2
  return [
    [
      [l, b],
      [l, t],
      [r, t],
      [r, b],
    ],
  ]
}
