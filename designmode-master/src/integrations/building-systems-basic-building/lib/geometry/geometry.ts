import pc from "polygon-clipping"

export type Point = [number, number]
export type Polygon = Point[]
export type PolygonWithHoles = { polygon: Polygon; holes: Polygon[] }
export type PointXY = { x: number; y: number }
export type LineXY = [PointXY, PointXY]
export type PolygonXY = PointXY[]
export type PolygonWithHolesXY = { polygon: PolygonXY; holes: PolygonXY[] }

export function isPolygonClosed(polygon: PolygonXY) {
  const n = polygon.length
  const startPoint = polygon[0]
  const endPoint = polygon[n - 1]
  return startPoint.x === endPoint.x && startPoint.y === endPoint.y
}

export function isPolygonClockwise(poly: PolygonXY) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y),
    0,
  )
  return sum > 0
}

export function makePolygonCounterClockwise(polygon: PolygonXY) {
  if (isPolygonClockwise(polygon)) return [...polygon].reverse()
  return polygon
}

export function getDistBetweenPoints(pointOne: PointXY, pointTwo: PointXY) {
  return ((pointTwo.x - pointOne.x) ** 2 + (pointTwo.y - pointOne.y) ** 2) ** 0.5
}

export function getCornerAngle(p0: PointXY, p1: PointXY, p2: PointXY) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function filterZeroEdges(polygon: PolygonXY) {
  const n = polygon.length
  return polygon.filter((point, i) => {
    const prevPoint = polygon[(i - 1 + n) % n]
    const dist = getDistBetweenPoints(prevPoint, point)
    return dist > 1e-8
  })
}

export function getAnglesInPolygon(polygon: PolygonXY) {
  const n = polygon.length
  const angles = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[(i + n - 1) % n]
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % n]
    const angle = getCornerAngle(p0, p1, p2)
    angles.push(angle)
  }
  return angles
}

function isAngleRight(angle: number, threshold = 1e-8) {
  const count = Math.round(angle / (0.5 * Math.PI))
  const restAngle = angle - count * 0.5 * Math.PI
  return Math.abs(restAngle) < threshold && (count % 2 === 1 || count % 2 === -1)
}

function isAngleZero(angle: number, threshold = 1e-8) {
  const restAngle = angle - Math.round(angle / (Math.PI * 2)) * (Math.PI * 2)
  return Math.abs(restAngle) < threshold
}

function filterZeroAngles(polygon: PolygonXY) {
  const n = polygon.length
  return polygon.filter((point, i) => {
    const prevPoint = polygon[(i - 1 + n) % n]
    const nextPoint = polygon[(i + 1) % n]
    const angle = getCornerAngle(prevPoint, point, nextPoint)
    return !isAngleZero(angle)
  })
}

export function filterZeroEdgesAndAngles(polygon: PolygonXY) {
  const filteredPolygon = filterZeroEdges(polygon)
  return filterZeroAngles(filteredPolygon)
}

export function areaOfPolygon(polygon: PolygonXY) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0.x * p1.y - p1.x * p0.y)
  }
  return area
}

export function areaOfPolygonWithHoles(polygonWithHoles: PolygonWithHolesXY) {
  return [polygonWithHoles.polygon, ...polygonWithHoles.holes].reduce((acc, p) => acc + areaOfPolygon(p), 0)
}

