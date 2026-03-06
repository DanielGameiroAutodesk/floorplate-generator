import { useCallback, useErrorBoundary, useMemo, useState } from "preact/hooks"
import type { Matrix4 } from "three"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { RenderAPI, RenderedObject } from "src/integrations/render-api/RenderAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { RoofHandle, WallHandles } from "src/integrations/tools-common/PushPull/ExtrudedPolygonHandles"
import { isDefined } from "src/lib/array"
import { newId, parseUrn } from "src/lib/element/urn"
import { useLayoutEffect } from "react"
import type {
  BasicBuilding,
  BasicBuildingElement,
  Space,
} from "src/integrations/building-systems-basic-building/lib/types"
import type { Edges, Graph, Vertices } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import { getPolygonWithHolesFromSpace } from "src/integrations/building-systems-basic-building/lib/utils"
import type { Point } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  calculateUnionOfPolygonsWithHoles,
  polygonWithHolesFromXY,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { captureException } from "@sentry/browser"
import { elementState } from "src/core/elements/ElementState"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import { HiddenPaths } from "src/core/hidden"
import { getTranslator } from "src/i18n"

function getFloorAsGeojsonFeature(basicBuildingElement: BasicBuildingElement, floorIndex: number) {
  const basicBuilding: BasicBuilding = basicBuildingElement.representations.__INTERNAL__.data
  const floor = basicBuilding.floors[floorIndex]

  if (Object.values(floor.spaces).length !== 1 || Object.values(floor.spaces)[0].holes.length !== 0) {
    // only allow one space per floor and no holes for now
    return undefined
  }
  const space = Object.values(floor.spaces)[0]

  const coordinates = [space.polygon.map((s) => floor.graph.vertices[s]).map((p) => [p.x, p.y])]
  if (
    coordinates[0][0][0] !== coordinates[0][coordinates[0].length - 1][0] ||
    coordinates[0][0][1] !== coordinates[0][coordinates[0].length - 1][1]
  ) {
    coordinates[0].push(coordinates[0][0])
  }
  const elevation = basicBuilding.floors.slice(0, floorIndex).reduce((acc, floor) => acc + floor.height, 0)
  const geojson: ExtrudedPolygonFeature = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates,
    },
    properties: {
      height: floor.height,
      elevation,
    },
  }
  return geojson
}

function getBasicBuildingAsRoofGeojsonFeature(basicBuilding: BasicBuilding): ExtrudedPolygonFeature | undefined {
  const numberOfFloors = basicBuilding.floors.length
  const topFloor = basicBuilding.floors[numberOfFloors - 1]
  const topFloorFootPrint = calculateUnionOfPolygonsWithHoles(
    Object.values(topFloor.spaces).map((space) => getPolygonWithHolesFromSpace(space, topFloor.graph)),
  )
  const height = basicBuilding.floors.reduce((acc, floor) => acc + floor.height, 0)

  const { polygon, holes } = polygonWithHolesFromXY(topFloorFootPrint[0]) // pick one as this as multipolygons are not supported
  const coordinates: Point[][] = [polygon, ...holes]
  if (
    coordinates[0][0][0] !== coordinates[0][coordinates[0].length - 1][0] ||
    coordinates[0][0][1] !== coordinates[0][coordinates[0].length - 1][1]
  ) {
    coordinates[0].push(coordinates[0][0])
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates,
    },
    properties: {
      height,
      elevation: 0,
    },
  }
}

function getBasicBuildingAsGeojsonFeature(basicBuildingElement: BasicBuildingElement) {
  const basicBuilding: BasicBuilding = basicBuildingElement.representations.__INTERNAL__.data
  const floor = basicBuilding.floors[0]
  const space = Object.values(floor.spaces)[0]
  const calculateHash = (space: Space, graph: Graph) =>
    JSON.stringify(space.polygon.map((s) => graph.vertices[s]).flatMap(({ x, y }) => [x, y]))
  const hash = calculateHash(space, floor.graph)
  const hasMoreThanOneSpaceOrHoles = basicBuilding.floors.some((floor) => {
    const spaces = Object.values(floor.spaces)
    if (spaces.length !== 1 || spaces[0].holes.length !== 0) return true
  })
  const hasMoreThanOneFootPrint = basicBuilding.floors.some(
    (floor) => calculateHash(Object.values(floor.spaces)[0], floor.graph) !== hash,
  )
  if (hasMoreThanOneSpaceOrHoles || hasMoreThanOneFootPrint) {
    // only allow one space per floor and no holes, and all floors must have the same footprint
    const roofGeoJason = getBasicBuildingAsRoofGeojsonFeature(basicBuilding)
    return { roofGeoJason }
  }

  const coordinates: Point[][] = [space.polygon.map((s) => floor.graph.vertices[s]).map((p) => [p.x, p.y])]
  if (
    coordinates[0][0][0] !== coordinates[0][coordinates[0].length - 1][0] ||
    coordinates[0][0][1] !== coordinates[0][coordinates[0].length - 1][1]
  ) {
    coordinates[0].push(coordinates[0][0])
  }
  const height = basicBuilding.floors.reduce((acc, floor) => acc + floor.height, 0)
  const geojson: ExtrudedPolygonFeature = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates,
    },
    properties: {
      height,
      elevation: 0,
    },
  }
  return { wallGeoJason: geojson, roofGeoJason: geojson }
}

