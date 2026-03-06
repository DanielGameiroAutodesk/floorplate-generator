import type { Vec2, Vec3 } from "../../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"
import type { Polygon } from "../../lineBuildingGenerator/lib/lineBuilding9000/BuildingTypes.js"

export const DEFAULT_ANGLE_THRESHOLD = 1e-4
export const DEFAULT_LENGTH_THRESHOLD = 1e-2

type BufferBox = {
  gap: [number, number]
  length: number
}

export function isClockwise(poly: Polygon) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

export function reversePolygon(polygon: Polygon) {
  let reversedPolygon = []
  for (let i = 0; i < polygon.length; i++) {
    reversedPolygon.push(polygon[polygon.length - i - 1])
  }
  return reversedPolygon
}

export function getCCWPolygon(polygon: Polygon) {
  if (isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function getCWPolygon(polygon: Polygon) {
  if (!isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function isPolygonClockwise(poly: Vec2[]) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y),
    0,
  )
  return sum > 0
}

export function makePolygonCounterClockwise(polygon: Vec2[]) {
  const poly = [...polygon]
  if (isPolygonClockwise(poly)) poly.reverse()
  return poly
}

export function makePolygonClockwise(polygon: Vec2[]) {
  const poly = [...polygon]
  if (!isPolygonClockwise(poly)) poly.reverse()
  return poly
}

export function getBoundingBoxOfPolygon(polygon: Vec2[]) {
  const minX = polygon.reduce((minX, point) => Math.min(point.x, minX), Infinity)
  const maxX = polygon.reduce((maxX, point) => Math.max(point.x, maxX), -Infinity)
  const minY = polygon.reduce((minY, point) => Math.min(point.y, minY), Infinity)
  const maxY = polygon.reduce((maxY, point) => Math.max(point.y, maxY), -Infinity)
  return { minX, maxX, minY, maxY }
}

export function getBoundingBoxOfPolygons(polygons: Vec2[][]) {
  return getBoundingBoxOfPolygon(polygons.flat())
}

export function getCenterAndSizeOfBBoxOfPolygon(polygon: Vec2[]) {
  const bbox = getBoundingBoxOfPolygon(polygon)
  const boxLength = bbox.maxX - bbox.minX
  const boxWidth = bbox.maxY - bbox.minY
  const centerX = (bbox.maxX + bbox.minX) / 2
  const centerY = (bbox.maxY + bbox.minY) / 2
  return { centerX, centerY, boxLength, boxWidth }
}

export function getCenterAndSizeOfBBoxOfPolygons(polygons: Vec2[][]) {
  const bbox = getBoundingBoxOfPolygons(polygons)
  const boxLength = bbox.maxX - bbox.minX
  const boxWidth = bbox.maxY - bbox.minY
  const centerX = (bbox.maxX + bbox.minX) / 2
  const centerY = (bbox.maxY + bbox.minY) / 2
  return { centerX, centerY, boxLength, boxWidth }
}

export function rotatePolygon(polygon: Vec2[], angle: number) {
  const [cosA, sinA] = [Math.cos(angle), Math.sin(angle)]
  const [sx, sy] = [cosA, sinA]
  const [tx, ty] = [-sy, sx]
  return polygon.map((point) => {
    const s = point.x * sx + point.y * sy
    const t = point.x * tx + point.y * ty
    return { x: s, y: t }
  })
}

export function normalizeAngle(angle: number) {
  if (angle < -Math.PI) {
    angle += Math.ceil((-Math.PI - angle) / (2 * Math.PI)) * 2 * Math.PI
  } else if (angle > Math.PI) {
    angle -= Math.ceil((angle - Math.PI) / (2 * Math.PI)) * 2 * Math.PI
  }
  return angle
}

export function flipPolygonOnX(polygonToFlip: Vec2[], referencePolygon: Vec2[]) {
  const minMaxPolygon = referencePolygon ? referencePolygon : polygonToFlip

  let minX = Infinity
  let maxX = -Infinity

  for (let i = 0; i < minMaxPolygon.length; i++) {
    const x = minMaxPolygon[i].x
    minX = Math.min(x, minX)
    maxX = Math.max(x, maxX)
  }

  const flippedPolygon = polygonToFlip.map((point) => {
    const x = minX + maxX - point.x
    const y = point.y
    return { x, y }
  })

  return makePolygonCounterClockwise(flippedPolygon)
}

function findSmallestBoundingRectangleAngle(polygon: Vec2[], n: number) {
  let minAngle = 0
  let minArea = Infinity
  for (let i = 1; i <= n; i++) {
    const angle = ((0.5 * Math.PI) / n) * i
    const rotatedPolygon = rotatePolygon(polygon, angle)
    const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygon(rotatedPolygon)
    const area = (maxX - minX) * (maxY - minY)
    if (area < minArea) {
      minArea = area
      minAngle = angle
    }
  }
  return minAngle
}

export function getMinBoundingRectangle(polygon: Vec2[], n: number) {
  const angle = findSmallestBoundingRectangleAngle(polygon, n)
  const rotatedPolygon = rotatePolygon(polygon, angle)
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygon(rotatedPolygon)
  const rotatedBoundingBox = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const boundingRect = rotatePolygon(rotatedBoundingBox, -angle)
  const length = maxX - minX
  const width = maxY - minY
  return { boundingRect, length, width, angle, origin: boundingRect[0] }
}

export function getUnitVectorXY(startPoint: Vec2, endPoint: Vec2) {
  const distance = getDistBetweenPoints(startPoint, endPoint)
  const vectorX = (endPoint.x - startPoint.x) / distance
  const vectorY = (endPoint.y - startPoint.y) / distance

  return { x: vectorX, y: vectorY }
}

export function getUnitNormalVectorXY(startPoint: Vec2, endPoint: Vec2) {
  const unitVec = getUnitVectorXY(startPoint, endPoint)
  return { x: -unitVec.y, y: unitVec.x }
}

/**
 * Returns the closest point on a line to a given point
 * @param startPoint {{x: number, y: number, z: number}}
 * @param endPoint {{x: number, y: number, z: number}}
 * @param point {{x: number, y: number, z: number}}
 * @returns {{x: number, y: number, z: number}}
 */
export function getClosestPointOnLine(startPoint: Vec3, endPoint: Vec3, point: Vec3): Vec3 {
  const edgeLength =
    ((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2 + (endPoint.z - startPoint.z) ** 2) ** 0.5
  const unit = {
    x: (endPoint.x - startPoint.x) / edgeLength,
    y: (endPoint.y - startPoint.y) / edgeLength,
    z: (endPoint.z - startPoint.z) / edgeLength,
  }
  const s = (point.x - startPoint.x) * unit.x + (point.y - startPoint.y) * unit.y + (point.z - startPoint.z) * unit.z
  if (s <= 0) {
    return startPoint
  }
  if (s >= edgeLength) {
    return endPoint
  }
  const x = startPoint.x + unit.x * s
  const y = startPoint.y + unit.y * s
  const z = startPoint.z + unit.z * s
  return { x, y, z }
}

export function getDistFromPointToLine(startPoint: Vec2, endPoint: Vec2, point: Vec2) {
  const edgeLength = getDistBetweenPoints(startPoint, endPoint)
  if (edgeLength < 1e-8) return getDistBetweenPoints(endPoint, point)
  const unit = getUnitVectorXY(startPoint, endPoint)
  const normal = getUnitNormalVectorXY(startPoint, endPoint)

  const s = (point.x - startPoint.x) * unit.x + (point.y - startPoint.y) * unit.y
  const t = (point.x - startPoint.x) * normal.x + (point.y - startPoint.y) * normal.y

  if (s < 0) {
    return (s ** 2 + t ** 2) ** 0.5
  }
  if (s > edgeLength) {
    return ((s - edgeLength) ** 2 + t ** 2) ** 0.5
  }
  return Math.abs(t)
}

export function getDistBetweenPoints(pointOne: Vec2, pointTwo: Vec2) {
  return ((pointTwo.x - pointOne.x) ** 2 + (pointTwo.y - pointOne.y) ** 2) ** 0.5
}

export function arePointsIdentical(pointOne: Vec2, pointTwo: Vec2) {
  const threshold = 1e-4
  return getDistBetweenPoints(pointOne, pointTwo) < threshold
}

export function getLineLength(line: [Vec2, Vec2]) {
  return getDistBetweenPoints(line[0], line[1])
}

export function getUnitAndNormalVectorsOfLine(line: [Vec2, Vec2]) {
  const [pOne, pTwo] = line
  const length = getLineLength(line)
  const dx = (pTwo.x - pOne.x) / length
  const dy = (pTwo.y - pOne.y) / length
  return { unit: [dx, dy], normal: [-dy, dx] }
}
export function getLongestLineInPolygon(polygon: Vec2[]) {
  const n = polygon.length
  let indexOfLongestLine: number = 0
  let longestLength = 0
  for (let i = 0; i < n; i++) {
    const pointOne = polygon[i]
    const pointTwo = polygon[(i + 1) % n]
    const length = getDistBetweenPoints(pointOne, pointTwo)
    if (length > longestLength) {
      indexOfLongestLine = i
      longestLength = length
    }
  }
  const line = [polygon[indexOfLongestLine], polygon[(indexOfLongestLine + 1) % n]]
  return { index: indexOfLongestLine, line }
}

export function getLongestUpwardFacingLineInPolygon(polygon: [Vec2, Vec2]) {
  const n = polygon.length
  let indexOfLongestLine
  let longestLength = 0
  for (let i = 0; i < n; i++) {
    const pointOne = polygon[i]
    const pointTwo = polygon[(i + 1) % n]

    if (pointTwo.x - pointOne.x < 1e-2) continue

    const length = getDistBetweenPoints(pointOne, pointTwo)
    if (length > longestLength) {
      indexOfLongestLine = i
      longestLength = length
    }
  }

  if (indexOfLongestLine === undefined) return getLongestLineInPolygon(polygon)

  const line = [polygon[indexOfLongestLine], polygon[(indexOfLongestLine + 1) % n]]
  return { index: indexOfLongestLine, line }
}

function getLongestBufferBox(line: [Vec2, Vec2], lines: [Vec2, Vec2][], bufferDist: number): BufferBox {
  const lineLength = getLineLength(line)
  if (lineLength === 0) {
    return { length: 0, gap: [0, 0] }
  }
  const {
    unit: [u0, u1],
    normal: [n0, n1],
  } = getUnitAndNormalVectorsOfLine(line)
  const pointOne = line[0]
  const sBase = pointOne.x * u0 + pointOne.y * u1
  const tBase = pointOne.x * n0 + pointOne.y * n1
  const blocks = lines
    .map((line) => {
      const [[s0, t0], [s1, t1]] = line.map((p) => {
        const s = p.x * u0 + p.y * u1 - sBase
        const t = p.x * n0 + p.y * n1 - tBase
        return [s, t]
      })
      if (s1 >= s0) return []
      if (s1 >= lineLength) return []
      if (s0 <= 0) return []
      if (t0 <= 0 && t1 <= 0) return []
      if (t0 >= bufferDist && t1 >= bufferDist) return []
      if (t0 === t1) {
        const start = Math.max(0, s1)
        const end = Math.min(lineLength, s0)
        return [start, end]
      }

      const slope = (t0 - t1) / (s0 - s1)
      const crossOne = s0 - t0 / slope
      const crossTwo = s0 + (bufferDist - t0) / slope
      const firstCross = Math.min(crossOne, crossTwo)
      const lastCross = Math.max(crossOne, crossTwo)
      const start = Math.max(0, s1, firstCross)
      const end = Math.min(lineLength, s0, lastCross)

      if (end <= start) return []
      return [start, end]
    })
    .filter((block) => block.length > 0)
    .sort((blockA, blockB) => blockA[0] - blockB[0])
  let lengthLongestOfGap = 0
  let longestGap: [number, number] = [0, 0]
  let s = 0
  ;[...blocks, [lineLength, lineLength]].forEach((block) => {
    const [start, end] = block
    if (start - s > lengthLongestOfGap) {
      lengthLongestOfGap = start - s
      longestGap = [s, start]
    }
    s = end
  })
  return { gap: longestGap, length: lengthLongestOfGap }
}

export function addVectorToPoint(point: Vec2, vector: Vec2, scalar: number) {
  const x = point.x + vector.x * scalar
  const y = point.y + vector.y * scalar
  return { x, y }
}

export function getLongestBufferedLineInPolygon(polygon: Vec2[], bufferDist: number) {
  const lines = getLinesFromPolygonV(polygon)
  let longestBufferBoxLength = 0
  let longestBufferBox: BufferBox | undefined
  let lineIndex
  lines.forEach((line, i) => {
    const bufferBox = getLongestBufferBox(line, lines, bufferDist)
    if (bufferBox.length > longestBufferBoxLength) {
      longestBufferBoxLength = bufferBox.length
      longestBufferBox = bufferBox
      lineIndex = i
    }
  })
  if (lineIndex === undefined || !longestBufferBox) {
    return undefined
  }

  const line = lines[lineIndex]
  const { unit, normal } = getUnitAndNormalVectorsOfLine(line)
  const p0 = line[0]
  const [gapStart, gapEnd] = longestBufferBox.gap
  const b0 = addVectorToPoint(p0, { x: unit[0], y: unit[1] }, gapStart)
  const b1 = addVectorToPoint(p0, { x: unit[0], y: unit[1] }, gapEnd)
  const b2 = addVectorToPoint(b1, { x: normal[0], y: normal[1] }, bufferDist)
  const b3 = addVectorToPoint(b0, { x: normal[0], y: normal[1] }, bufferDist)
  const bufferBox = [b0, b1, b2, b3, b0]
  return {
    index: lineIndex,
    line: lines[lineIndex],
    gap: longestBufferBox.gap,
    bufferBox,
  }
}

export function coordinateTransformPoint(point: Vec2, origin: Vec2, direction: Vec2) {
  const directionLine = [{ x: 0, y: 0 }, direction] as [Vec2, Vec2]
  const { unit, normal } = getUnitAndNormalVectorsOfLine(directionLine)
  const x = (point.x - origin.x) * unit[0] + (point.y - origin.y) * unit[1]
  const y = (point.x - origin.x) * normal[0] + (point.y - origin.y) * normal[1]
  return { x, y }
}

export function reverseCoordinateTransformPoint(point: Vec2, origin: Vec2, direction: Vec2) {
  const directionLine = [{ x: 0, y: 0 }, direction] as [Vec2, Vec2]
  const { unit, normal } = getUnitAndNormalVectorsOfLine(directionLine)
  const x = origin.x + point.x * unit[0] + point.y * normal[0]
  const y = origin.y + point.x * unit[1] + point.y * normal[1]
  return { x, y }
}

export function coordinateTransformPoints(points: Vec2[], origin: Vec2, direction: [Vec2, Vec2]) {
  const { unit, normal } = getUnitAndNormalVectorsOfLine(direction)
  return points.map((point) => {
    const x = (point.x - origin.x) * unit[0] + (point.y - origin.y) * unit[1]
    const y = (point.x - origin.x) * normal[0] + (point.y - origin.y) * normal[1]
    return { x, y }
  })
}

export function reverseCoordinateTransformPoints(points: Vec2[], origin: Vec2, direction: [Vec2, Vec2]) {
  const { unit, normal } = getUnitAndNormalVectorsOfLine(direction)
  return points.map((point) => {
    const x = origin.x + point.x * unit[0] + point.y * normal[0]
    const y = origin.y + point.x * unit[1] + point.y * normal[1]
    return { x, y }
  })
}

export function isPointOnLine(point: Vec2, line: [Vec2, Vec2], buffer: number) {
  const origin = line[0]
  const [{ x: s, y: t }] = coordinateTransformPoints([point], origin, line)
  const lineLength = getLineLength(line)
  return s >= buffer && s <= lineLength - buffer && Math.abs(t) < buffer
}

export function findCrossingPointOfLines(lineOne: [Vec2, Vec2], lineTwo: [Vec2, Vec2], buffer: number) {
  const origin = lineTwo[0]
  const lineTwoLength = getLineLength(lineTwo)
  const lineOneLength = getLineLength(lineTwo)
  if (lineTwoLength === 0 || lineOneLength === 0) return undefined
  const [{ x: s0, y: t0 }, { x: s1, y: t1 }] = coordinateTransformPoints(lineOne, origin, lineTwo)
  if (t0 >= -buffer && t1 >= -buffer) return undefined
  if (t0 <= buffer && t1 <= buffer) return undefined
  if (s0 >= lineTwoLength - buffer && s1 >= lineTwoLength - buffer) return undefined
  if (s0 <= buffer && s1 <= buffer) return undefined

  const slope = (t1 - t0) / (s1 - s0)
  const s = s0 - t0 / slope
  if (s <= buffer || s >= lineTwoLength - buffer) return undefined
  const lineTwoVec = {
    x: lineTwo[1].x - lineTwo[0].x,
    y: lineTwo[1].y - lineTwo[0].y,
  }
  return addVectorToPoint(origin, lineTwoVec, s / lineTwoLength)
}

export function getPolygonIntersection(point: Vec2, direction: Vec2, polygon: Vec2[]) {
  const directionLength = (direction.x ** 2 + direction.y ** 2) ** 0.5
  const unit = [direction.x / directionLength, direction.y / directionLength]
  const translatedPolygon = coordinateTransformPoints(polygon, point, [{ x: 0, y: 0 }, direction])
  const n = polygon.length
  let dist = Infinity

  for (let i = 0; i < n; i++) {
    const pOne = translatedPolygon[i]
    const pTwo = translatedPolygon[(i + 1) % n]
    if (pOne.y > 0 && pTwo.y > 0) continue
    if (pOne.y <= 0 && pTwo.y <= 0) continue
    if (pOne.x < 0 && pTwo.x < 0) continue
    if (pOne.x === pTwo.x) {
      if (pOne.x < dist) {
        dist = pOne.x
      }
      continue
    }
    const slope = (pTwo.y - pOne.y) / (pTwo.x - pOne.x)
    const x = pOne.x - pOne.y / slope
    if (x > 0 && x < dist) {
      dist = x
    }
  }
  if (dist < Infinity) {
    return addVectorToPoint(point, { x: unit[0], y: unit[1] }, dist)
  }

  return undefined
}

function getLinesFromPolygonV(polygon: Vec2[]) {
  const lines: [Vec2, Vec2][] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const pointOne = polygon[i]
    const pointTwo = polygon[(i + 1) % n]
    const line = [pointOne, pointTwo] as [Vec2, Vec2]
    lines.push(line)
  }
  return lines
}

export const getLinesFromPolygon = (polygon: Vec2[]) => {
  const lines = []
  const n = polygon.length
  for (let i = 0; i < n - 1; i++) {
    const line = [polygon[i], polygon[(i + 1) % n]]
    lines.push(line)
  }
  return lines
}

export const getLinesFromPolygons = (polygons: Vec2[][]) => {
  return polygons.flatMap(getLinesFromPolygon)
}

export function areaOfPolygon(polygon: Vec2[], holes: Vec2[][] = []) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0.x * p1.y - p1.x * p0.y)
  }

  let negativeArea = 0
  const nHoles = holes.length
  for (let i = 0; i < nHoles; i++) {
    const polygon = holes[i]
    const nPointsHole = polygon.length
    for (let j = 0; j < nPointsHole; j++) {
      const p0 = polygon[j]
      const p1 = polygon[(j + 1) % nPointsHole]
      negativeArea += 0.5 * (p0.x * p1.y - p1.x * p0.y)
    }
  }

  return area - negativeArea
}

