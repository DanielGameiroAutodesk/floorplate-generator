import {
  addBuildingToGraph,
  addVectorToPoint,
  deepCopy,
  getAnglesInPolygon,
  getEdgeLengthsInPolygon,
  getExtensionDistance,
} from "./templateHelpers.js"
import { getDotProduct, mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import {
  extendShortEdgesInPolygon,
  getAngle,
  getPolygonBetweenIndexes,
  getRayPolygonIntersection,
  removeFakePoints,
  removeSharpAnglesInPolygon,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/buildingTechniques/simplification.js"
import { getIntersectionAreas } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/intersectionArea.js"
import {
  getBoundingBoxCoveringAllRotationAnglesForPolygon,
  pointPointDistance,
  pointToLineSegmentDistance,
  polygonArea,
  rotatePoints,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { boundingBoxToBuildings } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/helpers.js"
import { splitBuildingsToFixedLengthLamellas } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/instantLamellaHelpers.js"

//
// Helpers
//

function range(startIndex, endIndex) {
  return Array(endIndex - startIndex)
    .fill(0)
    .map((_, index) => startIndex + index)
}

function getUnitVectorsInPolygon(polygon) {
  const n = polygon.length
  return polygon.map((p0, i) => {
    return getNormalizedVectorFromPointToPoint(p0, polygon[(i + 1) % n])
  })
}

function getNormalVectorsInPolygon(polygon) {
  const unitVectors = getUnitVectorsInPolygon(polygon)
  return unitVectors.map(([ux, uy]) => [-uy, ux])
}

function _getPolygonSplit(polygon, angleIndex, crossIndex, crossPoint, rightRay) {
  const n = polygon.length
  const splitOne = [...getPolygonBetweenIndexes(polygon, mod(angleIndex + rightRay, n), crossIndex), crossPoint]
  const splitTwo = [
    ...getPolygonBetweenIndexes(polygon, mod(crossIndex + 1, n), mod(angleIndex - !rightRay, n)),
    crossPoint,
  ]
  return [splitOne, splitTwo]
}

function removeProtrusionsWithSmallArea(raw_polygon, minArea, maxIterations) {
  const eps = 1e-8
  let polygon = deepCopy(raw_polygon)
  for (let i = 0; i < maxIterations; i++) {
    const n = polygon.length
    if (n <= 3) return polygon
    for (let angleIndex = 0; angleIndex < n; angleIndex++) {
      const p0 = polygon[mod(angleIndex - 1, n)]
      const p1 = polygon[angleIndex]
      const p2 = polygon[(angleIndex + 1) % n]
      const angle = getAngle(p0, p1, p2)
      if (angle >= -eps && angleIndex === n - 1) return polygon
      if (angle >= -eps) continue

      const unitVecLeft = getNormalizedVectorFromPointToPoint(p0, p1)
      const unitVecRight = getNormalizedVectorFromPointToPoint(p2, p1)

      const [crossPointLeft, crossIndexLeft] = getRayPolygonIntersection(p1, unitVecLeft, polygon)
      const [crossPointRight, crossIndexRight] = getRayPolygonIntersection(p1, unitVecRight, polygon)

      const [splitOne, splitTwo] = _getPolygonSplit(polygon, angleIndex, crossIndexRight, crossPointRight, true)
      const [splitThree, splitFour] = _getPolygonSplit(polygon, angleIndex, crossIndexLeft, crossPointLeft, false)

      const splitPolygons = [splitOne, splitTwo, splitThree, splitFour]
      const splitAreas = splitPolygons.map((split) => polygonArea(split))

      if (Math.min(...splitAreas) > minArea && angleIndex === n - 1) return polygon
      if (Math.min(...splitAreas) > minArea) continue

      const indexOfMaxSplit = splitAreas.reduce((maxIndex, area, i) => (area > splitAreas[maxIndex] ? i : maxIndex), 0)
      polygon = splitPolygons[indexOfMaxSplit]
      break
    }
  }
  return polygon
}

function getMinBoundingRectangleAngle(polygon, number_of_angles) {
  let minRectArea = Infinity
  let minBoundingRectangleAngle = 0
  for (let i = 0; i < number_of_angles; i++) {
    const angle = (0.5 * Math.PI * i) / number_of_angles
    const sVec = [Math.cos(angle), Math.sin(angle)]
    const tVec = [-Math.sin(angle), Math.cos(angle)]

    const sValues = polygon.map((p) => getDotProduct(p, sVec))
    const tValues = polygon.map((p) => getDotProduct(p, tVec))
    const sMin = sValues.reduce((a, b) => (a < b ? a : b))
    const sMax = sValues.reduce((a, b) => (a > b ? a : b))
    const tMin = tValues.reduce((a, b) => (a < b ? a : b))
    const tMax = tValues.reduce((a, b) => (a > b ? a : b))
    const area = (sMax - sMin) * (tMax - tMin)
    if (area < minRectArea) {
      minRectArea = area
      minBoundingRectangleAngle = angle
    }
  }
  return Math.PI / 2 - minBoundingRectangleAngle
}

function getLengthOfLine(line) {
  const n = line.length
  let lengthOfLine = 0
  for (let i = 0; i < n - 1; i++) {
    const p0 = line[i]
    const p1 = line[i + 1]
    lengthOfLine += pointPointDistance(p0, p1)
  }
  return lengthOfLine
}

function rotatePolygon(polygon, angle) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
  return polygon.map(([x, y]) => {
    const s = x * cos - y * sin
    const t = x * sin + y * cos
    return [s, t]
  })
}

function getYatXAlongLine(x, p0, p1) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  return ((x - x0) / (x1 - x0)) * y1 + ((x1 - x) / (x1 - x0)) * y0
}

function getOpenIntervals(polygon, startX, endX) {
  const n = polygon.length
  const allLines = polygon.map((point, i) => [point, polygon[(i + 1) % n]])

  const lowerLines = allLines.filter(([[x0], [x1]]) => x0 < x1 && x1 > startX && x0 < endX)
  const upperLines = allLines.filter(([[x0], [x1]]) => x0 > x1 && x0 > startX && x1 < endX)
  const lines = [...lowerLines, ...upperLines]

  const coverLines = lines.map(([p0, p1]) => {
    const [x0] = p0
    const [x1] = p1
    const xMin = Math.max(Math.min(x0, x1), startX)
    const xMax = Math.min(Math.max(x0, x1), endX)
    const minY = Math.min(getYatXAlongLine(xMin, p0, p1), getYatXAlongLine(xMax, p0, p1))
    const maxY = Math.max(getYatXAlongLine(xMin, p0, p1), getYatXAlongLine(xMax, p0, p1))
    return { y: minY, maxY }
  })
  allLines.forEach(([p0, p1]) => {
    const [x0] = p0
    const [x1] = p1
    if (Math.max(x0, x1) > startX && Math.min(x0, x1) <= startX) {
      const y = getYatXAlongLine(startX, p0, p1)
      coverLines.push({ y })
    }
  })
  coverLines.sort((a, b) => a.y - b.y)
  const intervals = []
  let counter = 0
  let startY = -Infinity
  for (let i = 0; i < coverLines.length; i++) {
    const line = coverLines[i]
    if (line.maxY) {
      if (counter % 2 === 1 && startY < line.y) {
        intervals.push([startY, line.y])
      }
      startY = Math.max(startY, line.maxY)
      continue
    }
    if (counter % 2 === 0) {
      startY = Math.max(startY, line.y)
    } else if (line.y > startY) {
      intervals.push([startY, line.y])
    }
    counter += 1
  }

  return intervals
}

//
// Shifted Tower Buildings
//

function numberOfDoublesOnInterval(interval, width, gapSize) {
  const [start, end] = interval
  return Math.floor((end - start + gapSize) / (2 * width + gapSize))
}

function numberOfBuildingsOnInterval(interval, width, gapSize) {
  const [start, end] = interval
  const numberOfDoubles = numberOfDoublesOnInterval(interval, width, gapSize)
  const includeSingle = end - start - numberOfDoubles * (2 * width + gapSize) > width
  return 2 * numberOfDoubles + includeSingle
}

function findStartingPointAlongX(polygon, widthX, widthY, gapSizeX, gapSizeY) {
  const minX = polygon.reduce((minX, [x]) => (x < minX ? x : minX), Infinity)

  let maxNumberOfBuildings = 0
  let bestStartXs = [minX]
  let x = minX
  while (x < minX + widthX + gapSizeX) {
    const numberOfBuildings = getNumberOfBuildings(polygon, widthX, widthY, gapSizeX, gapSizeY, x)
    if (numberOfBuildings > maxNumberOfBuildings) {
      maxNumberOfBuildings = numberOfBuildings
      bestStartXs = [x]
    } else if (numberOfBuildings === maxNumberOfBuildings) {
      bestStartXs.push(x)
    }
    x += 1
  }
  return bestStartXs[0]
}

function getNumberOfBuildings(polygon, widthX, widthY, gapSizeX, gapSizeY, startX) {
  const maxX = polygon.reduce((maxX, [x]) => (x > maxX ? x : maxX), 0)
  let x = startX
  let count = 0
  while (x < maxX - widthX) {
    const openIntervals = getOpenIntervals(polygon, x, x + widthX)
    count += openIntervals.reduce(
      (count, interval) => count + numberOfBuildingsOnInterval(interval, widthY, gapSizeY),
      0,
    )
    x += widthX + gapSizeX
  }
  return count
}

function findAngleOfBuildings(polygon, widthX, widthY, gapSizeX, gapSizeY) {
  let bestAngles = [0]
  let maxNumberOfBuildings = 0
  const m = 50
  for (let i = 0; i < m; i++) {
    const angle = (i / m) * Math.PI
    const angledPolygon = rotatePolygon(polygon, angle)
    const startX = findStartingPointAlongX(angledPolygon, widthX, widthY, gapSizeX, gapSizeY)
    const numberOfBuildings = getNumberOfBuildings(angledPolygon, widthX, widthY, gapSizeX, gapSizeY, startX)
    if (numberOfBuildings === maxNumberOfBuildings) bestAngles.push(angle)
    if (numberOfBuildings > maxNumberOfBuildings) {
      maxNumberOfBuildings = numberOfBuildings
      bestAngles = [angle]
    }
  }
  return bestAngles[0]
}

export function getShiftedBuildings(
  raw_polygon,
  buildingWidth,
  buildingLength,
  shortSideBuffer,
  longSideBuffer,
  shiftFactor,
  stories,
) {
  let graph = { vertices: {}, edges: {} }
  let polygon = deepCopy(raw_polygon)
  if (polygon.length === 0) return graph

  const widthX = buildingWidth
  const widthY = buildingLength
  const xShift = shiftFactor * buildingWidth
  const gapSizeX = longSideBuffer
  const gapSizeY = shortSideBuffer

  const angle = findAngleOfBuildings(polygon, widthX + xShift, widthY, gapSizeX, gapSizeY)
  polygon = rotatePolygon(polygon, angle)
  const maxX = polygon.reduce((maxX, [x]) => (x > maxX ? x : maxX), 0)

  let xStart = findStartingPointAlongX(polygon, widthX + xShift, widthY, gapSizeX, gapSizeY)

  while (xStart + widthX < maxX) {
    const intervalsY = getOpenIntervals(polygon, xStart, xStart + widthX + xShift)

    intervalsY.forEach(([minY, maxY]) => {
      const numberDoubles = Math.floor((maxY - minY + gapSizeY) / (2 * widthY + gapSizeY))
      const includeSingle = maxY - minY - numberDoubles * (2 * widthY + gapSizeY) > widthY
      const restLength =
        maxY - minY + gapSizeY - numberDoubles * (2 * widthY + gapSizeY) - includeSingle * (widthY + gapSizeY)
      const resLengthDivided = restLength / (numberDoubles + includeSingle + 1)
      let yStart = minY + resLengthDivided
      const gapSizeYPlus = gapSizeY + resLengthDivided
      for (let k = 0; k < numberDoubles; k++) {
        let building = [
          [xStart + 0.5 * (widthX + xShift), yStart],
          [xStart + 0.5 * (widthX + xShift), yStart + 2 * widthY],
        ]
        building = rotatePolygon(building, -angle)
        graph = addBuildingToGraph(graph, building, {
          stories,
          width: widthX,
          minSubBuildingLength: widthY - 0.5,
          shiftFactor,
        })
        yStart += 2 * widthY + gapSizeYPlus
      }
      if (includeSingle) {
        let building = [
          [xStart + 0.5 * widthX, yStart],
          [xStart + 0.5 * widthX, yStart + widthY],
        ]
        building = rotatePolygon(building, -angle)
        graph = addBuildingToGraph(graph, building, { stories, width: widthX })
      }
    })
    xStart += widthX + gapSizeX
  }

  return graph
}

export function getShortLamellas(
  raw_polygon,
  buildingWidth,
  minBuildingLength,
  maxBuildingLength,
  shortSideBuffer,
  longSideBuffer,
  stories,
) {
  let graph = { vertices: {}, edges: {} }
  let polygon = deepCopy(raw_polygon)
  if (polygon.length === 0) return graph

  const widthX = buildingWidth
  const widthY = minBuildingLength
  const xShift = 0
  const gapSizeX = longSideBuffer
  const gapSizeY = shortSideBuffer

  const angle = findAngleOfBuildings(polygon, widthX, widthY, gapSizeX, gapSizeY)
  polygon = rotatePolygon(polygon, angle)
  const maxX = polygon.reduce((maxX, [x]) => (x > maxX ? x : maxX), 0)

  let xStart = findStartingPointAlongX(polygon, widthX + xShift, widthY, gapSizeX, gapSizeY)

  while (xStart + widthX < maxX) {
    const intervalsY = getOpenIntervals(polygon, xStart, xStart + widthX + xShift)

    intervalsY.forEach(([minY, maxY]) => {
      const numberDoubles = Math.floor((maxY - minY + gapSizeY) / (2 * widthY + gapSizeY))
      const includeSingle = maxY - minY - numberDoubles * (2 * widthY + gapSizeY) > widthY
      const restLength =
        maxY - minY + gapSizeY - numberDoubles * (2 * widthY + gapSizeY) - includeSingle * (widthY + gapSizeY)
      const resLengthDivided = restLength / (numberDoubles + includeSingle + 1)
      let yStart = minY + resLengthDivided
      const gapSizeYPlus = gapSizeY + resLengthDivided
      for (let k = 0; k < numberDoubles; k++) {
        let building = [
          [xStart + 0.5 * widthX, yStart],
          [xStart + 0.5 * widthX, yStart + 2 * widthY],
        ]
        building = rotatePolygon(building, -angle)
        graph = addBuildingToGraph(graph, building, { stories, width: widthX })
        yStart += 2 * widthY + gapSizeYPlus
      }
      if (includeSingle) {
        let building = [
          [xStart + 0.5 * widthX, yStart],
          [xStart + 0.5 * widthX, yStart + widthY],
        ]
        building = rotatePolygon(building, -angle)
        graph = addBuildingToGraph(graph, building, { stories, width: widthX })
      }
    })
    xStart += widthX + gapSizeX
  }

  return graph
}
//
// Along the edge
//

function polyLineToBuildingLine(line, dist) {
  const n = line.length
  const normalVectors = getNormalVectorsInPolygon(line).slice(0, n - 1)

  const buildingLine = []
  buildingLine.push(addVectorToPoint(line[0], normalVectors[0], dist))
  for (let i = 1; i < n - 1; i++) {
    let point = line[i]
    const nl = normalVectors[i - 1]
    const nr = normalVectors[i]
    const dotProd = getDotProduct(nl, nr)
    const c = dist / (1 + dotProd)
    point = addVectorToPoint(point, nl, c)
    point = addVectorToPoint(point, nr, c)
    buildingLine.push(point)
  }

  buildingLine.push(addVectorToPoint(line[n - 1], normalVectors[n - 2], dist))

  return buildingLine
}

function buildingBetweenIndexes(
  polygon,
  startIndex,
  endIndex,
  extensionDistancesStart,
  extensionDistancesEnd,
  unitVectors,
  buildingWidth,
) {
  const n = polygon.length
  let pStart = polygon[mod(startIndex, n)]
  pStart = addVectorToPoint(pStart, unitVectors[mod(startIndex, n)], -extensionDistancesStart)
  const line = [pStart]
  for (let i = startIndex + 1; i < endIndex; i++) {
    const p = polygon[mod(i, n)]
    line.push(p)
  }
  let pEnd = polygon[mod(endIndex, n)]
  pEnd = addVectorToPoint(pEnd, unitVectors[mod(endIndex - 1, n)], extensionDistancesEnd)
  line.push(pEnd)
  return polyLineToBuildingLine(line, 0.5 * buildingWidth)
}

function simplifySkeleton(polygon, buildingWidth) {
  polygon = extendShortEdgesInPolygon(polygon, buildingWidth, buildingWidth, buildingWidth).polygon
  polygon = removeSharpAnglesInPolygon(polygon, Math.PI / 6, buildingWidth).polygon
  polygon = removeProtrusionsWithSmallArea(polygon, 10, 100)
  polygon = removeFakePoints(polygon, 1e-2)
  return polygon
}

function cuttingEdges(polygon, width) {
  const n = polygon.length
  const angles = getAnglesInPolygon(polygon)
  const lengths = getEdgeLengthsInPolygon(polygon)
  const leftCuts = []
  const rightCuts = []
  for (let i = 0; i < n; i++) {
    const length = lengths[i]
    if (length > 2 * width) continue
    const leftAngle = angles[mod(i, n)]
    const rightAngle = angles[mod(i + 1, n)]
    if (leftAngle > 0.1 * Math.PI && rightAngle < -0.1 * Math.PI) {
      rightCuts.push(i)
    }
    if (rightAngle > 0.1 * Math.PI && leftAngle < -0.1 * Math.PI) {
      leftCuts.push(mod(i, n))
    }
  }
  return { leftCuts, rightCuts }
}

function getMinBuildingLengthFromCorner(angle, buildingWidth) {
  angle = Math.abs(angle)
  if (angle < Math.PI / 10) {
    return 0
  } else if (angle < Math.PI / 2) {
    return (buildingWidth * (1 - Math.cos(angle))) / Math.sin(angle)
  } else {
    return (buildingWidth * (1 - Math.cos(angle))) / Math.sin(angle)
  }
}

function getBackUpDist(polygon, buildingWidth, gapSize, startIndex) {
  const n = polygon.length
  const lengths = getEdgeLengthsInPolygon(polygon)
  const unitVectors = getUnitVectorsInPolygon(polygon)
  const normalVectors = getNormalVectorsInPolygon(polygon)
  const angles = getAnglesInPolygon(polygon)
  const p0 = polygon[mod(startIndex, n)]
  const p1 = addVectorToPoint(p0, normalVectors[mod(startIndex, n)], buildingWidth)
  const p4 = addVectorToPoint(polygon[mod(startIndex + 1, n)], normalVectors[mod(startIndex, n)], buildingWidth)
  const delta = 0.1
  for (let i = 1; i <= 2; i++) {
    const edgeLength = lengths[mod(startIndex - i, n)]
    const angle = angles[mod(startIndex - i, n)]
    const minLength = getMinBuildingLengthFromCorner(angle, buildingWidth)
    const unitVector = unitVectors[mod(startIndex - i, n)]
    const normalVector = normalVectors[mod(startIndex - i, n)]
    const pEndEdge = polygon[mod(startIndex - i + 1, n)]
    let dist = 0
    while (dist < edgeLength - minLength) {
      const p2 = addVectorToPoint(pEndEdge, unitVector, -dist)
      const p3 = addVectorToPoint(p2, normalVector, buildingWidth)
      const dist0 = pointToLineSegmentDistance(p0, p2, p3)
      const dist1 = pointToLineSegmentDistance(p1, p2, p3)
      const dist2 = pointToLineSegmentDistance(p2, p0, p1)
      const dist3 = pointToLineSegmentDistance(p3, p0, p1)
      const dist4 = pointToLineSegmentDistance(p2, p1, p4)
      const dist5 = pointToLineSegmentDistance(p3, p1, p4)
      const minDist = Math.min(...[dist0, dist1, dist2, dist3, dist4, dist5].map((dist) => Math.abs(dist)))
      if (minDist > gapSize) {
        return { dist, index: startIndex - (i - 1) }
      }
      dist += delta
    }
  }
  return { dist: 0, index: startIndex - 2 }
}

function getPushForwardDist(polygon, buildingWidth, gapSize, startIndex) {
  const n = polygon.length
  const lengths = getEdgeLengthsInPolygon(polygon)
  const unitVectors = getUnitVectorsInPolygon(polygon)
  const normalVectors = getNormalVectorsInPolygon(polygon)
  const angles = getAnglesInPolygon(polygon)
  const p0 = polygon[mod(startIndex, n)]
  const p1 = addVectorToPoint(p0, normalVectors[mod(startIndex - 1, n)], buildingWidth)
  const p4 = addVectorToPoint(polygon[mod(startIndex - 1, n)], normalVectors[mod(startIndex - 1, n)], buildingWidth)
  const delta = 0.1
  for (let i = 0; i <= 1; i++) {
    const edgeLength = lengths[mod(startIndex + i, n)]
    const angle = angles[mod(startIndex + i, n)]
    const minLength = getMinBuildingLengthFromCorner(angle, buildingWidth)
    const unitVector = unitVectors[mod(startIndex + i, n)]
    const normalVector = normalVectors[mod(startIndex + i, n)]
    const pStartEdge = polygon[mod(startIndex + i, n)]
    let dist = 0
    while (dist < edgeLength - minLength) {
      const p2 = addVectorToPoint(pStartEdge, unitVector, dist)
      const p3 = addVectorToPoint(p2, normalVector, buildingWidth)
      const dist0 = pointToLineSegmentDistance(p0, p2, p3)
      const dist1 = pointToLineSegmentDistance(p1, p2, p3)
      const dist2 = pointToLineSegmentDistance(p2, p0, p1)
      const dist3 = pointToLineSegmentDistance(p3, p0, p1)
      const dist4 = pointToLineSegmentDistance(p2, p1, p4)
      const dist5 = pointToLineSegmentDistance(p3, p1, p4)
      const minDist = Math.min(...[dist0, dist1, dist2, dist3, dist4, dist5].map((dist) => Math.abs(dist)))
      if (minDist > gapSize) {
        return { dist, index: startIndex + i }
      }
      dist += delta
    }
  }

  return { dist: 0, index: startIndex + 2 }
}

export function getEdgeBufferSmallSite(minGap, angle, buildingWidth, shift = 0) {
  let edgeBuffer
  if (angle >= Math.PI / 2) {
    edgeBuffer = (minGap + buildingWidth * (1 - Math.cos(angle))) / Math.sin(angle)
  } else if (angle >= 0) {
    edgeBuffer = minGap + buildingWidth * Math.sin(angle) + shift * Math.cos(angle)
  } else if (angle >= -Math.PI / 2) {
    edgeBuffer = minGap + shift * Math.cos(-angle)
  } else {
    edgeBuffer = minGap
  }
  return edgeBuffer
}

function isEdgeBlocked(polygon, blockingIndexes, edgeIndex, shortSideBuffer, longSideBuffer, buildingWidth) {
  const EPS = 0.1
  const n = polygon.length
  const angles = getAnglesInPolygon(polygon)
  const unitVectors = getUnitVectorsInPolygon(polygon)
  const normalVectors = getNormalVectorsInPolygon(polygon)
  const extensionDistances = angles.map((angle) => getExtensionDistance(0, angle, buildingWidth))

  const buildingPolygons = []
  const bufferZonePolygons = []
  blockingIndexes.forEach((blockingIndex) => {
    const normalVector = normalVectors[mod(blockingIndex, n)]
    const unitVector = unitVectors[mod(blockingIndex, n)]
    const p0 = polygon[mod(blockingIndex, n)]
    const p1 = polygon[mod(blockingIndex + 1, n)]
    const b0 = addVectorToPoint(p0, unitVector, -extensionDistances[mod(blockingIndex, n)])
    const b1 = addVectorToPoint(p1, unitVector, extensionDistances[mod(blockingIndex + 1, n)])
    const b2 = addVectorToPoint(b1, normalVector, buildingWidth)
    const b3 = addVectorToPoint(b0, normalVector, buildingWidth)
    buildingPolygons.push([b0, b1, b2, b3])
    const bz2 = addVectorToPoint(b2, normalVector, longSideBuffer)
    const bz3 = addVectorToPoint(b3, normalVector, longSideBuffer)
    bufferZonePolygons.push([b0, b1, bz2, bz3])
  })

  const normalVector = normalVectors[mod(edgeIndex, n)]
  const unitVector = unitVectors[mod(edgeIndex, n)]
  const p0 = polygon[mod(edgeIndex, n)]
  const p1 = polygon[mod(edgeIndex + 1, n)]

  const startX = -extensionDistances[mod(edgeIndex, n)]
  const endX = pointPointDistance(p0, p1) + extensionDistances[mod(edgeIndex + 1, n)]
  let x = startX
  const deltaX = 1
  const minGapX = getEdgeBufferSmallSite(
    shortSideBuffer,
    angles[mod(edgeIndex, n)],
    buildingWidth,
    extensionDistances[mod(edgeIndex, n)],
  )
  while (x < endX) {
    const b0 = addVectorToPoint(p0, unitVector, x)
    const b1 = addVectorToPoint(p1, unitVector, extensionDistances[mod(edgeIndex + 1, n)])
    const b2 = addVectorToPoint(b1, normalVector, buildingWidth)
    const b3 = addVectorToPoint(b0, normalVector, buildingWidth)
    const building = [b0, b1, b2, b3]
    const bz2 = addVectorToPoint(b2, normalVector, longSideBuffer)
    const bz3 = addVectorToPoint(b3, normalVector, longSideBuffer)

    const bufferZone = [b0, b1, bz2, bz3]
    const buildingArea = polygonArea(building)
    const outsideSiteArea = buildingArea - getIntersectionAreas([building, polygon])[0]
    if (outsideSiteArea > EPS) {
      x += deltaX
      continue
    }

    const bufferZoneOverlap = getIntersectionAreas([bufferZone, ...buildingPolygons])[0]
    const buildingOverlap = getIntersectionAreas([building, ...bufferZonePolygons])[0]

    if (bufferZoneOverlap === 0 && buildingOverlap === 0) {
      if (x === startX) return { split: false, blocked: false }
      if (minGapX >= endX) return { split: true, blocked: true }
      return { split: true, blocked: false, x: Math.max(x, minGapX) }
    }
    x += deltaX
  }
  return { split: true, blocked: true }
}

export function getBuildingsAlongTheEdges(raw_polygon, buildingWidth, shortSideBuffer, longSideBuffer, stories) {
  let graph = { vertices: {}, edges: {} }
  let polygon = deepCopy(raw_polygon)
  const angle = getMinBoundingRectangleAngle(polygon, 100) + Math.PI / 2
  polygon = rotatePolygon(polygon, angle)
  if (polygon.length === 0) return graph
  polygon = simplifySkeleton(polygon, buildingWidth)
  if (polygon.length === 0) return graph

  const minX = polygon.reduce((min, p) => (p[0] < min ? p[0] : min), Infinity)
  const maxX = polygon.reduce((max, p) => (p[0] > max ? p[0] : max), -Infinity)
  const minY = polygon.reduce((min, p) => (p[1] < min ? p[1] : min), Infinity)
  const maxY = polygon.reduce((max, p) => (p[1] > max ? p[1] : max), -Infinity)

  let leftIndex
  let rightIndex
  if (maxX - minX > maxY - minY) {
    leftIndex = polygon.findIndex((p) => p[0] === minX)
    rightIndex = polygon.findIndex((p) => p[0] === maxX)
  } else {
    leftIndex = polygon.findIndex((p) => p[1] === minY)
    rightIndex = polygon.findIndex((p) => p[1] === maxY)
  }

  const angles = getAnglesInPolygon(polygon)
  const unitVectors = getUnitVectorsInPolygon(polygon)
  const extensionDistances = angles.map((angle) => getExtensionDistance(0, angle, buildingWidth))
  const n = polygon.length
  let building
  let firstIndex
  let lastIndex
  if (Math.random() > 0.5) {
    firstIndex = rightIndex
    lastIndex = leftIndex
  } else {
    firstIndex = leftIndex
    lastIndex = rightIndex
  }

  const { leftCuts, rightCuts } = cuttingEdges(polygon, buildingWidth)
  if (lastIndex < firstIndex) lastIndex += n
  let lower = firstIndex
  let lowerDist = extensionDistances[mod(lower, n)]
  let upper
  let i = firstIndex
  const edgeIndexes = range(firstIndex, lastIndex + 1)
  while (i <= lastIndex) {
    // console.log("i", i);
    // const startShift = extensionDistances[mod(firstIndex, n)];
    // const endShift = extensionDistances[mod(lastIndex, n)];
    // building = buildingBetweenIndexes(polygon, firstIndex, lastIndex+5, startShift, endShift, unitVectors, buildingWidth);
    // console.log("building", deepCopy(building));
    //
    // building = rotatePolygon(building, -angle);
    // graph = addBuildingToGraph(graph, building, { stories, width: 0.01 * buildingWidth });
    // break;

    building = []

    const blockedIndexes = edgeIndexes.filter((edgeIndex) => edgeIndex < i - 1)
    const { split, blocked, x } = isEdgeBlocked(
      polygon,
      blockedIndexes,
      i,
      shortSideBuffer,
      longSideBuffer,
      buildingWidth,
    )
    if (rightCuts.includes(mod(i, n))) {
      upper = i - 1
      const { dist, index: upperIndex } = getBackUpDist(polygon, buildingWidth, longSideBuffer, i)
      if (i > lower && upperIndex > lower) {
        building = buildingBetweenIndexes(polygon, lower, upperIndex, lowerDist, -dist, unitVectors, buildingWidth)
      }
      lower = i
      lowerDist = extensionDistances[mod(lower, n)]
    } else if (split) {
      upper = i
      const endShift = extensionDistances[mod(upper, n)]
      if (upper > lower)
        building = buildingBetweenIndexes(polygon, lower, upper, lowerDist, endShift, unitVectors, buildingWidth)
      if (i >= lower) {
        if (blocked) {
          lower = i + 1
          lowerDist = extensionDistances[mod(lower, n)]
        } else {
          lower = i
          // eslint-disable-next-line @typescript-eslint/no-unsafe-unary-minus
          lowerDist = Math.min(-x, lowerDist)
        }
      }
    } else if (i === lastIndex) {
      upper = i
      const endShift = extensionDistances[mod(upper, n)]
      building = buildingBetweenIndexes(polygon, lower, upper, lowerDist, endShift, unitVectors, buildingWidth)
    } else if (leftCuts.includes(mod(i, n))) {
      upper = i + 1
      const endShift = extensionDistances[mod(upper, n)]
      building = buildingBetweenIndexes(polygon, lower, upper, lowerDist, endShift, unitVectors, buildingWidth)
      const pushForwardDist = getPushForwardDist(polygon, buildingWidth, longSideBuffer, i + 1)
      lower = pushForwardDist.index
      lowerDist = -pushForwardDist.dist
    } else {
      i += 1
      continue
    }
    if (getLengthOfLine(building) < buildingWidth * 2) building = []
    building = rotatePolygon(building, -angle)
    graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })
    if (lower >= lastIndex) break
    i += 1
  }

  return graph
}

