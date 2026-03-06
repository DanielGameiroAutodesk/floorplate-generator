import type { Feature, LineString, Polygon as GeojsonPolygon, Position } from "geojson"
import { CurvePath, LineCurve3, Matrix4, Vector3 } from "three"
import type { FormaElement, Transform } from "@spacemakerai/element-types"
import { makeAreaPositionField } from "./area/areaTreePositions"
import type { TreeElements, TreeElementVariant } from "./treeElements"
import type { TreeAreaConfig } from "./area/TreeAreaGenerator"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import { geometryFromGeojson } from "src/lib/three/geometryFromGeojson"
import { PROJECT_ID } from "src/core/project/project"
import { createUrn, newChildKey, newId } from "src/lib/element/urn"
import type { TreeLineConfig } from "./lines/TreeLinesGenerator"
import proj4 from "proj4"
import lineOffset from "@turf/line-offset"
import ArrayUtils from "src/lib/array"
import * as EPSG_32632 from "epsg-index/s/32632.json"

import type { Action } from "src/core/legacy-actions"

import type { InternalPath } from "src/lib/element/path"

import { shapeToPolygonFeature } from "src/lib/three/Shape/shapeUtils"
import insidePolygon from "robust-point-in-polygon"

type PolygonWithHoles = [number, number][][]

function getCoordinates(polygon: GeojsonPolygon): PolygonWithHoles {
  return polygon.coordinates as PolygonWithHoles
}

export function generateAreaTrees(
  batchId: string,
  revision: string,
  parentPath: InternalPath,
  definingPolygon: GeojsonPolygon,
  config: TreeAreaConfig,
  parentTransform: Matrix4,
  elevationAt: (x: number, y: number) => number,
): Action<"create">[] {
  const variants = getTreeElementVariantsLegacy("tree_area", batchId, config.height, revision)
  const result: Action<"create">[] = []

  const polygons: PolygonWithHoles[] = [getCoordinates(definingPolygon)]

  for (const polygon of polygons) {
    const treePositions = getPositions(polygon, parentTransform, config, elevationAt)
    for (const item of createTreeChildrenElements({
      parentPath,
      treePositions,
      variants,
    })) {
      result.push(item)
    }
  }

  return result
}

export function generateLineTrees(
  batchId: string,
  revision: string,
  parentPath: InternalPath,
  parentFeature: Feature,
  config: TreeLineConfig,
  parentTransform: Matrix4,
  elevationAt: (x: number, y: number) => number,
): Action<"create">[] {
  const { height } = config
  const treeRadius = height * 0.25

  if (parentFeature.geometry.type !== "LineString") return []

  const treePositions: Transform[] = lineStringToTreePositions({
    lineString: parentFeature.geometry,
    config,
    transform: parentTransform,
    treeRadius,
    elevationAt,
  })

  const variants = getTreeElementVariantsLegacy("tree_line", batchId, config.height, revision)

  return createTreeChildrenElements({
    parentPath,
    treePositions,
    variants,
  })
}

function getPositions(
  polygonWithHoles: PolygonWithHoles,
  parentElementTransform: Matrix4,
  config: TreeAreaConfig,
  elevationAt: (x: number, y: number) => number,
) {
  const { height, avgSpacing } = config
  const radius = height * 0.25

  const [outer, ...holes] = polygonWithHoles
  return makeAreaPositionField(
    outer.map(([x, y]) => ({ x, y })),
    radius * 2 + avgSpacing,
  )
    .filter(({ x, y }) => !holes.some((hole) => insidePolygon(hole, [x, y]) === -1))
    .map(({ x, y }) => new Vector3(x, y).applyMatrix4(parentElementTransform))
    .map(({ x, y }) => {
      const z = elevationAt(x, y)
      return new Matrix4().makeTranslation(x, y, z).premultiply(parentElementTransform.clone().invert()).toArray()
    })
}

export const getTreeElementVariants = (generatedBy: string, height: number, revision: string): TreeElementVariant[] => {
  const radius = height * 0.25
  const trunkRadius = radius * 0.2
  const trunkRatio = 0.25
  const trunkHeight = height * trunkRatio
  return [
    {
      trunk: makeTreeElement(generatedBy, trunkHeight, 0, trunkRadius, "#663300", revision),
      crown: makeTreeElement(generatedBy, height - trunkHeight, trunkHeight, radius, "#4fab4f", revision),
    },
    {
      trunk: makeTreeElement(generatedBy, trunkHeight, 0, trunkRadius, "#663300", revision),
      crown: makeTreeElement(generatedBy, height - trunkHeight, trunkHeight, radius, "#378a37", revision),
    },
    {
      trunk: makeTreeElement(generatedBy, trunkHeight, 0, trunkRadius, "#663300", revision),
      crown: makeTreeElement(generatedBy, height - trunkHeight, trunkHeight, radius, "#5cc95c", revision),
    },
  ]
}