export const removeOverlappingLines = (lines: [Vec2, Vec2][]) => {
  if (!lines || lines.length === 0) return []
  let nonOverlappingLines = [lines[0]]
  const nLines = lines.length

  for (let i = 1; i < nLines; i++) {
    let overlapping = false
    const line1 = lines[i]
    const l1p0 = line1[0]
    const l1p1 = line1[1]

    for (let j = 0; j < nonOverlappingLines.length; j++) {
      const line2 = nonOverlappingLines[j]
      const l2p0 = line2[0]
      const l2p1 = line2[1]

      const linesEqual = arePointsIdentical(l1p0, l2p0) && arePointsIdentical(l1p1, l2p1)
      const linesOpposite = arePointsIdentical(l1p0, l2p1) && arePointsIdentical(l1p1, l2p0)

      if (linesEqual || linesOpposite) {
        overlapping = true
        break
      }
    }
    if (!overlapping) nonOverlappingLines.push(line1)
  }
  return nonOverlappingLines
}

export function isPointInsidePolygon(point: Vec2, polygon: Vec2[]) {
  let { x, y } = point
  const n = polygon.length

  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    let xi = polygon[i].x
    let yi = polygon[i].y
    let xj = polygon[j].x
    let yj = polygon[j].y

    let intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function getAnglesInPolygon(polygon: Vec2[]) {
  const n = polygon.length
  const angles = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[(i - 1 + n) % n]
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % n]
    const angleOne = Math.atan2(p1.y - p0.y, p1.x - p0.x)
    const angleTwo = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    angles.push(normalizeAngle(angleTwo - angleOne))
  }
  return angles
}

