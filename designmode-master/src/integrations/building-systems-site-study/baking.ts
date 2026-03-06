import type {
  PlacedSimpleBuilding,
  SimpleBuilding,
} from "src/integrations/building-systems-simple-buildings/simpleBuilding"
import { getTranslationMatrix } from "src/integrations/building-systems-common/geoHelpers"
import { useCallback } from "react"
import type { SimpleGraph } from "./simpleGraph"
import { graphToLineGraphs, graphToShape } from "./simpleGraph"
import polygonClipping from "polygon-clipping"
import { categoryToDefaultLineWidth, shapeToBasicLine } from "src/lib/three/Shape/shapeUtils"
import type { InternalPath } from "src/lib/element/path"
import { getLeafKey, getParentPath, mergePath } from "src/lib/element/path"
import type { ParkArea, SiteStudy } from "./generator/siteStudySpec"
import type { SiteStudyParams } from "./generator/siteStudySpec"
import type { PolygonWithHoles } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { BasicAction, BasicCreateAction } from "src/integrations/basic-elements/api/types"
import { BasicElementAPI, basicElementPresets } from "src/integrations/basic-elements/api/BasicElementAPI"
import type { SiteStudyInputPolygon, WithId } from "./SiteStudyToolState"
import { useSiteStudyToolParams } from "./SiteStudyToolState"
import { bufferPolygon } from "./generator/sketchStuff/helpers/polygonBuffer"
import type { Feature, Polygon as GeojsonPolygon } from "geojson"
import type { TreeAreaConfig } from "src/integrations/basic-elements/trees/area/TreeAreaGenerator"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { createBasicBuildingFromSimpleBuilding } from "src/integrations/building-systems-common/buildingMigrations/pureMigrationFunctions/createBasicBuildingFromSimpleBuilding"
import { contextRootSignal } from "src/core/selection/selectionState"
import { useIsImperial } from "src/lib/unitSettings"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type Polygon = [number, number][]

function pathsOfAddedElements(
  updateBuildingSelection: ((currentSelection: Set<InternalPath>) => Set<InternalPath>) | undefined,
  newSelections: { contextRoot?: string; key: string }[],
): InternalPath[] {
  const newPaths: InternalPath[] = newSelections.map((selection) => mergePath(selection.contextRoot, selection.key))
  return updateBuildingSelection ? Array.from(updateBuildingSelection(new Set(newPaths))) : newPaths
}

export function calculateElevationTransform(
  siteStudyInput: SiteStudyInputPolygon,
  simpleBuilding: SimpleBuilding,
  elevationAt: (x: number, y: number) => number,
  clampToTerrain: boolean,
) {
  if (siteStudyInput.setElevation) {
    return getTranslationMatrix(0, 0, siteStudyInput.setElevation)
  }
  if (clampToTerrain) {
    return getTranslationMatrix(
      0,
      0,
      Math.min(
        ...simpleBuilding.floors[0].outerShapes
          .map((poly) => poly.polygon)
          .flatMap((poly) => poly.map((point) => elevationAt(point[0], point[1]))),
      ),
    )
  }
  return getTranslationMatrix(0, 0, siteStudyInput.fallbackElevation)
}

export function useBaking() {
  const terrain = terrainSignal.value

  const bakeSimpleBuildings = useBakingSimpleBuildings()
  const bakeRoads = useBakingRoads()
  const bakeTreeAreas = useBakingTreeAreas()
  return useCallback(
    (selectedStudy: WithId<SiteStudy>, params: SiteStudyParams): { actions: Action[]; addedPaths: InternalPath[] } => {
      const buildings = selectedStudy.simpleBuildings.map((simpleBuilding) => {
        const transform = calculateElevationTransform(
          selectedStudy.studyPolygon,
          simpleBuilding,
          terrain.elevationAt,
          params.clampToTerrain,
        )
        return { ...simpleBuilding, transform }
      })
      const simpleBuildingActions = bakeSimpleBuildings(buildings)
      let actions = simpleBuildingActions.actions
      let newSelections: {
        contextRoot?: string
        key: string
      }[] = []
      if (params.roads || params.trees) {
        let basicActions: BasicAction[] = []
        if (params.roads) {
          try {
            basicActions.push(...bakeRoads(selectedStudy.roadGraph, selectedStudy.id))
          } catch (e) {
            console.error("Error baking roads")
            throw new Error(e as string)
          }
        }
        if (params.trees.enabled) {
          try {
            basicActions.push(...bakeTreeAreas(selectedStudy.parkAreas, params.trees.config, selectedStudy.id))
          } catch (e) {
            console.error("Error baking trees")
            throw new Error(e as string)
          }
        }
        // This needs to be called on all basic actions you want to do at the same time
        actions.push(...BasicElementAPI.basicActionsToCoreActions(basicActions))

        // Should probably find some better logic here which doesn't rely on internal basicActions properties
        newSelections.push(
          ...basicActions.map((ba) =>
            ba.type === "basic-update"
              ? { contextRoot: getParentPath(ba.path)!, key: getLeafKey(ba.path) }
              : { contextRoot: ba.parentPath, key: ba.child.key },
          ),
        )
      }

      return { actions, addedPaths: pathsOfAddedElements(simpleBuildingActions.selectionUpdate, newSelections) }
    },
    [terrain, bakeRoads, bakeSimpleBuildings, bakeTreeAreas],
  )
}

