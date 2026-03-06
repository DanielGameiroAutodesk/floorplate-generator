import type {
  FormaElement,
  JsonRepresentations,
  Properties,
  TerrainShapeFeatureProperties,
  Urn,
} from "@spacemakerai/element-types"
import { newId, replaceRevision } from "src/lib/element/urn"
import {
  getRadiusPerCorner,
  getRadiusPerCornerWithPointDelete,
  getRadiusPerCornerWithPointInsert,
  getRadiusPerCornerWithPointUpdate,
  insertUpdatedRadius,
} from "./curvesCore"
import {
  getStartEndPointPerCurve,
  linestringFromCircleSegmentCurve,
  polygonsFromCircleSegmentCurve,
  sampleCurveWithNormalsAtRegularIntervals,
} from "./curvesDiscretization"
import { Vector2 } from "three"
import type * as GeoJson from "geojson"
import type { Feature, LineString } from "geojson"
import { assertNever } from "src/lib/assertNever"

const SYSTEM_NAME = "parametric"
const GENERATOR_ID = "transportation-api-v0"
export type TransportType = "road" | "rail"

type DefiningRepresentation = {
  bufferedCurve: BufferedCurve
  type: TransportType
}

export type TransportationElement = FormaElement & {
  properties: Properties & { __INTERNAL__: DefiningRepresentation; generator: { generatorId: string } }
}

export type RadiusPoint = {
  id: string
  position: {
    x: number
    y: number
  }
  radius: number
}

export type RadiusPointsUnprocessed = Omit<RadiusPoint, "radius">

export type BufferedCurve = {
  points: RadiusPoint[]
  width: number
}

function isTransportationElement(element: FormaElement | undefined): element is TransportationElement {
  if (element === undefined) return false
  return element?.properties?.generator?.generatorId === GENERATOR_ID
}

function transportTypeToElementCategory(type: TransportType) {
  switch (type) {
    case "road":
      return "road"
    case "rail":
      return "rails"
    default:
      assertNever(type)
  }
}

// TODO: Look at usages of this and consider if we can pass the element around instead
function extractDefiningRep(element: TransportationElement) {
  return element.properties.__INTERNAL__
}

function _createLineStringFromPoints(controlPoints: RadiusPoint[]) {
  const vec2s = controlPoints.map((x) => new Vector2(x.position.x, x.position.y))
  const radiusPerCorner = controlPoints.map((p) => p.radius)
  return linestringFromCircleSegmentCurve(vec2s, radiusPerCorner)
}

function _getCurveEndPoints(bufferedCurve: BufferedCurve) {
  const controlPoints = bufferedCurve.points
  const vec2s = controlPoints.map((x) => new Vector2(x.position.x, x.position.y))
  const radiusPerCorner = controlPoints.map((p) => p.radius)
  const startAndEndPtsPerCurve = getStartEndPointPerCurve(vec2s, radiusPerCorner)
  const degenerateCurveMask = startAndEndPtsPerCurve.map(
    ([startPt, endPt]) => startPt.point.distanceTo(endPt.point) < 1e-6,
  )
  const filterStartPtMask = [degenerateCurveMask[0]].concat(
    startAndEndPtsPerCurve.slice(1).map(([startPt], i) => {
      if (degenerateCurveMask[i + 1]) return true
      const prevEndPt = startAndEndPtsPerCurve[i][1]
      return startPt.point.distanceTo(prevEndPt.point) < 1e-6
    }),
  )
  const filterEndPtMask = startAndEndPtsPerCurve
    .slice(0, -1)
    .map(([startPt, endPt], i) => {
      if (degenerateCurveMask[i]) return true
      const [nextStartPt, nextEndPt] = startAndEndPtsPerCurve[i + 1]
      if (endPt.point.distanceTo(nextStartPt.point) > 1e-6) return false
      if (degenerateCurveMask[i + 1]) return true
      if (Math.abs(radiusPerCorner[i + 1] - radiusPerCorner[i + 2]) > 1e-6) return false
      if (startPt.direction.cross(endPt.direction) * nextStartPt.direction.cross(nextEndPt.direction) < 0) return false
      return true
    })
    .concat([degenerateCurveMask[degenerateCurveMask.length - 1]])
  return startAndEndPtsPerCurve.flatMap((pts, i) => {
    const ptsToInclude = [...pts]
    if (filterStartPtMask[i]) ptsToInclude.shift()
    if (filterEndPtMask[i]) ptsToInclude.pop()
    return ptsToInclude
  })
}

