import type { BasicBuilding, BasicBuildingElement, ParkingRepresentation } from "./types"
import type { FormaElement, GrossFloorAreaPolygon, Urn } from "@spacemakerai/element-types"
import { generateParking } from "src/integrations/building-systems-common/lib-generators"
import type { Polygon, PolygonWithHoles } from "./geometry/geometry"
import { polygonWithHolesFromXY } from "./geometry/geometry"
import { getPolygonWithHolesFromSpace, getUnitLookup } from "./utils"

type OldFormaElement = {
  urn: Urn
  properties?: Record<string, any>
  representations?: Record<string, any>
  children?: { key: string; urn: Urn }[]
}

type GrossFloorArea = {
  /** Elevation relative to the element that has this representation */
  elevation: number
  /** Gross polygon for the area. List of rings of [x,y] points. First ring is the outer polygon, rest are holes */
  coordinates: number[][][]
}

type GFAUnit = {
  functionId?: string
  areaType?: string
  areas: GrossFloorArea[]
}

export function constructFloorUrnId(buildingId: string, floorIndex: number) {
  return `${buildingId}_${floorIndex}`
}

function createBlobId(id: string, revision: string, type: string) {
  return `basicbuilding:${id}~${revision}~${type}`
}

export function extractGrossFloorAreaPolygons(basicBuilding: BasicBuilding) {
  const areaStatsOld: GrossFloorAreaPolygon[][] = []
  const areaStatsNew: GFAUnit[][] = []
  const unitLookup = getUnitLookup(basicBuilding.units)
  let currentElevation = 0
  for (let i = 0; i < basicBuilding.floors.length; i++) {
    const polygons: GrossFloorAreaPolygon[] = []
    const gfaUnits: GFAUnit[] = []

    const floor = basicBuilding.floors[i]
    for (const space of Object.values(floor.spaces)) {
      const unit = unitLookup(floor.id, space.id)
      const polyWithHolesXY = getPolygonWithHolesFromSpace(space, floor.graph)

      const coordinates: [number, number][][] = [
        polyWithHolesXY.polygon.map(({ x, y }) => [x, y]),
        ...polyWithHolesXY.holes.map((hole) => hole.map(({ x, y }): [number, number] => [x, y])),
      ]

      polygons.push({
        grossFloorPolygon: coordinates,
        elevation: currentElevation,
        // Need cast since areaType doesn't accept "PARKING"
        areaType: unit?.program as GrossFloorAreaPolygon["areaType"],
      })

      gfaUnits.push({
        areaType: unit?.program as GrossFloorAreaPolygon["areaType"],
        functionId: unit?.functionId,
        areas: [{ coordinates, elevation: currentElevation }],
      })
    }
    areaStatsOld.push(polygons)
    areaStatsNew.push(gfaUnits)
    currentElevation += floor.height
  }
  return { areaStatsOld, areaStatsNew }
}

function extractParkingFiguresRepsPerFloor(basicBuilding: BasicBuilding): (ParkingRepresentation | undefined)[] {
  const results: (ParkingRepresentation | undefined)[] = []
  const unitLookup = getUnitLookup(basicBuilding.units)

  for (let i = 0; i < basicBuilding.floors.length; i++) {
    const floor = basicBuilding.floors[i]
    const parkingSpots: Polygon[] = []
    const parkingAreas: PolygonWithHoles[] = []

    for (const space of Object.values(floor.spaces)) {
      const unit = unitLookup(floor.id, space.id)
      if (unit?.generator?.generatorId !== "parking" || unit.generator?.params === undefined) continue
      const parkingParam = unit.generator.params
      const polygonWithHoles = polygonWithHolesFromXY(getPolygonWithHolesFromSpace(space, floor.graph))
      const parkingContent = generateParking([polygonWithHoles.polygon, ...polygonWithHoles.holes], parkingParam)
      const [surroundingPolygon, ...blockingPolygons] = parkingContent.polygon
      parkingAreas.push({ polygon: surroundingPolygon, holes: blockingPolygons })
      parkingSpots.push(...parkingContent.spots)
    }
    if (parkingSpots.length === 0) {
      results.push(undefined)
      continue
    }
    results.push({ parkingSpots, parkingAreas })
  }
  return results
}

function getFloorIdFunctions(basicBuilding: BasicBuilding) {
  // If all floors have same functionId, put it on the element,
  // otherwise hide it to avoid confusion when converting to 3dsketch
  let addFunctionIdToFloors = true
  const floorIdFunctions: Record<string, string | undefined> = {}
  outer: for (const unit of basicBuilding.units) {
    for (const space of unit.spaces) {
      if (space.floorId in floorIdFunctions) {
        if (floorIdFunctions[space.floorId] !== unit.functionId) {
          addFunctionIdToFloors = false
          break outer
        }
      } else {
        floorIdFunctions[space.floorId] = unit.functionId
      }
    }
  }
  return { addFunctionIdToFloors, floorIdFunctions }
}

