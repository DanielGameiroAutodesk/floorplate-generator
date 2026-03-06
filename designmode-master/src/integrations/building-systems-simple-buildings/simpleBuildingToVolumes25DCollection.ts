import type { Volume25D, Volume25DCollection } from "@spacemakerai/element-types"
import { v4 } from "uuid"
import type { SimpleBuilding, SimpleFloor, SimpleFloorPlan } from "./simpleBuilding"
import type { PolygonWithHoles } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"

export function simpleBuildingsToVolume25DCollection(
  simpleBuildings: SimpleBuilding[],
  featureIdPrefix: string,
): Volume25DCollection {
  const buildingCollections = simpleBuildings.map((building) =>
    simpleBuildingToVolume25DCollection(building, featureIdPrefix),
  )
  return buildingCollections.reduce(
    (collection, current): Volume25DCollection => ({
      ...collection,
      features: collection.features.concat(current.features),
    }),
  )
}

function simpleBuildingToVolume25DCollection(
  simpleBuilding: SimpleBuilding,
  featureIdPrefix: string,
): Volume25DCollection {
  const newPrefix = simpleBuilding.id ? `${featureIdPrefix}+${simpleBuilding.id}` : featureIdPrefix
  let cumElevation = 0
  const floorCollections = simpleBuilding.floors.map((floor) => {
    const collection = simpleFloorToVolume25DCollection(floor, cumElevation, newPrefix)
    cumElevation += floor.height
    return collection
  })
  return floorCollections.reduce(
    (collection, current): Volume25DCollection => ({
      ...collection,
      features: collection.features.concat(current.features),
    }),
  )
}

function floorPlanToVolume25D(
  featureIdPrefix: string,
  floorHeight: number,
  floorElevation: number,
  floorPlan: SimpleFloorPlan,
): Volume25D[] {
  return floorPlan.units.map(
    (unit): Volume25D => ({
      type: "Feature",
      id: `${featureIdPrefix}+${unit.id || v4()}`,
      geometry: {
        type: "Polygon",
        coordinates: [unit.polygon, ...unit.holes],
      },
      properties: {
        structure: unit.type,
        height: floorHeight,
        elevation: floorElevation,
      },
    }),
  )
}

function outerShapesToVolume25D(
  featureIdPrefix: string,
  floorHeight: number,
  floorElevation: number,
  outerShapes: PolygonWithHoles[],
): Volume25D[] {
  return outerShapes.map((outerShape) => ({
    type: "Feature",
    id: `${featureIdPrefix}+${v4()}`,
    geometry: {
      type: "Polygon",
      coordinates: [outerShape.polygon, ...outerShape.holes],
    },
    properties: {
      height: floorHeight,
      elevation: floorElevation,
    },
  }))
}

export function simpleFloorToVolume25DCollection(
  simpleFloor: SimpleFloor,
  elevation: number,
  featureIdPrefix: string,
): Volume25DCollection {
  const newPrefix = simpleFloor.id ? `${featureIdPrefix}+${simpleFloor.id}` : featureIdPrefix
  return {
    type: "FeatureCollection",
    features: simpleFloor.content
      ? floorPlanToVolume25D(newPrefix, simpleFloor.height, elevation, simpleFloor.content)
      : outerShapesToVolume25D(newPrefix, simpleFloor.height, elevation, simpleFloor.outerShapes),
  }
}