function getStepSizeForRoofPushPull(basicBuildingElement: BasicBuildingElement) {
  const n = basicBuildingElement.representations.__INTERNAL__.data.floors.length
  return basicBuildingElement.representations.__INTERNAL__.data.floors[n - 1].height
}

function getBuildingWithNewHeight(newHeight: number, basicBuildingElement: BasicBuildingElement) {
  let sumHeight = 0
  const building: BasicBuilding = basicBuildingElement.representations.__INTERNAL__.data
  const floorsToKeep = building.floors.filter((floor) => {
    sumHeight += floor.height
    return sumHeight <= newHeight + 1e-8
  })
  const extraFloors = Math.round(
    Math.max((newHeight - sumHeight) / building.floors[building.floors.length - 1].height, 0),
  )
  const newNumberOfFloors = Math.max(floorsToKeep.length + extraFloors, 1)
  return BasicBuildingAPI.updateNumberOfFloors(basicBuildingElement, newNumberOfFloors)
}

function BasicBuildingPushPull({
  basicBuildingElement,
  path,
  worldTransform,
}: {
  basicBuildingElement: BasicBuildingElement
  path: InternalPath
  worldTransform: Matrix4
}) {
  const actionAPI = useActionAPI()
  const previewRenderAPI = useRenderAPI("basicbuildingpushpull")
  const { wallGeoJason, roofGeoJason } = useMemo(
    () => getBasicBuildingAsGeojsonFeature(basicBuildingElement),
    [basicBuildingElement],
  )

  const roofPreviewFunction = useCallback(
    (zDiff: number) => {
      const basicBuilding = basicBuildingElement.representations.__INTERNAL__.data
      const newHeight = basicBuilding.floors.reduce((acc, f) => acc + f.height, 0) + zDiff
      const newBuilding = getBuildingWithNewHeight(newHeight, basicBuildingElement)
      const geometries = BasicBuildingAPI.makePreviewObjects(newBuilding, worldTransform.toArray())
      for (const geometry of geometries) {
        previewRenderAPI.upsert(geometry)
      }
      return () => previewRenderAPI.cleanup()
    },
    [basicBuildingElement, previewRenderAPI, worldTransform],
  )

  const stepSize = getStepSizeForRoofPushPull(basicBuildingElement)

  return (
    <>
      {wallGeoJason && (
        <WallHandles
          id={path}
          feature={wallGeoJason}
          worldTransform={worldTransform}
          onComplete={(id, geojson) => {
            const { polygon, graph } = getPolygonAndGraphFromGeojson(geojson)
            const building: BasicBuilding = basicBuildingElement.representations.__INTERNAL__.data
            const newFloors = building.floors.map((floor) => ({
              ...floor,
              spaces: {
                [Object.keys(floor.spaces)[0]]: {
                  ...Object.values(floor.spaces)[0],
                  polygon: polygon.map((v) => v.id),
                },
              },
              graph,
            }))

            const newBuilding = { ...building, floors: newFloors }
            BasicBuildingAPI.actions.executeUpdate("Push pull wall", path, basicBuildingElement, newBuilding, actionAPI)
            previewRenderAPI.cleanup()
            HiddenPaths.setPathHidden(path, false)
          }}
          onStart={() => HiddenPaths.setPathHidden(path, true)}
          onCancel={() => HiddenPaths.setPathHidden(path, false)}
        />
      )}
      {roofGeoJason && (
        <RoofHandle
          id={path}
          feature={roofGeoJason}
          worldTransform={worldTransform}
          onComplete={(_, geojson) => {
            const newHeight = geojson.properties.height
            const newBuilding = getBuildingWithNewHeight(newHeight, basicBuildingElement)
            BasicBuildingAPI.actions.executeUpdate("Push pull roof", path, basicBuildingElement, newBuilding, actionAPI)
            previewRenderAPI.cleanup()
            HiddenPaths.setPathHidden(path, false)
          }}
          stepSize={stepSize}
          onStart={() => HiddenPaths.setPathHidden(path, true)}
          onCancel={() => HiddenPaths.setPathHidden(path, false)}
          previewFunction={roofPreviewFunction}
        />
      )}
    </>
  )
}

function getPolygonAndGraphFromGeojson(geojson: ExtrudedPolygonFeature) {
  const polygon = geojson.geometry.coordinates[0]
    .map(([x, y]) => ({ x, y, id: newId() }))
    .filter((p, i, l) => {
      const next = l[(i + 1) % l.length]
      return p.x !== next.x || p.y !== next.y
    })
  const graph: Graph = {
    vertices: polygon.reduce((acc, p) => {
      acc[p.id] = p
      return acc
    }, {} as Vertices),
    edges: polygon.reduce((acc, p, i) => {
      const end = polygon[(i + 1) % polygon.length]
      const id = newId()
      acc[id] = { id, start: p.id, end: end.id }
      return acc
    }, {} as Edges),
  }
  return { polygon, graph }
}