export function getLineLengthsInPolygon(polygon: Vec2[]) {
  const n = polygon.length
  const lengths = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % n]
    lengths.push(getDistBetweenPoints(p0, p1))
  }
  return lengths
}

export function removeRedundantPointsFromPolygon(
  rawPolygon: Vec2[],
  angleThreshold = DEFAULT_ANGLE_THRESHOLD,
  closedPolygon = true,
) {
  if (rawPolygon.length < 2) return rawPolygon
  const lineLengths = getLineLengthsInPolygon(rawPolygon)
  let polygon = rawPolygon.filter((p, i) => lineLengths[i] !== 0)
  const angles = getAnglesInPolygon(polygon)
  polygon = polygon.filter((p, i) => Math.abs(angles[i]) > angleThreshold)
  if (polygon.length > 0 && closedPolygon) polygon.push(polygon[0])
  return polygon
}

export function getTranslatePolygon(polygon: Vec2[], holes: Vec2[][] = [], translate: Vec2) {
  const tPolygon = polygon.map((point) => {
    const x = point.x + translate.x
    const y = point.y + translate.y
    return { x, y }
  })
  const tHoles = holes.map((hole) =>
    hole.map((point) => {
      const x = point.x + translate.x
      const y = point.y + translate.y
      return { x, y }
    }),
  )
  return { polygon: tPolygon, holes: tHoles }
}

