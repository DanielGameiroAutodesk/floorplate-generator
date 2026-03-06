import {
  getAnglesBetweenVectors,
  getCrossProduct,
  getVectorFromPointToPoint,
  movePointAlongVector,
  normalizeVector,
  pointPointDistance,
  pointToLineSegmentDistance,
  polygonSelfIntersection,
  removeLastPointInPolygonIfEqualsFirst,
  polygonArea,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import {
  argMin,
  getDotProduct,
  mod,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { deepCopy, getAnglesInPolygon, getEdgeLengthsInPolygon } from "./exploreLayoutTypes/templateHelpers.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"

const NPD = 1e-6

export function getSignOfPolygonAngles(polygon) {
  const vectors = polygon.map((p, i, l) => getNormalizedVectorFromPointToPoint(p, l[(i + 1) % l.length]))
  const normalVectors = vectors.map((v) => [-v[1], v[0]])
  const angleSigns = vectors.map((v, i, l) => Math.sign(getDotProduct(v, normalVectors[(i + 1) % l.length])))
  return angleSigns.map((_, i, l) => l[mod(i - 1, l.length)])
}

function intersectRayWithLine(shootingDirectionVec, shootingPoint, hitLine) {
  const [p2, p3] = hitLine
  const normalizedShootingVec = normalizeVector(shootingDirectionVec)
  const s0 = getDotProduct(getVectorFromPointToPoint(shootingPoint, p2), normalizedShootingVec)
  const s1 = getDotProduct(getVectorFromPointToPoint(shootingPoint, p3), normalizedShootingVec)

  const t0 = getCrossProduct(getVectorFromPointToPoint(shootingPoint, p2), normalizedShootingVec)
  const t1 = getCrossProduct(getVectorFromPointToPoint(shootingPoint, p3), normalizedShootingVec)

  if ((t0 >= 0 && t1 >= 0) || (t0 <= 0 && t1 <= 0)) {
    return null
  }
  if (s0 < 0 && s1 < 0) {
    return null
  }

  const s = (s1 * t0 - s0 * t1) / (t0 - t1)
  if (s < -NPD) {
    return null
  }
  return movePointAlongVector(shootingPoint, shootingDirectionVec, s)
}

export function rayRayIntersection(p1, p2, vec1, vec2) {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const det = vec2[0] * vec1[1] - vec2[1] * vec1[0]
  if (Math.abs(det) < NPD) {
    return null
  }

  const u = (dy * vec2[0] - dx * vec2[1]) / det
  const v = (dy * vec1[0] - dx * vec1[1]) / det

  if (u < 0 || v < 0) {
    return null
  }
  return [p1[0] + u * vec1[0], p1[1] + u * vec1[1]]
}

function getIndexOfNextEdgeToRemove(
  edgeLengths,
  angles,
  edgeLengthConvex,
  edgeLengthMixed,
  edgeLengthConcave,
  skipIndices,
  bufferWidth,
  bufferShortenings,
) {
  const n = edgeLengths.length
  let minFraction
  let fraction
  let edgeIndex
  for (let i = 0; i < n; i++) {
    if (skipIndices.includes(i)) continue
    const angle_0 = angles[i]
    const angle_1 = angles[mod(i + 1, n)]
    const bufferDist = bufferShortenings[i] + bufferShortenings[mod(i + 1, n)]
    if (angle_0 > 0 && angle_1 > 0) {
      if (edgeLengths[i] >= edgeLengthConvex + bufferDist) continue
      fraction = edgeLengths[i] / (edgeLengthConvex + bufferDist)
    } else if (angle_0 > 0 || angle_1 > 0) {
      if (edgeLengths[i] >= edgeLengthMixed + bufferDist) continue
      fraction = edgeLengths[i] / (edgeLengthMixed + bufferDist)
    } else {
      fraction = edgeLengths[i] / edgeLengthConcave
    }
    if (minFraction === undefined || fraction < minFraction) {
      minFraction = fraction
      edgeIndex = i
    }
  }
  return edgeIndex
}

function edgeLengthsAreValid(
  edgeLengths,
  angles,
  edgeLengthConvex,
  edgeLengthMixed,
  edgeLengthConcave,
  skipIndices,
  bufferWidth,
  bufferShortenings,
) {
  const n = edgeLengths.length
  for (let i = 0; i < n; i++) {
    if (skipIndices.includes(i)) continue
    const angle_0 = angles[i]
    const angle_1 = angles[mod(i + 1, n)]
    const bufferDist = bufferShortenings[i] + bufferShortenings[mod(i + 1, n)]
    if (angle_0 > 0 && angle_1 > 0) {
      if (edgeLengths[i] < edgeLengthConvex + bufferDist) return false
    } else if (angle_0 > 0 || angle_1 > 0) {
      if (edgeLengths[i] < edgeLengthMixed + bufferDist) return false
    } else {
      if (edgeLengths[i] < edgeLengthConcave) return false
    }
  }
  return true
}

function modSplice(array, index, deleteCount, insertItems) {
  if (index + deleteCount <= array.length) {
    array.splice(index, deleteCount, ...insertItems)
  } else {
    const deleteCountFromStart = index + deleteCount - array.length
    array.splice(index, deleteCount, ...insertItems)
    array.splice(0, deleteCountFromStart)
  }
}

export function getAngle(p0, p1, p2) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

export function getRayPolygonIntersection(startPoint, direction, polygon) {
  const normal = [-direction[1], direction[0]]
  const sValues = polygon.map((point) => getDotProduct(point, normal) - getDotProduct(startPoint, normal))
  let maxDist
  let crossPoint
  let crossEdgeIndex
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const s0 = sValues[i]
    const s1 = sValues[(i + 1) % n]
    if (s0 >= 0 || s1 < 0) continue
    const x = polygon[i][0] * (s1 / (s1 - s0)) + polygon[(i + 1) % n][0] * (s0 / (s0 - s1))
    const y = polygon[i][1] * (s1 / (s1 - s0)) + polygon[(i + 1) % n][1] * (s0 / (s0 - s1))
    const dist = getDotProduct([x, y], direction) - getDotProduct(startPoint, direction)
    if (dist > 0 && (!maxDist || dist < maxDist)) {
      maxDist = dist
      crossPoint = [x, y]
      crossEdgeIndex = i
    }
  }
  return [crossPoint, crossEdgeIndex]
}

export function getPolygonBetweenIndexes(polygon, startIndex, endIndex) {
  if (startIndex < endIndex) return polygon.slice(startIndex, endIndex + 1)
  return polygon.slice(startIndex).concat(polygon.slice(0, endIndex + 1))
}

export function removeFakePoints(polygon, threshold = 1e-5) {
  const edgeLengths = getEdgeLengthsInPolygon(polygon)
  let filteredPolygon = polygon.filter((_, i) => edgeLengths[i] > threshold)
  const angles = getAnglesInPolygon(filteredPolygon)
  filteredPolygon = filteredPolygon.filter((_, i) => Math.abs(angles[i]) > threshold)
  return filteredPolygon
}

function removeProtrusions(raw_polygon, maxDistance, maxIterations) {
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

      if (!crossPointLeft || !crossPointRight) {
        continue
        //   console.log("crossPointLeft", JSON.stringify(crossPointLeft));
        //   console.log("crossIndexLeft", JSON.stringify(crossIndexLeft));
        //   console.log("crossPointRight", JSON.stringify(crossPointRight));
        //   console.log("crossIndexRight", JSON.stringify(crossIndexRight));
        //   console.log("polygon", JSON.stringify(polygon));
        //   console.log("raw_polygon", JSON.stringify(raw_polygon));
        //   console.log("i", JSON.stringify(i));
        //   console.log("angle", JSON.stringify(angle));
        //   console.log("p1", JSON.stringify(p1));
        //   console.log("unitVecLeft", JSON.stringify(unitVecLeft));
        //   console.log("unitVecRight", JSON.stringify(unitVecRight));
      }
      const distLeftRay = pointPointDistance(p1, crossPointLeft)
      const distRightRay = pointPointDistance(p1, crossPointRight)

      if (Math.min(distLeftRay, distRightRay) > maxDistance && angleIndex === n - 1) return polygon
      if (Math.min(distLeftRay, distRightRay) > maxDistance) continue

      const crossPoint = distLeftRay < distRightRay ? crossPointLeft : crossPointRight
      const crossIndex = distLeftRay < distRightRay ? crossIndexLeft : crossIndexRight

      const splitOne = [
        ...getPolygonBetweenIndexes(polygon, mod(angleIndex + (distLeftRay >= distRightRay), n), crossIndex),
        crossPoint,
      ]
      const splitTwo = [
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        ...getPolygonBetweenIndexes(polygon, mod(crossIndex + 1, n), mod(angleIndex - (distLeftRay < distRightRay), n)),
        crossPoint,
      ]

      polygon = polygonArea(splitOne) > polygonArea(splitTwo) ? splitOne : splitTwo
      break
    }
  }
  return polygon
}