function FloorPushPull({
  floorIndex,
  basicBuildingElement,
  floorPath,
  buildingPath,
  worldTransform,
  renderApi,
}: {
  floorIndex: number
  basicBuildingElement: BasicBuildingElement
  floorPath: InternalPath
  buildingPath: InternalPath
  worldTransform: Matrix4
  renderApi: RenderAPI
}) {
  const actionAPI = useActionAPI()

  const [visuals, setVisuals] = useState<undefined | RenderedObject[]>(undefined)
  const toggleVisuals = useCallback(
    (override: boolean) => {
      HiddenPaths.setPathHidden(buildingPath, override)
      if (override) {
        const visuals = BasicBuildingAPI.makePreviewObjects(
          basicBuildingElement.representations.__INTERNAL__.data,
          worldTransform.toArray(),
          [floorIndex],
        )
        setVisuals(visuals)
      } else {
        setVisuals(undefined)
      }
    },
    [basicBuildingElement, buildingPath, floorIndex, worldTransform],
  )

  useLayoutEffect(() => {
    if (visuals) {
      visuals.forEach((v) => renderApi.upsert(v))
      return () => visuals.forEach((v) => renderApi.remove(v.id))
    }
  }, [renderApi, visuals])

  const geojson = useMemo(
    () => getFloorAsGeojsonFeature(basicBuildingElement, floorIndex),
    [basicBuildingElement, floorIndex],
  )

  return !geojson ? null : (
    <WallHandles
      id={floorPath}
      feature={geojson}
      worldTransform={worldTransform}
      onComplete={(_, geojson) => {
        const { polygon, graph } = getPolygonAndGraphFromGeojson(geojson)
        const building: BasicBuilding = basicBuildingElement.representations.__INTERNAL__.data
        const newFloors = [...building.floors]
        const floor = building.floors[floorIndex]
        newFloors[floorIndex] = {
          ...floor,
          spaces: {
            [Object.keys(floor.spaces)[0]]: { ...Object.values(floor.spaces)[0], polygon: polygon.map((v) => v.id) },
          },
          graph,
        }
        const newBuilding = { ...building, floors: newFloors }
        BasicBuildingAPI.actions.executeUpdate(
          "Push pull wall floor",
          buildingPath,
          basicBuildingElement,
          newBuilding,
          actionAPI,
        )
        toggleVisuals(false)
      }}
      onStart={() => toggleVisuals(true)}
      onCancel={() => toggleVisuals(false)}
    />
  )
}

function BasicBuildingsPushPullInner() {
  const snapshot = elementState.currentSnapshot.value
  const selectedNodes = selectedNodesSignal.value
  const renderApi = useRenderAPI("basic-push-pull")

  const selectedBasicBuildings = useMemo(() => {
    return selectedNodes
      .map((node) => {
        if (node && BasicBuildingAPI.isBasicBuilding(node.element)) {
          return { path: node.path, basicBuildingElement: node.element, worldTransform: node.globalMatrix }
        }
        return undefined
      })
      .filter(isDefined)
  }, [selectedNodes])

  const selectedFloors = useMemo(() => {
    return selectedNodes
      .map((node) => {
        const element = node.element
        if (element && BasicBuildingAPI.isBasicFloor(element)) {
          const buildingPath = getParentPath(node.path)!
          const basicBuildingNode = snapshot.getNodeOrThrow(buildingPath)
          const basicBuildingElement = basicBuildingNode.element as BasicBuildingElement
          const { floorIndex } = BasicBuildingAPI.deconstructFloorId(parseUrn(element.urn).id)
          return {
            buildingPath,
            floorPath: node.path,
            floorIndex,
            basicBuildingElement,
            worldTransform: basicBuildingNode.globalMatrix,
          }
        }
        return undefined
      })
      .filter(isDefined)
  }, [selectedNodes, snapshot])

  return (
    <>
      {selectedBasicBuildings.map(({ path, basicBuildingElement, worldTransform }) => (
        <BasicBuildingPushPull
          key={path}
          basicBuildingElement={basicBuildingElement}
          worldTransform={worldTransform}
          path={path}
        />
      ))}

      {selectedFloors.map(({ floorPath, buildingPath, floorIndex, basicBuildingElement, worldTransform }) => (
        <FloorPushPull
          key={floorPath}
          floorPath={floorPath}
          basicBuildingElement={basicBuildingElement}
          worldTransform={worldTransform}
          buildingPath={buildingPath}
          floorIndex={floorIndex}
          renderApi={renderApi}
        />
      ))}
    </>
  )
}

export function BasicBuildingsPushPull() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("BasicBuildingsPushPull error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "building-systems" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.building.failedToPushPull), status: "warning" })
  })
  if (error) return null
  return <BasicBuildingsPushPullInner />
}
