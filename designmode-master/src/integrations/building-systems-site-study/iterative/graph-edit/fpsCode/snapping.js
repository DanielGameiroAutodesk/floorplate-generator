import {
  addVectorToPoint,
  coordinateTransformPoints,
  findCrossingPointOfLines,
  getDistBetweenPoints,
  getLineLength,
  getUnitVectorXY,
} from "./utils/geoUtils" // eslint-disable-line import/no-internal-modules

function findClosestPoint(point, walls) {
  if (walls.length === 0) return { dist: Infinity }
  let shortestDist = Infinity
  let wallIndex, pointIndex
  walls.forEach((wall, i) =>
    wall.forEach((wallPoint, j) => {
      const dist = getDistBetweenPoints(point, wallPoint)
      if (dist < shortestDist) {
        shortestDist = dist
        wallIndex = i
        pointIndex = j
      }
    }),
  )
  return {
    dist: shortestDist,
    point: walls[wallIndex][pointIndex],
    wallIndex,
    pointIndex,
  }
}

function findClosestWallPoint(point, walls) {
  const closestWallPoint = findClosestPoint(point, walls)
  return closestWallPoint
}

function findDistFromPointToLineAndClosestPoint(point, line) {
  const lineLength = getLineLength(line)
  const [startPoint, endPoint] = line
  const [{ x: s, y: t }] = coordinateTransformPoints([point], startPoint, line)
  if (s < 0) {
    const dist = (s ** 2 + t ** 2) ** 0.5
    return { dist, closestPoint: line[0] }
  } else if (s > lineLength) {
    const dist = ((s - lineLength) ** 2 + t ** 2) ** 0.5
    return { dist, closestPoint: line[1] }
  } else {
    const dist = Math.abs(t)
    const closestPoint = addVectorToPoint(
      line[0],
      { x: endPoint.x - startPoint.x, y: endPoint.y - startPoint.y },
      s / lineLength,
    )
    return { dist, closestPoint }
  }
}
function getClosestLine(point, lines) {
  if (lines.length === 0) return { dist: Infinity }
  let minDistance = Infinity
  let closestLine
  let closestLineIndex
  let projectionPoint

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const { dist, closestPoint } = findDistFromPointToLineAndClosestPoint(point, line)
    if (dist < minDistance) {
      minDistance = dist
      projectionPoint = closestPoint
      closestLine = line
      closestLineIndex = i
    }
  }

  return {
    dist: minDistance,
    point: projectionPoint,
    line: closestLine,
    lineIndex: closestLineIndex,
  }
}

function getClosestWallLine(point, wallLines) {
  const closestWallLine = getClosestLine(point, wallLines)
  return closestWallLine
}
function getClosestGuideLine(point, guidelines) {
  const lines = guidelines.map((gl) => gl.line)
  const closestLine = getClosestLine(point, lines)
  if (closestLine.lineIndex === undefined) return { dist: Infinity }
  const guideLine = guidelines[closestLine.lineIndex]
  return { ...closestLine, guideLine }
}

function snapLinePointToGuideLine(line, point, guideLines, snappingFactor) {
  let closestDist = Infinity
  let closestGuideLine
  let closestCrossingPoint

  for (let guideLine of guideLines) {
    const crossPoint = findCrossingPointOfLines(line, guideLine.line, 1e-4)
    if (!crossPoint) continue
    const dist = getDistBetweenPoints(point, crossPoint)
    if (dist < Math.min(closestDist, snappingFactor)) {
      closestDist = dist
      closestGuideLine = guideLine
      closestCrossingPoint = crossPoint
    }
  }

  if (closestGuideLine) {
    return { point: closestCrossingPoint, guideLine: closestGuideLine }
  }

  return undefined
}

function snapAlongLine(line, point, snappingDist, guideLines) {
  if (guideLines) {
    const snappedToGuide = snapLinePointToGuideLine(line, point, guideLines, snappingDist)
    if (snappedToGuide)
      return {
        snappedPoint: snappedToGuide.point,
        guideLines: [snappedToGuide.guideLine],
      }
  }
  return { snappedPoint: point }
}

function snapAlongGuideLine(closestGuideLine, snappingDist, guideLines) {
  const [p0, p1] = closestGuideLine.line
  const unitVec = getUnitVectorXY(p0, p1)
  const nonParallelGuideLines = guideLines.filter((gl) => {
    const unitVecTwo = getUnitVectorXY(gl.line[0], gl.line[1])
    const crossProd = unitVec.x * unitVecTwo.y - unitVec.y * unitVecTwo.x
    return Math.abs(crossProd) > 1e-3
  })

  const snapData = snapAlongLine(closestGuideLine.line, closestGuideLine.point, snappingDist, nonParallelGuideLines)

  const activeGuideLines = [closestGuideLine.guideLine]
  if (snapData?.guideLines) {
    activeGuideLines.push(...snapData.guideLines)
  }
  return {
    point: snapData.snappedPoint,
    guideLines: activeGuideLines,
    type: "snappedToGuideLine",
  }
}

export function snapPointToWallsOrGrid({ point, walls, snappingRules, snappingDist, guidelines = [] }) {
  const pointSnappingDist = 1.5 * snappingDist

  // Snap to point first
  if (snappingRules.object) {
    const closesPoint = findClosestWallPoint(point, walls)
    if (closesPoint.dist < pointSnappingDist) {
      return { point: closesPoint.point, type: "snappedToVertex" }
    }

    // Snap to line second
    const wallPoint = snapPointToWalls(point, walls, snappingDist, guidelines)
    if (wallPoint) {
      return {
        type: "snappedToWall",
        ...wallPoint,
      }
    }
  }

  // Snap to guideLines
  const closestGuideLine = getClosestGuideLine(point, guidelines)
  if (closestGuideLine.dist < snappingDist) {
    return snapAlongGuideLine(closestGuideLine, snappingDist, guidelines)
  }

  return { point }
}

export function snapPointToWalls(point, walls, snappingDist, guidelines = []) {
  const lineSnappingDist = 1.2 * snappingDist
  const closestLine = getClosestWallLine(point, walls)
  if (closestLine.dist < lineSnappingDist) {
    const { snappedPoint, guideLines } = snapAlongLine(closestLine.line, closestLine.point, snappingDist, guidelines)
    return { point: snappedPoint, wall: closestLine.line, guideLines }
  }
}