export const useBakingSimpleBuildings = () => {
  const actionApi = useActionAPI()
  return useCallback(
    (simpleBuildings: PlacedSimpleBuilding[]) => {
      const basicBuildingWithTransforms = simpleBuildings.map((simpleBuilding) => ({
        basicBuilding: createBasicBuildingFromSimpleBuilding(simpleBuilding),
        transform: simpleBuilding.transform,
      }))
      const newBuildingPaths: string[] = []
      const createBasicBuildingsActions = basicBuildingWithTransforms.flatMap(({ basicBuilding, transform }) => {
        const { actions, key } = BasicBuildingAPI.actions.createAddActions(basicBuilding, transform, actionApi)
        const buildingPath = contextRootSignal.peek() + "/" + key
        newBuildingPaths.push(buildingPath)
        return actions
      })
      return {
        actions: createBasicBuildingsActions,
        selectionUpdate: (curr: Set<string>) => {
          return new Set([...curr, ...newBuildingPaths])
        },
      }
    },
    [actionApi],
  )
}

export function areaOfPolygon(polygon: Polygon) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0[0] * p1[1] - p1[0] * p0[1])
  }

  return area
}

export function round(number: number, decimals: number) {
  const f = Math.pow(10, decimals)
  return Math.round((number + Number.EPSILON) * f) / f
}

export function parkAreasToFeatures(parkAreas: ParkArea[]) {
  const parkAreasWithFewerDecimals: ParkArea[] = parkAreas.map((parkArea) => ({
    outerLimit: parkArea.outerLimit.map(([x, y]) => [round(x, 4), round(y, 4)]),
    buildingFootPrints: parkArea.buildingFootPrints.map((poly) => poly.map(([x, y]) => [round(x, 4), round(y, 4)])),
  }))
  const parkPolygons: PolygonWithHoles[] = parkAreasWithFewerDecimals.flatMap((parkArea) => {
    const { outerLimit, buildingFootPrints } = parkArea
    const bufferedBuildingFootprints: Polygon[] = buildingFootPrints.flatMap((footPrint: Polygon) =>
      bufferPolygon(footPrint, -4),
    )
    const newParkPolygons: PolygonWithHoles[] = polygonClipping
      .difference([outerLimit], ...bufferedBuildingFootprints.map((fp) => [fp]))
      .map((polygon) => {
        const [outer, ...holes] = polygon
        return { polygon: outer, holes }
      })

    return newParkPolygons.filter((polygon) => {
      const area = areaOfPolygon(polygon.polygon)
      return area > 10
    })
  })

  const features: Feature<GeojsonPolygon>[] = parkPolygons.map((parkPolygon) => {
    const { polygon, holes } = parkPolygon
    return {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Polygon" as const,
        coordinates: [polygon, ...holes],
      },
    }
  })
  return features
}

const useBakingTreeAreas = () => {
  return useCallback(
    (parkAreas: ParkArea[], treeAreaConfig: TreeAreaConfig, studyBatchId: string): BasicCreateAction[] => {
      const features = parkAreasToFeatures(parkAreas)

      return features.map((feature) =>
        BasicElementAPI.create(
          contextRootSignal.peek(),
          feature,
          {
            ...basicElementPresets.tree_area,
            category: basicElementPresets.vegetation.category,
            treePlacerGenerator: {
              ...basicElementPresets.tree_area.treePlacerGenerator,
              ...treeAreaConfig,
              // Placing trees on rooftops doesn't work when switching between Explore proposals, so disable it for now
              placeOnRoof: false,
            },
          },
          undefined,
          {
            overrideBatchId: studyBatchId,
          },
        ),
      )
    },
    [],
  )
}

export function roadGraphToFeature(roadGraph: SimpleGraph, streetWidth: number | undefined, isImperial: boolean) {
  return graphToLineGraphs(roadGraph)
    .map(graphToShape)
    .map((shape) =>
      shapeToBasicLine(
        shape,
        { lineWidth: streetWidth || categoryToDefaultLineWidth(isImperial, basicElementPresets.road.category) },
        false,
      ),
    )
}

const useBakingRoads = () => {
  const isImperial = useIsImperial()
  const { streetWidth } = useSiteStudyToolParams()

  return useCallback(
    (roadGraph: SimpleGraph, studyBatchId: string): BasicCreateAction[] => {
      return roadGraphToFeature(roadGraph, streetWidth, isImperial).map((feature) =>
        BasicElementAPI.create(contextRootSignal.peek(), feature, basicElementPresets.road, undefined, {
          overrideBatchId: studyBatchId,
        }),
      )
    },
    [isImperial, streetWidth],
  )
}