export function isPointInsidePolygon(point: PointXY, polygon: PolygonXY) {
  let { x, y } = point
  const n = polygon.length

  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    let xi = polygon[i].x
    let yi = polygon[i].y
    let xj = polygon[j].x
    let yj = polygon[j].y

    let intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function calculateUnionOfPolygonsWithHoles(polygonsWithHoles: PolygonWithHolesXY[]): PolygonWithHolesXY[] {
  const polys: pc.Polygon[] = []
  for (const polygonWithHoles of polygonsWithHoles) {
    const holes = polygonWithHoles.holes.map((hole) => hole.map(({ x, y }) => [x, y] as [number, number]))
    polys.push([polygonWithHoles.polygon.map(({ x, y }) => [x, y]), ...holes])
  }
  return pc.union(polys).map((polyWithHoles): PolygonWithHolesXY => {
    const [polygon, ...holes]: PolygonXY[] = polyWithHoles.map((ring) => ring.map(([x, y]) => ({ x, y })))
    return { polygon, holes }
  })
}

function roundPolygonCoordinates(polygon: pc.Polygon): pc.Polygon {
  const round = (x: number) => Math.fround(x)
  return polygon.map((ring) => ring.map(([x, y]) => [round(x), round(y)]))
}

function roundMultiPolygonCoordinates(multiPolygon: pc.MultiPolygon): pc.MultiPolygon {
  return multiPolygon.map(roundPolygonCoordinates)
}

export function calculateDifference(
  subjectGeometry: PolygonWithHolesXY[],
  clipGeometries: PolygonWithHolesXY[],
): PolygonWithHolesXY[] {
  const subjectMultiPoly: pc.MultiPolygon = []
  for (const polygonWithHoles of subjectGeometry) {
    const holes = polygonWithHoles.holes.map((hole) => hole.map(({ x, y }) => [x, y] as [number, number]))
    subjectMultiPoly.push([polygonWithHoles.polygon.map(({ x, y }) => [x, y]), ...holes])
  }

  const clipPolys: pc.Polygon[] = []
  for (const polygonWithHoles of clipGeometries) {
    const holes = polygonWithHoles.holes.map((hole) => hole.map(({ x, y }) => [x, y] as [number, number]))
    clipPolys.push([polygonWithHoles.polygon.map(({ x, y }) => [x, y]), ...holes])
  }

  // Round coordinates to avoid floating point precision issues
  const roundedSubject = roundMultiPolygonCoordinates(subjectMultiPoly)
  const roundedClips = clipPolys.map(roundPolygonCoordinates)

  return pc.difference(roundedSubject, ...roundedClips).map((polyWithHoles): PolygonWithHolesXY => {
    const [polygon, ...holes]: PolygonXY[] = polyWithHoles.map((ring) => ring.map(([x, y]) => ({ x, y })))
    return { polygon, holes }
  })
}

export function removeLastPointInPolygonIfEqualsFirst(polygon: PolygonXY) {
  const n = polygon.length
  if (n <= 1) return polygon
  const lastPointEqualFirst = polygon[0].x === polygon[n - 1].x && polygon[0].y === polygon[n - 1].y
  if (lastPointEqualFirst) return polygon.slice(0, n - 1)
  return polygon
}

export function getEdgeLengthsInPolygon(polygon: PolygonXY) {
  const edgeLengths: number[] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    edgeLengths.push(getDistBetweenPoints(polygon[i], polygon[(i + 1) % n]))
  }
  return edgeLengths
}

export function transformPoint(point: PointXY, origin: PointXY, unitVector: PointXY): PointXY {
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const s = dx * unitVector.x + dy * unitVector.y
  const t = -dx * unitVector.y + dy * unitVector.x
  return { x: s, y: t }
}

export function transformPolygonXY(polygon: PolygonXY, origin: PointXY, unitVector: PointXY): PolygonXY {
  return polygon.map((point) => transformPoint(point, origin, unitVector))
}

export function transformPolygonWithHolesXY(
  polygonWithHoles: PolygonWithHolesXY,
  origin: PointXY,
  unitVector: PointXY,
): PolygonWithHolesXY {
  const polygon = transformPolygonXY(polygonWithHoles.polygon, origin, unitVector)
  const holes = polygonWithHoles.holes.map((hole) => transformPolygonXY(hole, origin, unitVector))
  return { polygon, holes }
}

export function getUnitVectorXY(startPoint: PointXY, endPoint: PointXY): PointXY {
  const distance = getDistBetweenPoints(startPoint, endPoint)
  const vectorX = (endPoint.x - startPoint.x) / distance
  const vectorY = (endPoint.y - startPoint.y) / distance

  return { x: vectorX, y: vectorY }
}