function getCurveEndPointSeparationSegments(element: TransportationElement): [Vector2, Vector2][] {
  const bufferedCurve = extractDefiningRep(element).bufferedCurve
  const endPoints = _getCurveEndPoints(bufferedCurve)
  const width = bufferedCurve.width
  return endPoints.map((endPoint) => {
    const orthogonal = new Vector2(-endPoint.direction.y, endPoint.direction.x)
    const start = endPoint.point.clone().sub(orthogonal.clone().multiplyScalar(width / 2))
    const end = endPoint.point.clone().add(orthogonal.clone().multiplyScalar(width / 2))
    return [start, end]
  })
}

function generatePolygons(controlPoints: RadiusPointsUnprocessed[], defaultRadius: number | undefined, width: number) {
  const vec2s = controlPoints.map((x) => new Vector2(x.position.x, x.position.y))
  const radiusPerCorner = getRadiusPerCorner(
    controlPoints.map((p) => new Vector2(p.position.x, p.position.y)),
    defaultRadius,
  )
  return polygonsFromCircleSegmentCurve(vec2s, radiusPerCorner, width)
}

//TODO is this redundant?
function createCurveLineString(controlPoints: RadiusPointsUnprocessed[], defaultRadius: number | undefined) {
  const vec2s = controlPoints.map((x) => new Vector2(x.position.x, x.position.y))
  const radiusPerCorner = getRadiusPerCorner(vec2s, defaultRadius)
  return linestringFromCircleSegmentCurve(vec2s, radiusPerCorner)
}

function _generatePolygons(bufferedCurve: BufferedCurve, width: number) {
  const vec2s = bufferedCurve.points.map((x) => new Vector2(x.position.x, x.position.y))
  const radiusPerCorner = bufferedCurve.points.map((p) => p.radius)
  return polygonsFromCircleSegmentCurve(vec2s, radiusPerCorner, width)
}

function generateLineString(bufferedCurve: BufferedCurve): LineString {
  const coordinates = _createLineStringFromPoints(bufferedCurve.points)
  return { type: "LineString", coordinates }
}

function _generateFootPrintRepresentation(lineString: LineString) {
  const footprintFeature: Feature<LineString> = {
    type: "Feature",
    properties: {},
    //TODO should have a id?
    id: "transport-id",
    geometry: lineString,
  }

  const footprintFeatureCollection: JsonRepresentations["footprint"] = {
    type: "FeatureCollection",
    features: [footprintFeature],
  }
  return { footprintFeature, footprintFeatureCollection }
}

export const roadColor = "#999999"

function generateTerrainShape(bufferedCurve: BufferedCurve, width: number, type: TransportType) {
  if (type === "road") {
    const polygons = _generatePolygons(bufferedCurve, width)

    const color = roadColor

    const features: GeoJson.Feature<GeoJson.Polygon, TerrainShapeFeatureProperties>[] = polygons.map((polygon) => ({
      type: "Feature",
      properties: {
        fill: { color, opacity: 1 },
      },
      geometry: {
        type: "Polygon",
        coordinates: [polygon],
      },
    }))

    const terrainShapeFeatureCollection: JsonRepresentations["terrainShape"] = {
      type: "FeatureCollection",
      features,
    }
    return terrainShapeFeatureCollection
  } else if (type === "rail") {
    return railroadTiesFromCurve(bufferedCurve.points, width, "rail")
  } else {
    assertNever(type)
  }
}

// These constants match the legacy dashed line renderer the best
const TIE_SPACING = 2.1
const TIE_WIDTH = 1.8

function railroadTiesFromCurve(
  controlPoints: RadiusPoint[],
  lineWidth: number,
  id: string,
): JsonRepresentations["terrainShape"] {
  const vec2s = controlPoints.map((x) => new Vector2(x.position.x, x.position.y))
  const radiusPerCorner = controlPoints.map((p) => p.radius)
  const { points, normals } = sampleCurveWithNormalsAtRegularIntervals(vec2s, radiusPerCorner, TIE_SPACING)
  const features: GeoJson.Feature<GeoJson.LineString, TerrainShapeFeatureProperties>[] = []
  points.forEach((point, i) => {
    const normal = normals[i]
    const offset = [normal.x * lineWidth * 0.5, normal.y * lineWidth * 0.5]
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [point.x + offset[0], point.y + offset[1]],
          [point.x - offset[0], point.y - offset[1]],
        ],
      },
      properties: { stroke: { lineWidth: TIE_WIDTH, color: "#676767" } },
      id: `${id}-${i}`,
    })
  })
  return {
    type: "FeatureCollection",
    features,
  }
}