//
// Randomized Buildings
//

function drawRandomBuildingInBox(minX, maxX, minY, maxY, width, minLength, maxLength, longSideBuffer, shortSideBuffer) {
  const length = minLength + Math.random() * (maxLength - minLength)
  const x = minX + Math.random() * (maxX - minX)
  const y = minY + Math.random() * (maxY - minY)
  const b0 = [x, y]
  const angle = Math.random() * Math.PI
  const vec = [Math.cos(angle), Math.sin(angle)]
  const normal = [-vec[1], vec[0]]
  const b1 = addVectorToPoint(b0, vec, length)

  const building = [b0, b1]

  const p0 = addVectorToPoint(b0, normal, -0.5 * width)
  const p1 = addVectorToPoint(b1, normal, -0.5 * width)
  const p2 = addVectorToPoint(b1, normal, 0.5 * width)
  const p3 = addVectorToPoint(b0, normal, 0.5 * width)
  const buildingPolygon = [p0, p1, p2, p3]

  const bp0 = addVectorToPoint(addVectorToPoint(b0, normal, -0.5 * width - longSideBuffer), vec, -shortSideBuffer)
  const bp1 = addVectorToPoint(addVectorToPoint(b1, normal, -0.5 * width - longSideBuffer), vec, shortSideBuffer)
  const bp2 = addVectorToPoint(addVectorToPoint(b1, normal, 0.5 * width + longSideBuffer), vec, shortSideBuffer)
  const bp3 = addVectorToPoint(addVectorToPoint(b0, normal, 0.5 * width + longSideBuffer), vec, -shortSideBuffer)
  const bufferPolygon = [bp0, bp1, bp2, bp3]

  return [building, buildingPolygon, bufferPolygon]
}