export function isPolygonRectangle(_polygon: PolygonXY) {
  const polygon = removeLastPointInPolygonIfEqualsFirst(_polygon)
  const angles = getAnglesInPolygon(polygon)
  let numberOfRightAngles = 0
  for (let angle of angles) {
    const isRightAngle = isAngleRight(angle, 1e-4)
    const isZeroAngle = isAngleZero(angle, 1e-4)
    if (!isRightAngle && !isZeroAngle) return false
    if (isRightAngle) numberOfRightAngles += 1
  }
  return numberOfRightAngles === 4
}

export function polygonToXY(polygon: Polygon): PolygonXY {
  return polygon.map(([x, y]) => ({ x, y }))
}
export function polygonWithHolesToXY(polygonWithHoles: PolygonWithHoles): PolygonWithHolesXY {
  const polygon = polygonWithHoles.polygon.map(([x, y]) => ({ x, y }))
  const holes = polygonWithHoles.holes.map((hole) => hole.map(([x, y]) => ({ x, y })))
  return { polygon, holes }
}
export function polygonWithHolesFromXY(polygonWithHoles: PolygonWithHolesXY): PolygonWithHoles {
  const polygon: Polygon = polygonWithHoles.polygon.map(({ x, y }) => [x, y])
  const holes: Polygon[] = polygonWithHoles.holes.map((hole) => hole.map(({ x, y }) => [x, y]))
  return { polygon, holes }
}

export function coordinateTransformPoint(point: PointXY, origin: PointXY, direction: PointXY) {
  const x = (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y
  const y = -(point.x - origin.x) * direction.y + (point.y - origin.y) * direction.x
  return { x, y }
}

export function coordinateTransformPoints(points: PointXY[], origin: PointXY, direction: PointXY) {
  return points.map((point) => coordinateTransformPoint(point, origin, direction))
}

export function isPointOnLine(point: PointXY, line: LineXY, buffer: number) {
  const origin = line[0]
  const unit = getUnitVectorXY(...line)
  const { x: s, y: t } = coordinateTransformPoint(point, origin, unit)
  const lineLength = getDistBetweenPoints(...line)
  return s >= buffer && s <= lineLength - buffer && Math.abs(t) < buffer
}

export function doLinesCross(lineOne: LineXY, lineTwo: LineXY, sideBuffer: number = 0) {
  const origin = lineTwo[0]
  const lineTwoLength = getDistBetweenPoints(...lineTwo)
  const lineOneLength = getDistBetweenPoints(...lineTwo)
  const unitVec = getUnitVectorXY(...lineTwo)
  if (lineTwoLength === 0 || lineOneLength === 0) return false
  const [{ x: s0, y: t0 }, { x: s1, y: t1 }] = coordinateTransformPoints(lineOne, origin, unitVec)
  if (t0 > 0 && t1 > 0) return false
  if (t0 < 0 && t1 < 0) return false
  if (s0 > lineTwoLength && s1 > lineTwoLength) return false
  if (s0 < 0 && s1 < 0) return false

  const slope = (t1 - t0) / (s1 - s0)
  const s = s0 - t0 / slope
  return s >= sideBuffer && s <= lineTwoLength - sideBuffer
}

export function closePolygon(polygon: PolygonXY) {
  if (isPolygonClosed(polygon)) return polygon
  return [...polygon, polygon[0]]
}

export function isPolygonSelfIntersecting(points: PolygonXY): boolean {
  if (points.length <= 3) return false
  const closed = isPolygonClosed(points)
  const n = points.length
  const m = closed ? n - 1 : n
  for (let i = 0; i < m; i++) {
    const lineOne: LineXY = [points[i], points[(i + 1) % m]]
    const lineLength = getDistBetweenPoints(...lineOne)
    if (lineLength === 0) continue
    for (let j = 0; j < m; j++) {
      if (i === j || (i + 1) % m === j || (j + 1) % m === i) continue
      const lineTwo: LineXY = [points[j], points[(j + 1) % m]]
      if (doLinesCross(lineOne, lineTwo)) return true
      if (isPointOnLine(lineOne[0], lineTwo, 1e-4)) return true
      if (isPointOnLine(lineOne[1], lineTwo, 1e-4)) return true
    }
  }
  return false
}