function createElement(
  bufferedCurve: BufferedCurve,
  type: TransportType,
  urn: Urn,
  properties?: Properties,
  metadata?: Record<string, any>,
) {
  const lineString = generateLineString(bufferedCurve)
  const { footprintFeatureCollection } = _generateFootPrintRepresentation(lineString)

  let terrainShape: JsonRepresentations["terrainShape"] = generateTerrainShape(bufferedCurve, bufferedCurve.width, type)
  const formaElement: TransportationElement = {
    urn: urn,
    representations: {
      terrainShape: {
        type: "embedded-json",
        data: terrainShape,
      },
      footprint: {
        type: "embedded-json",
        data: footprintFeatureCollection,
      },
    },
    properties: {
      ...(properties ? properties : {}),
      __INTERNAL__: { bufferedCurve, type },
      generator: { generatorId: GENERATOR_ID },
      category: type === "rail" ? "rails" : "road",
    },
    ...(metadata ? { metadata } : {}),
  }
  return formaElement
}

function createTransportationElement(
  points: RadiusPointsUnprocessed[],
  urn: Urn,
  defaultRadius: number | undefined,
  width: number,
  type: TransportType,
  properties?: Properties,
  metadata?: Record<string, any>,
): TransportationElement | undefined {
  if (points.length < 2) return

  const radiusPerCorner = getRadiusPerCorner(
    points.map((p) => new Vector2(p.position.x, p.position.y)),
    defaultRadius,
  )
  const bufferedCurve: BufferedCurve = {
    points: points.map((p, i) => ({ ...p, radius: radiusPerCorner[i] })),
    width: width,
  }
  return createElement(bufferedCurve, type, urn, properties, metadata)
}

function createTransportationElementFromGeoJsonLineString(
  geojson: Feature<LineString>,
  width: number,
  urn: Urn,
  properties?: Properties,
  metadata?: Record<string, any>,
): TransportationElement | undefined {
  const points: RadiusPointsUnprocessed[] = geojson.geometry.coordinates.map((p) => ({
    id: newId(),
    position: { x: p[0], y: p[1] },
  }))
  const type = properties?.category === "rails" ? "rail" : "road"
  return createTransportationElement(points, urn, 0, width, type, properties, metadata)
}

function _getRadiusPerCornerForUpdatedPoints(
  controlPoints: RadiusPointsUnprocessed[],
  previousControlPoints: RadiusPoint[],
  previousRadiusPerInternalCorner: number[],
) {
  let radiusPerCorner: number[] = []
  const changedIndex = controlPoints.findIndex(
    ({ position: p }, i) => p.x !== previousControlPoints[i].position.x || p.y !== previousControlPoints[i].position.y,
  )
  if (previousControlPoints.length === controlPoints.length) {
    const vec2s = controlPoints.map((p) => new Vector2(p.position.x, p.position.y))
    if (changedIndex !== -1)
      radiusPerCorner = getRadiusPerCornerWithPointUpdate(vec2s, previousRadiusPerInternalCorner, changedIndex)
    else radiusPerCorner = [0, ...previousRadiusPerInternalCorner, 0]
  } else if (controlPoints.length > previousControlPoints.length) {
    const vec2s = previousControlPoints.map((p) => new Vector2(p.position.x, p.position.y))
    const newPoint = new Vector2(controlPoints[changedIndex].position.x, controlPoints[changedIndex].position.y)
    radiusPerCorner = getRadiusPerCornerWithPointInsert(vec2s, previousRadiusPerInternalCorner, changedIndex, newPoint)
  } else {
    const vec2s = previousControlPoints.map((p) => new Vector2(p.position.x, p.position.y))
    radiusPerCorner = getRadiusPerCornerWithPointDelete(vec2s, previousRadiusPerInternalCorner, changedIndex)
  }
  return radiusPerCorner
}