function getRandomizedBuildingsSuggestion(
  polygon,
  minX,
  maxX,
  minY,
  maxY,
  angle,
  buildingWidth,
  minLength,
  maxLength,
  longSideBuffer,
  shortSideBuffer,
) {
  const bufferPolygons = []
  const buildingPolygons = []
  const buildings = []
  let count = 0
  let i = 0
  while (count < 8) {
    i += 1
    let [building, buildingPolygon, bufferPolygon] = drawRandomBuildingInBox(
      minX,
      maxX,
      minY,
      maxY,
      buildingWidth,
      minLength,
      maxLength,
      longSideBuffer,
      shortSideBuffer,
    )
    const areaOfBuilding = polygonArea(buildingPolygon)
    const siteOverlapArea = getIntersectionAreas([polygon, buildingPolygon])[0]
    const buildingBufferOverlap = getIntersectionAreas([buildingPolygon, ...bufferPolygons])[0]
    const bufferBuildingOverlap = getIntersectionAreas([bufferPolygon, ...buildingPolygons])[0]
    if (areaOfBuilding - siteOverlapArea > 0.1 || bufferBuildingOverlap > 1 || buildingBufferOverlap > 1) {
      if (i > 1000) return buildings
      continue
    }
    building = rotatePolygon(building, -angle)
    buildingPolygons.push(buildingPolygon)
    bufferPolygons.push(bufferPolygon)
    buildings.push(building)
    count += 1
  }
  return buildings
}

