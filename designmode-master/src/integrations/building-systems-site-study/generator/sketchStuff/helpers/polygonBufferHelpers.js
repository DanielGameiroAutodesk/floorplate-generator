import {
  addVectorToPoint,
  copyPolygon,
  distanceToCrash,
  getAnglesAtPolygonVertices,
  getAnglesBetweenVectors,
  getCCWPolygon,
  getVectorFromPointToPoint,
  movePointAlongVector,
  normalizeVector,
  pointPointDistance,
  polygonArea,
  polygonSelfIntersection,
  pullBackMidPoint,
  simplifyOpenPolygon,
} from "./geometry.js"
import { getDotProduct, mod, normalizedVectorFromPoints, pointsAreEqual } from "./numpy.js"
import { v4 as uuidv4 } from "uuid"
import { clipLoops, pointsOnLine, snapPointsMutable } from "./snapping.js"
import { polygonsToGraph } from "src/integrations/building-systems-site-study/generator/sketchStuff/graph/graphHelpers.js"
import { getNormalizedVectorFromPointToPoint } from "./helpers_2.js"

const PRECISION = 0.01
const MIN_DISTANCE_BETWEEN_POINTS = 0.1

function removeLastPointInPolygonIfEqualsFirst(polygon) {
  if (pointsAreEqual(polygon[0], polygon[polygon.length - 1], PRECISION)) {
    polygon.pop()
  }
  return polygon
}

function getPolygonEdgeVectors(polygon) {
  let edgeVectors = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    edgeVectors.push(getVectorFromPointToPoint(polygon[i], polygon[mod(i + 1, n)]))
  }
  return edgeVectors
}
function getNormalizedPolygonEdgeVectors(polygon) {
  let normalizedEdgeVectors = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    normalizedEdgeVectors.push(normalizedVectorFromPoints(polygon[i], polygon[mod(i + 1, n)]))
  }
  return normalizedEdgeVectors
}

function edgeVectorToOffsetNormal(edgeVector, offset) {
  const edgeVectorNormalized = normalizeVector(edgeVector)
  return [-edgeVectorNormalized[1] * offset, edgeVectorNormalized[0] * offset]
}

export function polygonToOffsetLinesWithConstantOffset(polygon, offset) {
  const edgeVectors = getPolygonEdgeVectors(polygon)
  const shiftVectors = edgeVectors.map((v) => edgeVectorToOffsetNormal(v, offset))
  const n = polygon.length
  const lines = []
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i]
    const p2 = polygon[mod(i + 1, n)]
    const v = shiftVectors[i]
    lines.push([addVectorToPoint(p1, v), addVectorToPoint(p2, v)])
  }
  return lines
}

export function offsetLinesToGraphIncludingPolygonPointsAtConvexPoints(
  offsetLines,
  inputPolygon,
  minimumBuffer,
  bufferOffset,
) {
  const anglesAtVertices = getAnglesAtPolygonVertices(inputPolygon)
  let polygon = []
  const n = offsetLines.length
  for (let i = 0; i < offsetLines.length; i++) {
    if (i === 0 || pointPointDistance(offsetLines[i][0], polygon[polygon.length - 1]) > MIN_DISTANCE_BETWEEN_POINTS) {
      polygon.push(...offsetLines[i])
    } else {
      polygon.push(offsetLines[i][1])
    }
    if (anglesAtVertices[mod(i + 1, n)] < -1 && bufferOffset > 0) {
      polygon.push(inputPolygon[mod(i + 1, n)])
    } else if (anglesAtVertices[mod(i + 1, n)] > 1 && bufferOffset < 0) {
      polygon.push(inputPolygon[mod(i + 1, n)])
    } else if (anglesAtVertices[mod(i + 1, n)] > 5 && minimumBuffer) {
      //add extra buffer in concave corners if minimumBufferOption enabled
      polygon.push(
        pullBackMidPoint(
          inputPolygon[mod(i + 2, n)],
          inputPolygon[mod(i + 1, n)],
          inputPolygon[mod(i, n)],
          Math.sqrt(2) * minimumBuffer,
        ),
      )
    }
  }

  if (pointPointDistance(polygon[0], polygon[polygon.length - 1]) < MIN_DISTANCE_BETWEEN_POINTS) {
    polygon = polygon.slice(0, polygon.length - 1)
  }
  return polygonsToGraph([polygon], 5)
}

export function preprocessPolygon(polygon) {
  const copiedPolygon = copyPolygon(polygon)
  return removeLastPointInPolygonIfEqualsFirst(getCCWPolygon(copiedPolygon))
}

export function preprocessPolygonWithSimplification(polygon) {
  const copiedPolygon = copyPolygon(polygon)
  const processedPolygon = removeLastPointInPolygonIfEqualsFirst(getCCWPolygon(copiedPolygon))
  if (polygon.length > 100) return simplifyOpenPolygon(processedPolygon, 3)
  return processedPolygon
}