function updateControlPoints(element: TransportationElement, controlPoints: RadiusPointsUnprocessed[]) {
  const definingRep = extractDefiningRep(element)
  const previousControlPoints = definingRep.bufferedCurve.points
  const previousRadiusPerInternalCorner = previousControlPoints.map((p) => p.radius).slice(1, -1)
  const radiusPerCorner = _getRadiusPerCornerForUpdatedPoints(
    controlPoints,
    previousControlPoints,
    previousRadiusPerInternalCorner,
  )

  const controlPointsWithUpdatedRadii: RadiusPoint[] = controlPoints.map(({ position, id }, i) => ({
    id,
    position,
    radius: radiusPerCorner[i],
  }))

  const bufferedCurve: BufferedCurve = {
    ...definingRep.bufferedCurve,
    points: controlPointsWithUpdatedRadii,
  }

  return updateElementFromDefiningRepresentation(element, { ...definingRep, bufferedCurve })
}

function updateRadiusOnPoint(element: TransportationElement, pointId: string, newRadius: number) {
  const definingRep = extractDefiningRep(element)
  const { bufferedCurve } = definingRep

  const points2D = bufferedCurve.points.map((p) => new Vector2(p.position.x, p.position.y))
  const pointIndex = bufferedCurve.points.findIndex((p) => p.id === pointId)

  const previousRadiusPerCorner = bufferedCurve.points.map((p) => p.radius)
  const radiusPerInternalCorner = insertUpdatedRadius(
    points2D,
    previousRadiusPerCorner.slice(1, -1),
    pointIndex,
    newRadius,
  )

  const updatedPoints: RadiusPoint[] = bufferedCurve.points.map((point, i) => ({
    ...point,
    radius: radiusPerInternalCorner[i - 1] ?? 0,
  }))

  const updatedDefiningRep: DefiningRepresentation = {
    ...definingRep,
    bufferedCurve: {
      ...bufferedCurve,
      points: updatedPoints,
    },
  }

  return updateElementFromDefiningRepresentation(element, updatedDefiningRep)
}

function updateGenericProperties(
  element: TransportationElement,
  updatedProperties: { [key: string]: any },
): TransportationElement {
  if (updatedProperties.__INTERNAL__) throw new Error("Cannot update internal properties directly")
  const updatedElement = {
    ...element,
    urn: replaceRevision(element.urn),
    properties: {
      ...element.properties,
      ...updatedProperties,
    },
  }
  return updatedElement
}

function updateElementFromDefiningRepresentation(
  element: TransportationElement,
  definingRepresentation: DefiningRepresentation,
) {
  const { bufferedCurve, type } = definingRepresentation
  const lineString = generateLineString(bufferedCurve)
  const { footprintFeatureCollection } = _generateFootPrintRepresentation(lineString)

  const terrainShape: JsonRepresentations["terrainShape"] = generateTerrainShape(
    bufferedCurve,
    bufferedCurve.width,
    type,
  )

  const updatedElement: TransportationElement = {
    ...element,
    urn: replaceRevision(element.urn),
    properties: {
      ...element.properties,
      __INTERNAL__: { ...element.properties.__INTERNAL__, ...definingRepresentation },
    },
    representations: {
      terrainShape: {
        type: "embedded-json",
        data: terrainShape,
      },
      footprint: {
        type: "embedded-json",
        data: footprintFeatureCollection,
      },
    },
  }
  return updatedElement
}

function generateCenterLine(element: TransportationElement) {
  const { bufferedCurve } = extractDefiningRep(element)
  const lineString = generateLineString(bufferedCurve)
  return lineString
}

function updateWidth(element: TransportationElement, width: number) {
  const definingRep = extractDefiningRep(element)
  const updatedbufferedCurve: BufferedCurve = { ...definingRep.bufferedCurve, width }
  return updateElementFromDefiningRepresentation(element, { ...definingRep, bufferedCurve: updatedbufferedCurve })
}

function getWidth(element: TransportationElement) {
  const { bufferedCurve } = extractDefiningRep(element)
  return bufferedCurve.width
}

function getPolygonsForAreaMetric(element: TransportationElement) {
  const definingRep = extractDefiningRep(element)
  return _generatePolygons(definingRep.bufferedCurve, definingRep.bufferedCurve.width)
}

function getTransportationType(element: TransportationElement) {
  return extractDefiningRep(element).type
}

export default {
  systemName: SYSTEM_NAME,
  isTransportationElement,
  createTransportationElement,
  createTransportationElementFromGeoJsonLineString,
  updateControlPoints,
  updateRadiusOnPoint,
  getCurveEndPointSeparationSegments,
  extractDefiningRep,
  updateGenericProperties,
  generatePolygons,
  createCurveLineString,
  getPolygonsForAreaMetric,
  getTransportationType,
  generateCenterLine,
  updateWidth,
  getWidth,
  transportTypeToElementCategory,
}