export function extendShortEdgesInPolygon(
  polygon,
  edgeLengthConvex,
  edgeLengthMixed,
  edgeLengthConcave,
  bufferWidth = 0,
) {
  const _polygon = deepCopy(polygon)
  let sideLengths = getEdgeLengthsInPolygon(_polygon)
  let angleSigns = getSignOfPolygonAngles(_polygon)
  let angles = getAnglesInPolygon(_polygon)
  let bufferShortenings = angles.map((angle) => (angle > 0 ? bufferWidth / Math.tan(0.5 * (Math.PI - angle)) : 0))

  let skipIndices = []
  let done = edgeLengthsAreValid(
    sideLengths,
    angles,
    edgeLengthConvex,
    edgeLengthMixed,
    edgeLengthConcave,
    skipIndices,
    bufferWidth,
    bufferShortenings,
  )
  let polygonChanged = false

  while (!done) {
    const n = _polygon.length
    if (n < 4) {
      return { polygon: [], polygonChanged }
    }
    const leftIndex = getIndexOfNextEdgeToRemove(
      sideLengths,
      angles,
      edgeLengthConvex,
      edgeLengthMixed,
      edgeLengthConcave,
      skipIndices,
      bufferWidth,
      bufferShortenings,
    )

    const rightIndex = mod(leftIndex + 1, n)

    const leftAngleSign = angleSigns[leftIndex]
    const rightAngleSign = angleSigns[rightIndex]

    const pLeft = _polygon[leftIndex]
    const pRight = _polygon[rightIndex]

    const pPrev = _polygon[mod(leftIndex - 1, n)]
    const pNext = _polygon[mod(leftIndex + 2, n)]

    if (leftAngleSign < 0 && rightAngleSign < 0) {
      const minEdgeLength =
        edgeLengthConvex + bufferShortenings[mod(leftIndex, n)] + bufferShortenings[mod(leftIndex + 1, n)]
      const curEdgeLength = pointPointDistance(pLeft, pRight)
      const leftDist = pointPointDistance(pLeft, pPrev)
      const rightDist = pointPointDistance(pRight, pNext)

      const leftVec = getNormalizedVectorFromPointToPoint(pLeft, pPrev)
      const rightVec = getNormalizedVectorFromPointToPoint(pRight, pNext)

      const edgeVec = getNormalizedVectorFromPointToPoint(pLeft, pRight)
      const normVec = [-edgeVec[1], edgeVec[0]]

      const cosLeftAngle = getDotProduct(leftVec, normVec)
      const cosRightAngle = getDotProduct(rightVec, normVec)

      const sinLeftAngle = -getDotProduct(edgeVec, leftVec)
      const sinRightAngle = getDotProduct(edgeVec, rightVec)

      let simplified = false
      const normalWidening = sinLeftAngle / cosRightAngle + sinRightAngle / cosRightAngle
      const normalDist = (minEdgeLength - curEdgeLength) / normalWidening

      const leftTriangleArea =
        0.5 * pointToLineSegmentDistance(pLeft, pRight, pPrev) * pointPointDistance(pRight, pPrev)
      const rightTriangleArea =
        0.5 * pointToLineSegmentDistance(pRight, pLeft, pNext) * pointPointDistance(pLeft, pNext)
      const trapezoidArea = 0.5 * normalDist * (minEdgeLength + curEdgeLength)

      if (normalWidening > 0 && trapezoidArea < leftTriangleArea && trapezoidArea < rightTriangleArea) {
        const moveDistLeft = normalDist / cosLeftAngle + NPD
        const moveDistRight = normalDist / cosRightAngle + NPD
        if (
          moveDistLeft <
            leftDist -
              (edgeLengthConvex + bufferShortenings[leftIndex] + bufferShortenings[mod(leftIndex - 1, n)] + NPD) &&
          moveDistRight <
            rightDist -
              (edgeLengthConvex +
                bufferShortenings[mod(leftIndex + 1, n)] +
                bufferShortenings[mod(leftIndex + 2, n)] +
                NPD)
        ) {
          _polygon[leftIndex] = movePointAlongVector(pLeft, leftVec, moveDistLeft)
          _polygon[rightIndex] = movePointAlongVector(pRight, rightVec, moveDistRight)
          simplified = true
        }
      }
      if (!simplified) {
        const removeIndex = leftTriangleArea < rightTriangleArea ? leftIndex : rightIndex
        _polygon.splice(removeIndex, 1)
      }
      skipIndices = []
      polygonChanged = true
    } else if (leftAngleSign > 0 && rightAngleSign > 0) {
      const vecFromLeft = getNormalizedVectorFromPointToPoint(pPrev, pLeft)
      const vecFromRight = getNormalizedVectorFromPointToPoint(pNext, pRight)
      const angle = Math.acos(getDotProduct(vecFromLeft, vecFromRight))

      if (angle > Math.PI / 4) {
        const newPoint = rayRayIntersection(pLeft, pRight, vecFromLeft, vecFromRight)
        if (newPoint) {
          modSplice(_polygon, leftIndex, 2, [newPoint])
          skipIndices = []
          polygonChanged = true
        } else {
          //catch if selfintersecting poly was produced
          console.log("selfintersecting polygon")
          return { polygon: [], polygonChanged }
        }
      } else {
        skipIndices.push(leftIndex)
      }
    } else if (leftAngleSign > rightAngleSign) {
      const shootVec = getNormalizedVectorFromPointToPoint(pPrev, pLeft)
      const intersectionPoint = intersectRayWithLine(shootVec, pLeft, [pRight, pNext])
      const tempPoly = deepCopy(_polygon)
      if (intersectionPoint) {
        modSplice(tempPoly, leftIndex, 2, [intersectionPoint])
      } else {
        tempPoly.splice(rightIndex, 1)
      }
      if (polygonSelfIntersection(tempPoly)) return { polygon: _polygon, polygonChanged }

      if (intersectionPoint) {
        modSplice(_polygon, leftIndex, 2, [intersectionPoint])
      } else {
        _polygon.splice(rightIndex, 1)
      }

      skipIndices = []
      polygonChanged = true
    } else {
      const shootVec = getNormalizedVectorFromPointToPoint(pNext, pRight)
      const intersectionPoint = intersectRayWithLine(shootVec, pRight, [pPrev, pLeft])
      if (intersectionPoint) {
        modSplice(_polygon, leftIndex, 2, [intersectionPoint])
      } else {
        _polygon.splice(leftIndex, 1)
      }
      skipIndices = []
      polygonChanged = true
    }

    if (_polygon.length < 3) return { polygon: _polygon, polygonChanged }
    angleSigns = getSignOfPolygonAngles(_polygon)
    sideLengths = getEdgeLengthsInPolygon(_polygon)
    angles = getAnglesInPolygon(_polygon)
    bufferShortenings = angles.map((angle) => (angle > 0 ? bufferWidth / Math.tan(0.5 * (Math.PI - angle)) : 0))

    done = edgeLengthsAreValid(
      sideLengths,
      angles,
      edgeLengthConvex,
      edgeLengthMixed,
      edgeLengthConcave,
      skipIndices,
      bufferWidth,
      bufferShortenings,
    )
  }

  return { polygon: _polygon, polygonChanged }
}

