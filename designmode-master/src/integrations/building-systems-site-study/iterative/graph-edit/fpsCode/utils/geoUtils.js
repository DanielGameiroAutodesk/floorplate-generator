export function normalizeAngle(angle) {
  if (angle < -Math.PI) {
    angle += Math.ceil((-Math.PI - angle) / (2 * Math.PI)) * 2 * Math.PI
  } else if (angle > Math.PI) {
    angle -= Math.ceil((angle - Math.PI) / (2 * Math.PI)) * 2 * Math.PI
  }
  return angle
}

export function getUnitVectorXY(startPoint, endPoint) {
  const distance = getDistBetweenPoints(startPoint, endPoint)
  const vectorX = (endPoint.x - startPoint.x) / distance
  const vectorY = (endPoint.y - startPoint.y) / distance

  return { x: vectorX, y: vectorY }
}

export function getUnitNormalVectorXY(startPoint, endPoint) {
  const unitVec = getUnitVectorXY(startPoint, endPoint)
  return { x: -unitVec.y, y: unitVec.x }
}

export function getDistBetweenPoints(pointOne, pointTwo) {
  return ((pointTwo.x - pointOne.x) ** 2 + (pointTwo.y - pointOne.y) ** 2) ** 0.5
}

export function getLineLength(line) {
  return getDistBetweenPoints(line[0], line[1])
}

/**
 *
 * @param line {Line}
 * @returns {{normal: [number, number], unit: [number, number]}}
 */
export function getUnitAndNormalVectorsOfLine(line) {
  const [pOne, pTwo] = line
  const length = getLineLength(line)
  const dx = (pTwo.x - pOne.x) / length
  const dy = (pTwo.y - pOne.y) / length
  return { unit: [dx, dy], normal: [-dy, dx] }
}

export function addVectorToPoint(point, vector, scalar) {
  const x = point.x + vector.x * scalar
  const y = point.y + vector.y * scalar
  return { x, y }
}

export function coordinateTransformPoints(points, origin, direction) {
  const { unit, normal } = getUnitAndNormalVectorsOfLine(direction)
  return points.map((point) => {
    const x = (point.x - origin.x) * unit[0] + (point.y - origin.y) * unit[1]
    const y = (point.x - origin.x) * normal[0] + (point.y - origin.y) * normal[1]
    return { x, y }
  })
}

export function isPointOnLine(point, line, buffer) {
  const origin = line[0]
  const [{ x: s, y: t }] = coordinateTransformPoints([point], origin, line)
  const lineLength = getLineLength(line)
  return s >= 1e-8 && s <= lineLength - 1e-8 && Math.abs(t) < buffer
}

export function findCrossingPointOfLines(lineOne, lineTwo, buffer) {
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
