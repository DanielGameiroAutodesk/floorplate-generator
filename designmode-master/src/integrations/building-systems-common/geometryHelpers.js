export function getAngle(p0, p1, p2) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

export function getAngleXY(p0, p1, p2) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  return getAngle([x0, y0], [x1, y1], [x2, y2])
}

export function pointPointDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

function addVectorToPoint(point, vector) {
  return [point[0] + vector[0], point[1] + vector[1]]
}

function scale(vector, scalar) {
  return [scalar * vector[0], scalar * vector[1]]
}

export function getUnitNormalVector(p0, p1) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
  return [(y0 - y1) / length, (x1 - x0) / length]
}

export function movePointAlongVector(point, vector, distance) {
  const moveVector = scale(normalizeVector(vector), distance)
  return addVectorToPoint(point, moveVector)
}

function normalizeVector(vector) {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length]
}

function vectorLength(vector) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2))
}

export function getUnitVector(startPoint, endPoint) {
  const distance = pointPointDistance(startPoint, endPoint)
  if (distance === 0) {
    return [0, 0]
  }
  const vectorX = (endPoint[0] - startPoint[0]) / distance
  const vectorY = (endPoint[1] - startPoint[1]) / distance
  return [vectorX, vectorY]
}

// XY

export function getUnitVectorXY(startPoint, endPoint) {
  const distance = ((endPoint.x - startPoint.x) ** 2 + (endPoint.y - startPoint.y) ** 2) ** 0.5
  if (distance === 0) return { x: 0, y: 0 }
  const dx = (endPoint.x - startPoint.x) / distance
  const dy = (endPoint.y - startPoint.y) / distance
  return { x: dx, y: dy }
}

export function getUnitNormalVectorXY(startPoint, endPoint) {
  const unitVector = getUnitVectorXY(startPoint, endPoint)
  const dx = -unitVector.y
  const dy = unitVector.x
  return { x: dx, y: dy }
}

export function moveAlongVectorXY(point, vector, scalar) {
  const x = point.x + vector.x * scalar
  const y = point.y + vector.y * scalar
  return { x, y }
}

export function pointPointDistanceXY(pointOne, pointTwo) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

export function areaOfPolygon(polygon) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0[0] * p1[1] - p1[0] * p0[1])
  }

  return area
}

export function addVectorToPointXY(point, vector, scalar = 1) {
  return { x: point.x + scalar * vector.x, y: point.y + scalar * vector.y }
}