export function removeSharpAnglesInPolygon(polygon, minAngle, minEdgeLength) {
  const _polygon = [...polygon]
  let normalizedEdgeVectors = _polygon.map((p, i, l) => getNormalizedVectorFromPointToPoint(p, l[mod(i + 1, l.length)]))
  let angles = getAnglesBetweenVectors(normalizedEdgeVectors, true, true).map((a) => a + Math.PI)
  let curMinAngle = Math.min(...angles)
  let polygonChanged = false

  while (curMinAngle < minAngle) {
    const n = _polygon.length
    if (n < 3) {
      return { polygon: [], polygonChanged }
    }
    const i = argMin(angles)

    const prevPoint = _polygon[mod(i - 1, n)]
    const curPoint = _polygon[i]
    const nextPoint = _polygon[mod(i + 1, n)]

    const vec1 = normalizedEdgeVectors[mod(i - 1, n)]
    const vec2 = normalizedEdgeVectors[i]

    const dist1 = pointPointDistance(prevPoint, curPoint)
    const dist2 = pointPointDistance(curPoint, nextPoint)

    const distToNewEdge = (0.5 * minEdgeLength + 1e-6) / Math.sin(curMinAngle / 2)

    if (distToNewEdge < dist2 && distToNewEdge < dist1) {
      const newPoint1 = movePointAlongVector(curPoint, vec1, -distToNewEdge)
      const newPoint2 = movePointAlongVector(curPoint, vec2, distToNewEdge)
      modSplice(_polygon, i, 1, [newPoint1, newPoint2])
    } else if (distToNewEdge <= dist2) {
      const prevVec = normalizedEdgeVectors[mod(i - 2, n)]
      const newPoint = intersectRayWithLine(prevVec, prevPoint, [curPoint, nextPoint])
      if (newPoint) {
        modSplice(_polygon, mod(i - 1, n), 2, [newPoint])
      } else {
        _polygon.splice(i, 1)
      }
    } else if (distToNewEdge <= dist1) {
      const nextVec = normalizedEdgeVectors[mod(i + 1, n)]
      const newPoint = intersectRayWithLine(
        nextPoint,
        nextVec.map((v) => -v),
        [curPoint, prevPoint],
      )
      if (newPoint) {
        modSplice(_polygon, i, 2, [newPoint])
      } else {
        _polygon.splice(i, 1)
      }
    } else {
      _polygon.splice(i, 1)
    }

    polygonChanged = true

    normalizedEdgeVectors = _polygon.map((p, i, l) => getNormalizedVectorFromPointToPoint(p, l[mod(i + 1, l.length)]))
    angles = getAnglesBetweenVectors(normalizedEdgeVectors, true, true).map((a) => a + Math.PI)
    curMinAngle = Math.min(...angles)
  }

  return { polygon: _polygon, polygonChanged }
}