export function polygonToOffsetLinesWithVaryingOffset(polygon, offsetList) {
  const edgeVectorsNormalized = getNormalizedPolygonEdgeVectors(polygon)
  const angles = getAnglesBetweenVectors(edgeVectorsNormalized, true)
  const n = polygon.length
  let offsetLinesToIntersect = []
  let offsetLines = []
  for (let i = 0; i < offsetList.length; i++) {
    if (offsetList[i] > 0) {
      const points = [polygon[i], polygon[mod(i + 1, n)]]
      const offsetVector = edgeVectorToOffsetNormal(edgeVectorsNormalized[i], offsetList[i])
      const offsetPoints = [addVectorToPoint(points[0], offsetVector), addVectorToPoint(points[1], offsetVector)]
      //TODO: extend offset lines based on angles
      if (angles[i] < -1) {
        //add point from original polygon at convex angles
        offsetLinesToIntersect.push(offsetLines.length)
        offsetLines.push(polygon[i])
      }
      if (
        i === 0 ||
        (i > 0 &&
          pointPointDistance(offsetPoints[0], offsetLines[offsetLines.length - 1]) > MIN_DISTANCE_BETWEEN_POINTS)
      ) {
        offsetLinesToIntersect.push(offsetLines.length, offsetLines.length + 1)
        offsetLines.push(...offsetPoints)
      } else {
        offsetLinesToIntersect.push(offsetLines.length)
        offsetLines.push(offsetPoints[1])
      }
    } else {
      offsetLines.push(polygon[i])
    }
  }

  if (pointPointDistance(offsetLines[0], offsetLines[offsetLines.length - 1]) < MIN_DISTANCE_BETWEEN_POINTS) {
    offsetLines = offsetLines.slice(0, offsetLines.length - 1)
    offsetLinesToIntersect = offsetLinesToIntersect.slice(0, offsetLinesToIntersect.length - 1)
  }
  return { offsetLines, offsetLinesToIntersect }
}

export function polygonToGraphAndSelectedEdgeIDs(polygon, edgeIndexes, edgeWidth) {
  const width = edgeWidth ? edgeWidth : 0
  const n = polygon.length
  const verticesIDs = polygon.map(() => uuidv4())
  const vertices = polygon.reduce((acc, curr, i) => {
    const newVertex = { id: verticesIDs[i], x: curr[0], y: curr[1] }
    acc[newVertex.id] = newVertex
    return acc
  }, {})

  const edgesValues = verticesIDs.map((e, i) => ({
    id: uuidv4(),
    start: verticesIDs[i],
    end: verticesIDs[mod(i + 1, n)],
    width,
  }))
  const edgeIDs = edgeIndexes.map((i) => edgesValues[i].id)
  const edges = edgesValues.reduce((acc, curr) => {
    acc[curr.id] = curr
    return acc
  }, {})
  return { offsetGraph: { vertices, edges }, edgeIDsToIntersect: edgeIDs }
}

export function isValidBufferedPolygons(polygons) {
  let validPolygons = true
  polygons.forEach((p) => {
    if (polygonSelfIntersection(p)) validPolygons = false
  })
  return validPolygons
}

export function graphToPointsConnectivity(graph) {
  const vertices = Object.values(graph.vertices)
  const edges = Object.values(graph.edges)
  const nv = Object.keys(vertices).length
  const ne = Object.keys(edges).length

  const points = []
  const pointIds = {}
  const connec = []
  for (let i = 0; i < nv; i++) {
    points.push([vertices[i].x, vertices[i].y])
    pointIds[vertices[i].id] = i
  }
  for (let i = 0; i < ne; i++) {
    const i1 = pointIds[edges[i].start]
    const i2 = pointIds[edges[i].end]
    connec.push([i1, i2])
  }
  return { points: points, connectivity: connec }
}

function snapPointsAndClipAwayLoops(polygon, snapDist) {
  const points = polygon.map((point) => point)
  snapPointsMutable(points, snapDist)

  const polygonWithInserts = polygon
    .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))
    .flatMap((p, i, l) => [p, ...pointsOnLine(p, l[(i + 1) % l.length], points, snapDist)])
    .filter((p, i, l) => JSON.stringify(p) !== JSON.stringify(l[(i + 1) % l.length]))

  return (
    clipLoops(polygonWithInserts)
      .map(getCCWPolygon)
      .sort((a, b) => polygonArea(b) - polygonArea(a))[0] || []
  )
}

export function cleanBufferedPolygon(polygon, threshold) {
  if (polygon.length <= 4) {
    return polygon
  }

  let cleanedPolygon = []
  const _polygon = snapPointsAndClipAwayLoops(polygon, 0.01)
  const n = _polygon.length

  try {
    for (let i = 0; i < n; i++) {
      const p0 = i === 0 ? _polygon[_polygon.length - 1] : cleanedPolygon[cleanedPolygon.length - 1]
      const p1 = _polygon[i]
      const p2 = i < n - 1 ? _polygon[i + 1] : cleanedPolygon[i - n + 1]
      const p3 = i < n - 2 ? _polygon[i + 2] : cleanedPolygon[i - n + 2]

      const shootVec1 = getNormalizedVectorFromPointToPoint(p0, p1)
      const hitEdge1 = [p2, p3]
      const distance1 = distanceToCrash(shootVec1, p1, hitEdge1)

      const shootVec2 = getVectorFromPointToPoint(p3, p2)
      const hitEdge2 = [p0, p1]
      const distance2 = distanceToCrash(shootVec2, p2, hitEdge2)

      const normShootVec2 = [shootVec2[1], -shootVec2[0]]
      const validOrientation = getDotProduct(normShootVec2, shootVec1) < 0

      if (!validOrientation || (distance1 > threshold && distance2 > threshold)) {
        cleanedPolygon.push(p1)
      } else if (distance1 < threshold) {
        const newPoint = movePointAlongVector(p1, shootVec1, distance1)
        cleanedPolygon.push(newPoint)
        if (i === n - 1) cleanedPolygon = cleanedPolygon.slice(1)
        i++
      } else if (distance2 < threshold) {
        const newPoint = movePointAlongVector(p2, shootVec2, distance2)
        cleanedPolygon.push(newPoint)
        if (i === n - 1) cleanedPolygon = cleanedPolygon.slice(1)
        i++
      }
    }
  } catch {
    return polygon
  }

  return cleanedPolygon
}