export function getScaledPolygon(polygon: Vec2[], holes: Vec2[][] = [], scale: number) {
  const sPolygon = polygon.map((point) => {
    const x = point.x * scale
    const y = point.y + scale
    return { x, y }
  })
  const sHoles = holes.map((hole) =>
    hole.map((point) => {
      const x = point.x + scale
      const y = point.y + scale
      return { x, y }
    }),
  )
  return { polygon: sPolygon, holes: sHoles }
}

function rotatePointAroundPivot(point: Vec2, rotation: number, pivot: Vec2) {
  const cosAngle = Math.cos(rotation)
  const sinAngle = Math.sin(rotation)
  const x = (point.x - pivot.x) * cosAngle - (point.y - pivot.y) * sinAngle + pivot.x
  const y = (point.x - pivot.x) * sinAngle + (point.y - pivot.y) * cosAngle + pivot.y
  return { x, y }
}

export function getRotatedPolygon(polygon: Vec2[], holes: Vec2[][], rotation: number, pivot: Vec2) {
  const rPolygon = polygon.map((point) => {
    return rotatePointAroundPivot(point, rotation, pivot)
  })
  const rHoles = holes.map((hole) =>
    hole.map((point) => {
      return rotatePointAroundPivot(point, rotation, pivot)
    }),
  )
  return { polygon: rPolygon, holes: rHoles }
}