export function twoStepSimplification(
  inputPolygon,
  minEdgeLengths,
  minAngle,
  minProtrusionWidth = 0,
  buildingWidth = 12,
) {
  const [edgeLengthConvex, edgeLengthMixed, edgeLengthConcave] = [
    1.0 * minEdgeLengths,
    0.8 * minEdgeLengths,
    0.8 * minEdgeLengths,
  ]
  // const buildingWidth = 0;
  // const [edgeLengthConvex, edgeLengthMixed, edgeLengthConcave] = [
  //   2.55 * minEdgeLengths,
  //   1.55 * minEdgeLengths,
  //   1.55 * minEdgeLengths,
  // ];
  if (inputPolygon.length < 3) {
    return inputPolygon
  }

  const realPolygon = removeFakePoints(inputPolygon)
  let simplifiedPolygon = removeLastPointInPolygonIfEqualsFirst(realPolygon)

  try {
    if (minProtrusionWidth) {
      const maxIterations = 1000
      simplifiedPolygon = removeProtrusions(simplifiedPolygon, minProtrusionWidth, maxIterations)
      simplifiedPolygon = removeFakePoints(simplifiedPolygon)
    }
  } catch (err) {
    console.log("twoStepSimplification")
    console.log("inputPolygon", JSON.stringify(inputPolygon))
    console.log("minEdgeLengths", JSON.stringify(minEdgeLengths))
    console.log("minAngle", JSON.stringify(minAngle))
    console.log("minProtrusionWidth", JSON.stringify(minProtrusionWidth))
    console.log("buildingWidth", JSON.stringify(buildingWidth))
    throw err
  }

  let continueSimplifying = true
  while (continueSimplifying) {
    continueSimplifying = false

    const { polygon: simplifiedPolygon1, polygonChanged: polygonChangedStep1 } = extendShortEdgesInPolygon(
      simplifiedPolygon,
      edgeLengthConvex,
      edgeLengthMixed,
      edgeLengthConcave,
      buildingWidth,
    )
    continueSimplifying = (continueSimplifying || polygonChangedStep1) && simplifiedPolygon1.length > 0

    const { polygon: simplifiedPolygon2, polygonChanged: polygonChangedStep2 } = removeSharpAnglesInPolygon(
      simplifiedPolygon1,
      minAngle,
      edgeLengthConvex,
    )
    continueSimplifying = (continueSimplifying || polygonChangedStep2) && simplifiedPolygon2.length > 0

    simplifiedPolygon = simplifiedPolygon2
  }

  if (simplifiedPolygon.length < 3) {
    return []
  }
  simplifiedPolygon.push(simplifiedPolygon[0])
  return simplifiedPolygon
}
