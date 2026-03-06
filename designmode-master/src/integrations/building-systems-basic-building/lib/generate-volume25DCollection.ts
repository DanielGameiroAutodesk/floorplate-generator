import type { BasicBuilding } from "./types"
import type { Volume25DCollection } from "@spacemakerai/element-types"
import type { PolygonWithHolesXY, PolygonXY } from "./geometry/geometry"
import { getUnitLookup } from "./utils"

function toLinearRing(poly: PolygonXY) {
  const ring: [number, number][] = poly.map((p) => [p.x, p.y])
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
    ring.push(ring[0])
  }
  return ring
}

function toGeoJsonCoordinates(polyWithHoles: PolygonWithHolesXY) {
  return [toLinearRing(polyWithHoles.polygon), ...polyWithHoles.holes.map(toLinearRing)]
}

type Feature = {
  type: "Feature"
  id: string
  geometry: {
    type: "Polygon"
    coordinates: [number, number][][]
  }
  properties: {
    height: number
    elevation: number
    functionId?: string
    unitType?: string
  }
}

export function generateVolume25DCollection(building: BasicBuilding, floorIndex?: number) {
  let elevation = 0
  const unitLookup = getUnitLookup(building.units)
  const collection: Volume25DCollection = {
    type: "FeatureCollection",
    features: building.floors.flatMap((floor, i) => {
      let currentElevation = elevation
      elevation += floor.height
      if (floorIndex !== undefined && floorIndex !== i) return []
      return Object.values(floor.spaces).map((space) => {
        const unit = unitLookup(floor.id, space.id)
        const polygonWithHolesXY: PolygonWithHolesXY = {
          polygon: space.polygon.map((id) => floor.graph.vertices[id]),
          holes: space.holes.map((hole) => hole.map((id) => floor.graph.vertices[id])),
        }
        const feature: Feature = {
          type: "Feature",
          id: `building_${i}+${space.id}`,
          geometry: {
            type: "Polygon",
            coordinates: toGeoJsonCoordinates(polygonWithHolesXY),
          },
          properties: {
            functionId: unit?.functionId,
            unitType: unit?.program,
            height: floor.height,
            elevation: currentElevation,
          },
        }
        return feature
      })
    }),
  }
  return collection
}
