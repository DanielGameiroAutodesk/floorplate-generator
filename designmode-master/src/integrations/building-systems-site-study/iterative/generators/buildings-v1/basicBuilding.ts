import { PROJECT_ID } from "src/core/project/project"
import { ElementContainer } from "src/core/elements/ElementContainer"

import { createBasicBuildingFromSimpleBuilding } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/createBasicBuildingFromSimpleBuilding"
import { toElements } from "src/integrations/building-systems-basic-building/lib/convert"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"
import type { BasicBuildingElement } from "src/integrations/building-systems-basic-building/lib/types"
import { makeBufferGeometryMap } from "src/integrations/building-systems-basic-building/BasicBuildingAPI"

import type { ExploreBuildingParameters } from "./generator"

type Point = [number, number]
type Polygon = Point[]
type PolygonWithHoles = { polygon: Polygon; holes: Polygon[] }

type Floor = {
  outerShapes: PolygonWithHoles[]
  height: number
  content: undefined
}

export function createBasicBuildingForExplore(params: ExploreBuildingParameters, footprint: Polygon) {
  const outerShape: PolygonWithHoles = { polygon: footprint, holes: [] }
  const outerShapes: PolygonWithHoles[] = [outerShape]
  const floors: Floor[] = []
  for (let i = 0; i < params.floors; i++) {
    const floor: Floor = { outerShapes, height: params.floorHeight, content: undefined }
    floors.push(floor)
  }

  const simpleBuilding = { floors }
  const basicBuilding = createBasicBuildingFromSimpleBuilding(simpleBuilding)
  const { buildingUrn, elements } = toElements(basicBuilding, PROJECT_ID, randomId(), String(Date.now()))
  const building = elements[buildingUrn] as BasicBuildingElement
  const geometries = makeBufferGeometryMap(building)

  const children = Object.values(elements)
    .filter((e) => e.urn !== buildingUrn)
    .map((e) =>
      ElementContainer.fromDraftElement(e, undefined, {
        volumeMesh: geometries.get(e.urn),
        footprint: undefined,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      }),
    )

  return ElementContainer.fromDraftElement(elements[buildingUrn], children, {
    volumeMesh: geometries.get(buildingUrn),
    footprint: undefined,
    terrainShape: undefined,
    terrainTexture: undefined,
    buildingFloors3DSketch_UNSTABLE: undefined,
  })
}