export function toElementsOld(basicBuilding: BasicBuilding, authContext: string, id: string, revision: string) {
  const { areaStatsNew, areaStatsOld } = extractGrossFloorAreaPolygons(basicBuilding)
  const parkingStats = extractParkingFiguresRepsPerFloor(basicBuilding)
  const buildUrl = (representation: string) =>
    `/api/basicbuilding/elements/${id}/revisions/${revision}/rep/${representation}?authcontext=${authContext}`

  const { addFunctionIdToFloors, floorIdFunctions } = getFloorIdFunctions(basicBuilding)

  const children: OldFormaElement[] = basicBuilding.floors.map((floor, i) => {
    const volumeMesh = { id: "floor_" + i, url: buildUrl("volumeMesh") }
    const volume25DCollection = { id: `building_${i}+`, url: buildUrl("volume25DCollection") }
    return {
      urn: `urn:adsk-forma-elements:basicbuilding:${authContext}:${constructFloorUrnId(id, i)}:${revision}`,
      properties: {
        category: "floor",
        functionId: addFunctionIdToFloors ? floorIdFunctions[floor.id] : undefined,
      },
      representations: {
        volumeMesh,
        gfaUnits: areaStatsNew[i],
        grossFloorAreaPolygons: areaStatsOld[i],
        ...(parkingStats[i] ? { parking: parkingStats[i] } : {}),
        volume25DCollection,
      },
    } satisfies OldFormaElement
  })

  const element: OldFormaElement = {
    urn: `urn:adsk-forma-elements:basicbuilding:${authContext}:${id}:${revision}`,
    properties: {
      category: "building",
      ...basicBuilding.customProperties,
    },
    representations: {
      __INTERNAL__: basicBuilding,
      semanticMesh: { id: "building", url: buildUrl("semanticMesh") },
      graphBuilding_UNSTABLE: { id: "building", url: buildUrl("graphBuilding") },
      graphBuilding_V2_UNSTABLE: { id: "building", url: buildUrl("graphBuildingV2") },
      graphBuilding: { id: "building", url: buildUrl("graphBuildingV2") },
    },
    children: basicBuilding.floors.map((_, i) => ({ key: String(i), urn: children[i].urn })),
  }

  const elements: Record<Urn, OldFormaElement> = { [element.urn]: element }
  children.forEach((child) => (elements[child.urn] = child))

  return { buildingUrn: element.urn, elements }
}

export function toElements(
  basicBuilding: BasicBuilding,
  authContext: string,
  id: string,
  revision: string,
): { buildingUrn: Urn; elements: Record<Urn, FormaElement> } {
  const { areaStatsNew, areaStatsOld } = extractGrossFloorAreaPolygons(basicBuilding)
  const parkingStats = extractParkingFiguresRepsPerFloor(basicBuilding)
  const { addFunctionIdToFloors, floorIdFunctions } = getFloorIdFunctions(basicBuilding)

  const children: FormaElement[] = basicBuilding.floors.map((floor, i) => {
    return {
      urn: `urn:adsk-forma-elements:basicbuilding:${authContext}:${constructFloorUrnId(id, i)}:${revision}`,
      properties: {
        category: "floor",
        functionId: addFunctionIdToFloors ? floorIdFunctions[floor.id] : undefined,
      },
      representations: {
        volumeMesh: {
          type: "linked",
          blobId: createBlobId(id, revision, "volumeMesh"),
          selection: { type: "equals", value: "floor_" + i },
        },
        volume25DCollection: {
          type: "linked",
          blobId: createBlobId(id, revision, "volume25DCollection"),
          selection: { type: "startsWith", value: `building_${i}+` },
        },
        gfaUnits: { type: "embedded-json", data: areaStatsNew[i] },
        grossFloorAreaPolygons: { type: "embedded-json", data: areaStatsOld[i] },
        ...(parkingStats[i] ? { parking: { type: "embedded-json", data: parkingStats[i] } } : {}),
      },
    }
  })

  const element: BasicBuildingElement = {
    urn: `urn:adsk-forma-elements:basicbuilding:${authContext}:${id}:${revision}`,
    properties: {
      category: "building",
      ...basicBuilding.customProperties,
    },
    representations: {
      __INTERNAL__: { type: "embedded-json", data: basicBuilding },
      semanticMesh: {
        type: "linked",
        selection: { type: "equals", value: "building" },
        blobId: createBlobId(id, revision, "semanticMesh"),
      },
      graphBuilding_UNSTABLE: {
        type: "linked",
        selection: { type: "equals", value: "building" },
        blobId: createBlobId(id, revision, "graphBuilding"),
      },
      graphBuilding_V2_UNSTABLE: {
        type: "linked",
        selection: { type: "equals", value: "building" },
        blobId: createBlobId(id, revision, "graphBuildingV2"),
      },
      graphBuilding: {
        type: "linked",
        selection: { type: "equals", value: "building" },
        blobId: createBlobId(id, revision, "graphBuildingV2"),
      },
    },
    children: basicBuilding.floors.map((_, i) => ({ key: String(i), urn: children[i].urn })),
  }

  const elements: Record<Urn, FormaElement> = { [element.urn]: element }
  children.forEach((child) => (elements[child.urn] = child))

  return { buildingUrn: element.urn, elements }
}