function getBYA(buildings, buildingWidth) {
  return buildings.reduce((bya, building) => bya + pointPointDistance(...building) * buildingWidth, 0)
}

export function getRandomizedBuildings(
  raw_polygon,
  buildingWidth,
  minLength,
  maxLength,
  longSideBuffer,
  shortSideBuffer,
  stories,
) {
  let graph = { vertices: {}, edges: {} }
  let polygon = deepCopy(raw_polygon)
  const angle = getMinBoundingRectangleAngle(polygon, 100) + Math.PI / 2
  polygon = rotatePolygon(polygon, angle)
  if (polygon.length === 0) return graph

  const minX = polygon.reduce((minX, [x]) => (x < minX ? x : minX), Infinity)
  const minY = polygon.reduce((minY, [, y]) => (y < minY ? y : minY), Infinity)
  const maxX = polygon.reduce((maxX, [x]) => (x > maxX ? x : maxX), 0)
  const maxY = polygon.reduce((maxY, [, y]) => (y > maxY ? y : maxY), 0)

  let bestBYA = 0
  let bestBuildings = []
  for (let i = 0; i < 5; i++) {
    const buildings = getRandomizedBuildingsSuggestion(
      polygon,
      minX,
      maxX,
      minY,
      maxY,
      angle,
      buildingWidth,
      minLength,
      maxLength,
      longSideBuffer,
      shortSideBuffer,
    )
    const currentBYA = getBYA(buildings, buildingWidth)
    if (currentBYA > bestBYA) {
      bestBuildings = buildings
      bestBYA = currentBYA
    }
  }
  bestBuildings.forEach((building) => (graph = addBuildingToGraph(graph, building, { stories, width: buildingWidth })))
  return graph
}

