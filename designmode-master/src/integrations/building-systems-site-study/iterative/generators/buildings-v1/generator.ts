import { Matrix4 } from "three"
import { feetToMeter } from "@spacemakerai/forma-units"

import { newChildKey } from "src/lib/element/urn"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

import {
  fillPolygonWithTechnique,
  type ExploreBuilding,
  type ExploreLinearBuilding,
  type ExplorePolygonalBuilding,
  type Polygon,
  type Technique,
} from "./adapter"
import { createBasicBuildingForExplore } from "./basicBuilding"
import { createLineBuildingForExplore } from "./lineBuilding"

export type ExploreBuildingParameters = {
  floors: number
  floorHeight: number
  buildingWidth: number
  towerWidth: number
}
export type GeneratorParameters = {
  polygon: Polygon
  technique: Technique
} & ExploreBuildingParameters

export function fillPolygonWithExploreBuildings(parameters: GeneratorParameters): ExploreBuilding[] {
  const { polygon, technique, floors, buildingWidth, towerWidth } = parameters
  const primaryResult = fillPolygonWithTechnique(polygon, technique, floors, buildingWidth, towerWidth)
  if (primaryResult.length > 0) return primaryResult

  const secondaryResult = fillPolygonWithTechnique(polygon, "fanBuildings", floors, buildingWidth, towerWidth)
  if (secondaryResult.length > 0) return secondaryResult

  return [{ type: "polygonal", polygons: [polygon] }]
}

function isExplorePolygonalBuilding(eb: ExploreBuilding): eb is ExplorePolygonalBuilding {
  return eb.type == "polygonal"
}
function isExploreLinearBuilding(eb: ExploreBuilding): eb is ExploreLinearBuilding {
  return eb.type == "linear"
}

const elevationAt = (x: number, y: number) => terrainSignal.peek().elevationAt(x, y)

function createBasicBuildingsFromPolygonalBuildings(
  parameters: GeneratorParameters,
  exploreBuildings: ExplorePolygonalBuilding[],
): { elementContainer: ElementContainer; elevation: number }[] {
  return exploreBuildings
    .flatMap((eb) => eb.polygons)
    .map((polygon) => {
      const elementContainer = createBasicBuildingForExplore(parameters, polygon)
      const elevation = Math.min(...polygon.map(([x, y]) => elevationAt(x, y)))
      return { elementContainer, elevation }
    })
}

function createLineBuildingsFromLinearBuildings(
  parameters: GeneratorParameters,
  exploreBuildings: ExploreLinearBuilding[],
  imperialFlag: boolean,
): { elementContainer: ElementContainer; elevation: number }[] {
  return exploreBuildings.map((eb) => {
    const elementContainer = createLineBuildingForExplore(parameters, eb, imperialFlag)
    const elevation = Math.min(...Object.values(eb.graph.vertices).map((vertex) => elevationAt(vertex.x, vertex.y)))
    return { elementContainer, elevation }
  })
}

export function generate(parameters: GeneratorParameters, imperialFlag: boolean) {
  if (parameters.technique === "blank") {
    // TODO: This is a hack to end up with no children to be used in a SiteExploreArea element generator config
    // but maybe this should not be a "generator" at all, as it's not generating anything
    return []
  }
  const graphBuildings = fillPolygonWithExploreBuildings(parameters)

  const buildings: { elementContainer: ElementContainer; elevation: number }[] = [
    ...createBasicBuildingsFromPolygonalBuildings(parameters, graphBuildings.filter(isExplorePolygonalBuilding)),
    ...createLineBuildingsFromLinearBuildings(parameters, graphBuildings.filter(isExploreLinearBuilding), imperialFlag),
  ]
  return buildings.map(({ elementContainer, elevation }) => ({
    elementContainer,
    child: {
      key: newChildKey(),
      urn: elementContainer.element.urn,
      transform: new Matrix4().makeTranslation(0, 0, elevation).toArray(),
    },
  }))
}

export const createDefaultBuildingsGeneratorConfig = (polygon: Polygon, imperialFlag: boolean, blank: boolean) =>
  ({
    generatorId: "site-explore-area-buildings-v1",
    parameters: {
      polygon,
      technique: blank ? "blank" : "closedCityBlock",
      floors: 4,
      floorHeight: imperialFlag ? feetToMeter(10) : 3,
      buildingWidth: imperialFlag ? feetToMeter(40) : 12,
      towerWidth: imperialFlag ? feetToMeter(70) : 18,
    },
  }) as const