export const getTreeElementVariantsLegacy = (
  generatedBy: string,
  proposalId: string,
  height: number,
  revision: string,
): TreeElementVariant[] => {
  const radius = height * 0.25
  const trunkRadius = radius * 0.2
  const trunkRatio = 0.25
  const trunkHeight = height * trunkRatio
  return [
    {
      trunk: makeTreeElementLegacy(generatedBy, proposalId, trunkHeight, 0, trunkRadius, "#663300", revision),
      crown: makeTreeElementLegacy(
        generatedBy,
        proposalId,
        height - trunkHeight,
        trunkHeight,
        radius,
        "#4fab4f",
        revision,
      ),
    },
    {
      trunk: makeTreeElementLegacy(generatedBy, proposalId, trunkHeight, 0, trunkRadius, "#663300", revision),
      crown: makeTreeElementLegacy(
        generatedBy,
        proposalId,
        height - trunkHeight,
        trunkHeight,
        radius,
        "#378a37",
        revision,
      ),
    },
    {
      trunk: makeTreeElementLegacy(generatedBy, proposalId, trunkHeight, 0, trunkRadius, "#663300", revision),
      crown: makeTreeElementLegacy(
        generatedBy,
        proposalId,
        height - trunkHeight,
        trunkHeight,
        radius,
        "#5cc95c",
        revision,
      ),
    },
  ]
}

export const createTreeChildrenElements = ({
  parentPath,
  treePositions,
  variants,
}: {
  parentPath: InternalPath
  treePositions: Transform[]
  variants: TreeElementVariant[]
}): Action<"create">[] => {
  const actions: Action<"create">[] = []

  for (const [i, pos] of treePositions.entries()) {
    const variant = variants[i % variants.length]

    const trunkKey = `${newChildKey()}-${i}-trunk`
    actions.push({
      type: "create",
      parentPath,
      child: { transform: pos, key: trunkKey },
      element: variant.trunk.element,
      representations: {
        footprint: variant.trunk.feature,
        volumeMesh: variant.trunk.geometry,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      persisted: false,
    })
    const crownKey = `${newChildKey()}-${i}-crown`
    actions.push({
      type: "create",
      parentPath,
      child: { transform: pos, key: crownKey },
      element: variant.crown.element,
      representations: {
        footprint: variant.crown.feature,
        volumeMesh: variant.crown.geometry,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      persisted: false,
    })
  }

  return actions
}

function makeTreeElement(
  sourceGeneratorId: string,
  height: number,
  zOffset = 0,
  radius: number,
  color: string,
  revision: string,
): TreeElements {
  const shape = circleFrom2Points([0, 0, zOffset], [radius, 0, zOffset])
  const feature = shapeToPolygonFeature(shape, height)
  const geometry = geometryFromGeojson(feature)
  if (!geometry) throw new Error("Failed to make geometry for tree")

  const element: FormaElement = {
    urn: createUrn("basic", PROJECT_ID, newId(), revision),
    properties: {
      category: "vegetation",
      color: color,
      generatedBy: sourceGeneratorId,
    },
  }

  return { element, feature, geometry }
}

function makeTreeElementLegacy(
  sourceGeneratorId: string,
  proposalId: string,
  height: number,
  zOffset = 0,
  radius: number,
  color: string,
  revision: string,
): TreeElements {
  const isBatchFlagSet = false
  const shape = circleFrom2Points([0, 0, zOffset], [radius, 0, zOffset])
  const feature = shapeToPolygonFeature(shape, height)
  const geometry = geometryFromGeojson(feature)
  if (!geometry) throw new Error("Failed to make geometry for tree")

  const id = isBatchFlagSet ? newId() : `${proposalId}+${newId()}`

  const element: FormaElement = {
    urn: createUrn("basic", PROJECT_ID, id, revision),
    properties: {
      category: "vegetation",
      color: color,
      generatedBy: sourceGeneratorId,
    },
  }

  return { element, feature, geometry }
}

function projectLineVertices(line: LineString, projFunc: (pos: Position) => Position): LineString {
  return {
    ...line,
    coordinates: line.coordinates.map((vertex) => projFunc(vertex)),
  }
}

function createLineOffsetEdges(lineString: LineString, offset: number, transform: Matrix4): [Vector3, Vector3][] {
  const projectedInput = projectLineVertices(lineString, (vertex) => proj4(EPSG_32632.wkt, "EPSG:4326", vertex))
  const result = lineOffset(projectedInput, offset, { units: "meters" })
  if (!result) return []

  const projectedResult = projectLineVertices(result.geometry, (vertex) => proj4("EPSG:4326", EPSG_32632.wkt, vertex))

  return ArrayUtils.sliding2(projectedResult.coordinates.map(([x, y]) => new Vector3(x, y).applyMatrix4(transform)))
}

function lineStringToTreePositions({
  lineString,
  config,
  transform,
  treeRadius,
  elevationAt,
}: {
  lineString: LineString
  config: TreeLineConfig
  transform: Matrix4
  treeRadius: number
  elevationAt: (x: number, y: number) => number
}): Transform[] {
  const { alignment, offset, spacing: configSpacing } = config
  const spacing = configSpacing + treeRadius * 2
  let edges: [Vector3, Vector3][] = []
  const curvePath = new CurvePath()

  switch (alignment) {
    case "center":
    case "top": {
      edges = createLineOffsetEdges(lineString, offset, transform)
      break
    }

    case "bottom": {
      edges = createLineOffsetEdges(lineString, -offset, transform)
      break
    }
  }

  edges.forEach(([start, end]) => {
    const lineCurve = new LineCurve3(start, end)
    curvePath.add(lineCurve)
  })

  const spacedPositions: Vector3[] = curvePath.getSpacedPoints(curvePath.getLength() / spacing) as Vector3[]

  const inverseTransform = transform.clone().invert()
  return spacedPositions.map((point) => {
    const z = elevationAt(point.x, point.y)
    return new Matrix4().makeTranslation(point.x, point.y, z).premultiply(inverseTransform).toArray()
  })
}