//
// Row houses
//

function buildingsInPolygon(polygon, angle, shift, widthX, widthY, gapX, gapY) {
  const rotatedPolygon = rotatePoints(polygon, -angle)
  const bbox = getBoundingBoxCoveringAllRotationAnglesForPolygon(rotatedPolygon)
  const rectangles = boundingBoxToBuildings(bbox, widthX, rotatedPolygon, gapY, gapX, shift)
  return splitBuildingsToFixedLengthLamellas(rectangles, widthY, gapY)
}

function getBestAngleAndShift(polygon, widthX, widthY, gapX, gapY) {
  let bestParams = []
  let bestNoBuildings = 0
  const noShifts = 10
  const noAngles = 20

  for (let i = 0; i < noShifts; i++) {
    const curShift = i / noShifts
    for (let j = 0; j < noAngles; j++) {
      const curAngle = (j * Math.PI) / noAngles
      const curNoBuildings = buildingsInPolygon(polygon, curAngle, curShift, widthX, widthY, gapX, gapY).length
      if (curNoBuildings === bestNoBuildings) {
        bestParams.push([curShift, curAngle])
      }
      if (curNoBuildings > bestNoBuildings) {
        bestNoBuildings = curNoBuildings
        bestParams = [[curShift, curAngle]]
      }
    }
  }
  return bestParams[Math.floor(Math.random() * bestParams.length)]
}

export function getRowHouses(
  raw_polygon,
  frontYardDepth = 2,
  backYardDepth = 4,
  unitWidth = 3,
  unitDepth = 6,
  noUnits = 8,
  streetWidth = 5,
  stories = 2,
) {
  let graph = { vertices: {}, edges: {} }
  const polygon = deepCopy(raw_polygon)
  const widthX = frontYardDepth + unitDepth + backYardDepth
  const widthY = unitWidth * noUnits
  const gapX = streetWidth
  const gapY = streetWidth

  const [shift, angle] = getBestAngleAndShift(polygon, widthX, widthY, gapX, gapY)

  const rectanglePoints = buildingsInPolygon(polygon, angle, shift, widthX, widthY, gapX, gapY)

  const shiftedRectanglePoints = rectanglePoints.map((rect) => {
    return rect.map((p) => [p[0] - widthX / 2 + backYardDepth + unitDepth / 2, p[1]])
  })
  const buildings = shiftedRectanglePoints.map((b) => rotatePolygon(b, angle))

  buildings.forEach((building) => {
    graph = addBuildingToGraph(graph, building, { stories, width: unitDepth, minSubBuildingLength: unitWidth })
  })

  return graph
}
