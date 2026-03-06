import {
  affineMultiply,
  createRotateTranslateAffine,
} from "src/integrations/building-systems-common/lib-generators/helpers/affineHelpers"
import { getIntersectionAreas } from "src/integrations/building-systems-common/lib-generators/helpers/intersectionArea"
import {
  angleBetweenVectors,
  cleanPolygon,
  determinant,
  getCCWPolygon,
  getVectorFromPointToPoint,
  movePointAlongVector,
  pointPointDistance,
  vectorLength,
} from "src/integrations/building-systems-common/lib-generators/helpers/geometry"
import { mod } from "src/integrations/building-systems-common/lib-generators/helpers/numpy"
import {
  bufferPolygon,
  bufferPolygonWithVaryingOffsets,
} from "src/integrations/building-systems-common/lib-generators/helpers/polygonBuffer"

const MIN_DIST_FROM_WALL = 0.3

export type ParkingParams = {
  laneWidth: number
  spotWidth: number
  spotLength: number
  spotAngle: number
  parkingRowsAngle: number
  columnWidth: number
  spotsPerColumn: number
  freeSides: number[]
  bufferFromWall: number
}

export type Point = [number, number]
export type Polygon = Point[]

export function drawParkingSpots(
  inputPolygon: Polygon,
  params: ParkingParams,
  entrances: any[] = [],
  blockingPolygons: Polygon[] = [],
): Polygon[] {
  const polygon =
    pointPointDistance(inputPolygon[0], inputPolygon[inputPolygon.length - 1]) > 1e-4
      ? [...inputPolygon]
      : [...inputPolygon.slice(1)]

  const bufferPolygons = bufferPolygon(polygon, params.bufferFromWall || 0).map((p) => cleanPolygon(p))
  const spots = bufferPolygons.flatMap((bufferedPoly) =>
    fillPolygonWithParkingSpots(
      bufferedPoly,
      params,
      entrances,
      blockingPolygons.map((poly) => cleanPolygon(poly)),
    ),
  )

  return spots.map((spot) => spot.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]))
}

function findInternalBlockedSegments(
  polygon: Polygon,
  spotLength: number,
  laneWidth: number,
  freeSides: number[] = [],
) {
  const numCorners = polygon.length
  const blockedSegments = []
  for (let i = 0; i < numCorners; i++) {
    for (let j = 0; j < numCorners; j++) {
      if (Math.abs(i - j) <= 1 || Math.abs(i - j) === numCorners - 1) continue

      const seg1 = [polygon[i], polygon[(i + 1) % numCorners]]
      const vec = getVectorFromPointToPoint(seg1[0], seg1[1])
      const L = vectorLength(vec)
      const affine = createRotateTranslateAffine(-Math.atan2(vec[1], vec[0]), seg1[0], [-seg1[0][0], -seg1[0][1]])
      const [point0_x, point0_y] = affineMultiply(polygon[j], affine)
      const [point1_x, point1_y] = affineMultiply(polygon[(j + 1) % numCorners], affine)

      const blockLines: [Point, Point, number][] = [
        [[point0_x, point0_y], [point1_x, point1_y], spotLength + laneWidth],
      ]
      const cutting_segments: [number, number, number][] = []
      if (L < pointPointDistance([point0_x, point0_y], [point1_x, point1_y]) && !freeSides.includes(j)) {
        const vec2 = getVectorFromPointToPoint([point0_x, point0_y], [point1_x, point1_y])
        const orthogonal = [-vec2[1], vec2[0]]
        const leftPoint: Point = [point1_x, point1_y]
        const leftMidPoint = movePointAlongVector([point1_x, point1_y], orthogonal, spotLength)
        const rightMidPoint = movePointAlongVector([point0_x, point0_y], orthogonal, spotLength)
        const rightPoint: Point = [point0_x, point0_y]
        blockLines.push([rightMidPoint, leftMidPoint, spotLength + laneWidth])
        blockLines.push([leftMidPoint, leftPoint, spotLength + laneWidth])
        blockLines.push([rightPoint, rightMidPoint, spotLength + laneWidth])

        const leftEndPoint = movePointAlongVector([point1_x, point1_y], orthogonal, spotLength + laneWidth)
        const rightEndPoint = movePointAlongVector([point0_x, point0_y], orthogonal, spotLength + laneWidth)
        blockLines.push([rightEndPoint, leftEndPoint, spotLength])
        blockLines.push([leftEndPoint, leftPoint, spotLength])
        blockLines.push([rightPoint, rightEndPoint, spotLength])

        const cutting_line = find_polygon_intersections_with_x_axis([
          leftPoint,
          rightPoint,
          rightEndPoint,
          leftEndPoint,
        ])
        if (cutting_line.length > 1) {
          const [x0, x1] = cutting_line
          cutting_segments.push([i, x0, x1])
        }
      }

      const segments = blockLines
        .map<[number, number, number] | null>(([[x0, y0], [x1, y1], threshold]) => {
          if (y0 < 0 && y1 < 0) return null
          if (x0 < 0 && x1 < 0) return null
          if (x0 > L && x1 > L) return null
          if (x0 < x1) return null // only keep segments facing us, i.e. point0 is right of point1
          if (y0 >= threshold && y1 >= threshold) return null

          let blockStart = Math.max(0, x1)
          let blockEnd = Math.min(L, x0)

          const slope = (y0 - y1) / (x0 - x1) // left to right
          if (slope !== 0) {
            const lowCross = x1 - y1 / slope
            const highCross = x1 + (threshold - y1) / slope
            blockStart = Math.max(Math.max(0, x1), Math.min(lowCross, highCross))
            blockEnd = Math.min(Math.min(L, x0), Math.max(lowCross, highCross))
          }
          if (blockStart < blockEnd && blockEnd > 0) return [i, blockStart, blockEnd]
          return null
        })
        .filter((seg) => seg != null)

      blockedSegments.push(...segments)
      blockedSegments.push(...cutting_segments)
    }
  }
  return blockedSegments
}

function findExternalBlockedSegments(
  polygon: Polygon,
  spotLength: number,
  laneWidth: number,
  blockingPolygons: Polygon[],
) {
  const blockedSegments: [number, number, number][] = []
  polygon.forEach((p0, i) => {
    const p1 = polygon[(i + 1) % polygon.length]
    const vec = getVectorFromPointToPoint(p0, p1)
    const L = vectorLength(vec)
    const affine = createRotateTranslateAffine(-Math.atan2(vec[1], vec[0]), p0, [-p0[0], -p0[1]])
    const transformedBlockingPolygons = blockingPolygons.map((poly) => poly.map((p) => affineMultiply(p, affine)))
    const blockLines = transformedBlockingPolygons
      .flatMap((poly) => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]))
      .map(([p0, p1]) => [p1, p0, spotLength + laneWidth] as const)

    const cutting_segments = transformedBlockingPolygons
      .map((poly) => find_polygon_intersections_with_x_axis(poly))
      .filter((line) => line.length > 1)
      .flatMap((cutting_points) => {
        const local_segments: [number, number, number][] = []
        for (let k = 0; k < cutting_points.length; k += 2) {
          const [x0, x1] = cutting_points.slice(k, k + 2)
          local_segments.push([i, x0, x1])
        }
        return local_segments
      })

    const segments = blockLines
      .map<[number, number, number] | null>(([[x0, y0], [x1, y1], threshold]) => {
        if (y0 < 0 && y1 < 0) return null
        if (x0 < 0 && x1 < 0) return null
        if (x0 > L && x1 > L) return null
        if (x0 < x1) return null // only keep segments facing us, i.e. point0 is right of point1
        if (y0 >= threshold && y1 >= threshold) return null

        let blockStart = Math.max(0, x1)
        let blockEnd = Math.min(L, x0)

        const slope = (y0 - y1) / (x0 - x1) // left to right
        if (slope !== 0) {
          const lowCross = x1 - y1 / slope
          const highCross = x1 + (threshold - y1) / slope
          blockStart = Math.max(Math.max(0, x1), Math.min(lowCross, highCross))
          blockEnd = Math.min(Math.min(L, x0), Math.max(lowCross, highCross))
        }
        if (blockStart < blockEnd && blockEnd > 0) return [i, blockStart, blockEnd]
        return null
      })
      .filter((seg) => seg != null)

    blockedSegments.push(...segments)
    blockedSegments.push(...cutting_segments)
  })
  return blockedSegments
}

function find_polygon_intersections_with_x_axis(polygon: Polygon, yValue: number = 0) {
  const overlap = []
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i]
    const [x1, y1] = polygon[(i + 1) % polygon.length]
    if ((y1 > yValue && y0 <= yValue) || (y1 <= yValue && y0 > yValue)) {
      const x = (x0 * (y1 - yValue)) / (y1 - y0) + (x1 * (y0 - yValue)) / (y0 - y1)
      overlap.push(x)
    }
  }
  overlap.sort((a, b) => a - b)
  return overlap
}

function getCornerSpot(
  point: Point,
  angle: number,
  laneWidth: number,
  spotWidth: number,
  shortVec: number[],
  prevVecLength: number,
  vecLength: number,
  spotLength: number,
  blockingPolygons: Polygon[],
) {
  const roomForCornerSpot =
    angle > Math.PI / 8.0 &&
    Math.cos(angle) * laneWidth > spotWidth &&
    laneWidth * (1 + 1 / Math.sin(angle)) < vectorLength(shortVec)
  if (!roomForCornerSpot) return null

  const orthogonal = prevVecLength > vecLength ? [-shortVec[1], shortVec[0]] : [shortVec[1], -shortVec[0]]
  const first = movePointAlongVector(point, shortVec, laneWidth / Math.sin(angle))
  const fourth = movePointAlongVector(first, shortVec, -spotLength)
  const parkingSpot = getCCWPolygon([
    first,
    movePointAlongVector(first, orthogonal, spotWidth),
    movePointAlongVector(fourth, orthogonal, spotWidth),
    fourth,
  ])
  const p0 = movePointAlongVector(point, shortVec, laneWidth / Math.sin(angle) + laneWidth)
  const p3 = movePointAlongVector(p0, shortVec, -spotLength - laneWidth)
  const parkingSpotWithBuffer = getCCWPolygon([
    p0,
    movePointAlongVector(p0, orthogonal, spotWidth),
    movePointAlongVector(p3, orthogonal, spotWidth),
    p3,
  ])

  if (getIntersectionAreas([parkingSpotWithBuffer, ...blockingPolygons])[0] > 0) return null

  return parkingSpot
}

function getSpotsExteriorCornerInfo(
  polygon: Polygon,
  spotLength: number,
  spotWidth: number,
  laneWidth: number,
  blockingPolygons: Polygon[],
  freeSides: number[] = [],
) {
  const numCorners = polygon.length
  const cornerSpots: Polygon[] = []
  const cornerInfo = polygon.map((point, i) => {
    const prevPoint = polygon[(i - 1 + numCorners) % numCorners]
    const nextPoint = polygon[(i + 1) % numCorners]
    const vec = getVectorFromPointToPoint(point, nextPoint)
    const prevVec = getVectorFromPointToPoint(point, prevPoint)
    const angle = angleBetweenVectors(prevVec, vec)

    if (determinant([-prevVec[0], -prevVec[1]], vec) < 0) return { before: 0.0, after: 0.0 }

    const symmetricDistance = spotLength / Math.tan(angle / 2.0)
    const minDistance = Math.max(0, 0.1 * spotLength * (1 - Math.sin(angle - Math.PI / 2.0) / Math.sin(Math.PI / 12.0)))
    if (angle > Math.PI / 2.0 - 1e-3)
      return {
        before: freeSides.includes(i) ? minDistance : symmetricDistance,
        after: freeSides.includes((i + numCorners - 1) % numCorners) ? minDistance : symmetricDistance,
      }

    const prevVecLength = vectorLength(prevVec)
    const vecLength = vectorLength(vec)
    const shortVec = prevVecLength < vecLength ? prevVec : vec
    const shortLength = Math.min(prevVecLength, vecLength)

    const cornerSpot =
      !(freeSides.includes(i) || freeSides.includes((i + numCorners - 1) % numCorners)) &&
      getCornerSpot(
        point,
        angle,
        laneWidth,
        spotWidth,
        shortVec,
        prevVecLength,
        vecLength,
        spotLength,
        blockingPolygons,
      )
    if (cornerSpot) cornerSpots.push(cornerSpot)

    const short = Math.max(
      Math.min((spotLength + laneWidth) / Math.tan(angle), shortLength * Math.cos(angle)),
      MIN_DIST_FROM_WALL,
    )
    const long = (spotLength + laneWidth) / Math.sin(angle) + spotLength / Math.tan(angle)

    const shortBefore =
      !freeSides.includes((i + numCorners - 1) % numCorners) && (prevVecLength > vecLength || freeSides.includes(i))
    return {
      before: shortBefore ? short : long,
      after: !shortBefore ? short : long,
    }
  })
  return { cornerInfo, cornerSpots }
}

function addParkingSpotsAlongExterior(
  polygon: Polygon,
  spotWidth: number,
  spotLength: number,
  laneWidth: number,
  spotsPerColumn: number,
  columnWidth: number,
  openings: any[],
  blockingPolygons: Polygon[],
  freeSides: number[] = [],
) {
  const numCorners = polygon.length
  const { cornerInfo, cornerSpots } = getSpotsExteriorCornerInfo(
    polygon,
    spotLength,
    spotWidth,
    laneWidth,
    blockingPolygons,
    freeSides,
  )
  const blockedSegments = findInternalBlockedSegments(polygon, spotLength, laneWidth, freeSides)
  if (blockingPolygons.length > 0) {
    const externallyBlockedSegments = findExternalBlockedSegments(polygon, spotLength, laneWidth, blockingPolygons)
    blockedSegments.push(...externallyBlockedSegments)
  }

  const parkingSpots = polygon.flatMap((point, i) => {
    if (freeSides.includes(i)) return []
    const nextPoint = polygon[(i + 1) % numCorners]
    const direction = getVectorFromPointToPoint(point, nextPoint)
    const segmentLength = vectorLength(direction)
    const validSegment =
      // @ts-expect-error: There seems to be an incorrect includes check here.
      !blockedSegments.includes(i) && segmentLength > cornerInfo[i].after + cornerInfo[(i + 1) % numCorners].before
    if (!validSegment) return []

    const startPoint = movePointAlongVector(point, direction, cornerInfo[i].after)
    const endPoint = movePointAlongVector(nextPoint, direction, -cornerInfo[(i + 1) % numCorners].before)

    const relevantOpenings = [...openings, ...blockedSegments]
      .filter((o) => o[0] === i)
      .map((o) => [o[1], o[2]])
      .sort((a, b) => a[0] - b[0])
    if (relevantOpenings.length > 0) {
      const intervals = []
      let start = pointPointDistance(point, startPoint)
      const end = pointPointDistance(point, endPoint)
      relevantOpenings.forEach(([blockStart, blockEnd]) => {
        if (Math.min(blockStart, end) - start > spotWidth) {
          intervals.push([
            movePointAlongVector(point, direction, start),
            movePointAlongVector(point, direction, Math.min(blockStart, end)),
          ])
        }
        start = Math.max(start, blockEnd)
      })
      if (end - start > spotWidth)
        intervals.push([movePointAlongVector(point, direction, start), movePointAlongVector(point, direction, end)])
      return intervals.flatMap(([s, e]) =>
        getSpotsOnLineSegment(s, e, spotWidth, spotLength, spotsPerColumn, columnWidth),
      )
    }
    return getSpotsOnLineSegment(startPoint, endPoint, spotWidth, spotLength, spotsPerColumn, columnWidth)
  })

  return [...parkingSpots, ...cornerSpots]
}

function addPoints(...points: Point[]): Point {
  let x = 0
  let y = 0
  points.forEach(([px, py]) => {
    x += px
    y += py
  })
  return [x, y]
}

function getAngledSpotsOnLineSegment(
  startX: number,
  endX: number,
  y: number,
  spotWidth: number,
  spotLength: number,
  spotsPerColumn: number,
  columnWidth: number,
  spotAngle: number,
): Polygon[] {
  const spots: Polygon[] = []
  let x = startX
  let spotsCount = 0
  const lengthVec: [number, number] = [-spotLength * Math.sin(spotAngle), spotLength * Math.cos(spotAngle)]
  const widthVec: [number, number] = [spotWidth * Math.cos(spotAngle), spotWidth * Math.sin(spotAngle)]
  if (spotAngle < 0) y -= spotWidth * Math.sin(spotAngle)
  while (x < endX) {
    const p0: Point = [x, y]
    const p1 = addPoints(p0, widthVec)
    const p2 = addPoints(p0, widthVec, lengthVec)
    const p3 = addPoints(p0, lengthVec)
    const spot = [p0, p1, p2, p3]
    spots.push(spot)
    spotsCount += 1
    // @ts-expect-error: A bit unsure if the below code is correct.
    x += (spotWidth + !(spotsCount % spotsPerColumn) * columnWidth) / Math.cos(spotAngle)
  }
  return spots
}

function getSpotsOnLineSegment(
  startPoint: Point,
  endPoint: Point,
  spotWidth: number,
  spotLength: number,
  spotsPerColumn: number,
  columnWidth: number,
) {
  const vec = getVectorFromPointToPoint(startPoint, endPoint)
  const orthogonal = [-vec[1], vec[0]]
  const groupWidth = spotsPerColumn * spotWidth + columnWidth
  const length = vectorLength(vec)
  const numGroups = Math.floor((length + columnWidth) / groupWidth)
  const numLeftOverSpots = Math.floor((length - numGroups * groupWidth) / spotWidth)
  const allSpots = Array(numGroups + 1)
    .fill(0)
    .flatMap((_, i) => {
      const groupSpots = []
      const spotsToPlace = i === numGroups ? numLeftOverSpots : spotsPerColumn
      for (let n = 0; n < spotsToPlace; n++) {
        const first = movePointAlongVector(startPoint, vec, i * groupWidth + n * spotWidth)
        const second = movePointAlongVector(first, vec, spotWidth)
        groupSpots.push([
          first,
          second,
          movePointAlongVector(second, orthogonal, spotLength),
          movePointAlongVector(first, orthogonal, spotLength),
        ])
      }
      return groupSpots
    })
  return allSpots
}

function findSegmentsOfBandCoveredByPolygon(yBottom: number, yTop: number, polygon: Polygon) {
  const n = polygon.length
  const segments = []
  for (let i = 0; i < n; i++) {
    const [x0, y0] = polygon[i]
    const [x1, y1] = polygon[(i + 1) % n]
    if (x0 >= x1) continue
    if (y0 <= yBottom && y1 <= yBottom) continue
    if (y0 >= yTop && y1 >= yTop) continue
    if (y0 > yBottom && y0 < yTop && y1 > yBottom && y1 < yTop) {
      segments.push([x0, x1])
      continue
    }
    const slope = (y1 - y0) / (x1 - x0)
    const xl = x0 + (yBottom - y0) / slope
    const xu = x0 + (yTop - y0) / slope
    const xEnd = Math.min(x1, Math.max(xl, xu))
    const xStart = Math.max(x0, Math.min(xl, xu))
    segments.push([xStart, xEnd])
  }
  const x_axis_crossings = find_polygon_intersections_with_x_axis(polygon, yBottom)
  for (let i = 0; i < x_axis_crossings.length; i += 2) {
    const xStart = x_axis_crossings[i]
    const xEnd = x_axis_crossings[i + 1]
    segments.push([xStart, xEnd])
  }

  return segments
}

function findSegmentsOfBandCoveredByPolygons(
  yBottom: number,
  yTop: number,
  polygons: Polygon[],
  minGapDist: number = 0,
) {
  const segments = polygons.flatMap((polygon) => findSegmentsOfBandCoveredByPolygon(yBottom, yTop, polygon))
  return trimSegments(segments, minGapDist)
}

function trimSegments(segments: number[][], minGapDist = 0) {
  if (segments.length === 0) {
    return []
  }
  segments.sort((a, b) => a[0] - b[0])
  const trimmedSegments = []
  let [xStart, xEnd] = segments[0]
  segments.forEach(([x0, x1]) => {
    if (x0 <= xEnd + minGapDist) {
      xEnd = Math.max(x1, xEnd)
    } else {
      trimmedSegments.push([xStart, xEnd])
      xStart = x0
      xEnd = x1
    }
  })
  trimmedSegments.push([xStart, xEnd])
  return trimmedSegments
}

function invertSegments(segments: number[][], minX: number, maxX: number) {
  const invertedSegments = []
  let xStart = minX
  segments
    .filter(([x0, x1]) => x1 > minX && x0 < maxX)
    .forEach(([x0, x1]) => {
      if (x0 > xStart) {
        invertedSegments.push([xStart, x0])
      }
      xStart = Math.max(xStart, x1)
    })
  if (xStart < maxX) {
    invertedSegments.push([xStart, maxX])
  }
  return invertedSegments
}

function unionOfTwoSetsOfSegments(segments_one: number[][], segments_two: number[][]) {
  const segments = [...segments_one, ...segments_two]
  return trimSegments(segments)
}

function intersectionOfBounds(...setOfBounds: number[][]) {
  const numberOfSets = setOfBounds.length
  const crossingPoints = setOfBounds.flatMap((bounds) => bounds.map((x, i) => [x, 1 - 2 * (i % 2)]))
  crossingPoints.sort((x, y) => x[0] - y[0])
  let counter = 0
  const intersection: number[] = []
  crossingPoints.forEach(([x, c]) => {
    if (counter === numberOfSets - 1 && c === 1) {
      intersection.push(x)
    }
    if (counter === numberOfSets && c === -1) {
      intersection.push(x)
    }
    counter += c
  })
  return intersection
}

function getAlignmentPoint(bufferedPolygon: Polygon, spotLength: number, columnWidth: number, doubleRowWidth: number) {
  const EPS = 1e-4
  const bottom = find_polygon_intersections_with_x_axis(bufferedPolygon, EPS)
  const top = find_polygon_intersections_with_x_axis(bufferedPolygon, doubleRowWidth)
  if (bottom.length > 0 && top.length > 0) {
    return Math.max(bottom[0], top[0]) + EPS
  } else if (bottom.length > 0) {
    return bottom[0] + EPS
  }
  return Math.min(...bufferedPolygon.map((point) => point[0])) + columnWidth
}

function intersectionShiftedOfBounds(shifts: number[], ...bounds: number[][]) {
  const shiftedBounds = bounds.map((bound, i) => bound.map((x) => x + shifts[i]))
  return intersectionOfBounds(...shiftedBounds)
}

function getBoundingBoxOfPolygon(polygon: Polygon) {
  const minX = polygon.reduce((minX, [x]) => (x < minX ? x : minX), Infinity)
  const maxX = polygon.reduce((maxX, [x]) => (x > maxX ? x : maxX), -Infinity)
  const minY = polygon.reduce((minY, [, y]) => (y < minY ? y : minY), Infinity)
  const maxY = polygon.reduce((maxY, [, y]) => (y > maxY ? y : maxY), -Infinity)
  return { minX, maxX, minY, maxY }
}

function boundingBoxOverlap(polygon: Polygon, minX: number, maxX: number, minY: number, maxY: number) {
  const boundingBox = getBoundingBoxOfPolygon(polygon)
  if (boundingBox.maxX <= minX) return false
  if (boundingBox.minX >= maxX) return false
  if (boundingBox.maxY <= minY) return false
  if (boundingBox.minY >= maxY) return false
  return true
}

function coordinateTransformPolygon(polygon: Polygon, origin: number[], sVec: number[], tVec: number[]): Polygon {
  polygon = polygon.map(([x, y]) => {
    return [x - origin[0], y - origin[1]]
  })
  const det = sVec[0] * tVec[1] - tVec[0] * sVec[1]
  const xVec = [tVec[1] / det, -tVec[0] / det]
  const yVec = [-sVec[1] / det, sVec[0] / det]
  return polygon.map(([x, y]) => {
    return [xVec[0] * x + xVec[1] * y, yVec[0] * x + yVec[1] * y]
  })
}

function cutLineToYBand(l0: number[], l1: number[], yMin: number, yMax: number) {
  const [x0, y0] = l0[0] < l1[0] ? l0 : l1
  const [x1, y1] = l0[0] < l1[0] ? l1 : l0
  if (y0 > yMin && y0 < yMax && y1 > yMin && y1 < yMax)
    return [
      [x0, y0],
      [x1, y1],
    ]
  if (y0 <= yMin && y1 <= yMin) return []
  if (y1 >= yMax && y1 >= yMax) return []
  if (x1 === x0) {
    return [
      [x0, Math.min(Math.max(y0, y1), yMax)],
      [x1, Math.max(Math.min(y0, y1), yMin)],
    ]
  }
  const slope = (y1 - y0) / (x1 - x0)

  const cutOneX = x0 + (yMin - y0) / slope
  const cutTwoX = x0 + (yMax - y0) / slope

  const minX = Math.max(x0, Math.min(cutOneX, cutTwoX))
  const maxX = Math.min(x1, Math.max(cutOneX, cutTwoX))

  const yAtMinX = y0 + (minX - x0) * slope
  const yAtMaxX = y0 + (maxX - x0) * slope
  return [
    [minX, yAtMinX],
    [maxX, yAtMaxX],
  ]
}

function findBlockedUpperOrLowerBounds(
  blockingPolygons: Polygon[],
  yMin: number,
  yMax: number,
  yMinStartX: number,
  yMinEndX: number,
  yMaxStartX: number,
  yMaxEndX: number,
) {
  const blockedSegments: number[][] = []
  blockingPolygons.forEach((polygon) => {
    const n = polygon.length
    for (let i = 0; i < n; i++) {
      const l0 = polygon[i]
      const l1 = polygon[(i + 1) % n]
      const cutLine = cutLineToYBand(l0, l1, yMin, yMax)
      if (cutLine.length === 0) continue
      const [[x0, y0], [x1, y1]] = cutLine

      const start0 = x0 + ((y0 - yMin) / (yMax - yMin)) * yMaxStartX + ((yMax - y0) / (yMax - yMin)) * yMinStartX
      const end0 = x0 + ((y0 - yMin) / (yMax - yMin)) * yMaxEndX + ((yMax - y0) / (yMax - yMin)) * yMinEndX
      const start1 = x1 + ((y1 - yMin) / (yMax - yMin)) * yMaxStartX + ((yMax - y1) / (yMax - yMin)) * yMinStartX
      const end1 = x1 + ((y1 - yMin) / (yMax - yMin)) * yMaxEndX + ((yMax - y1) / (yMax - yMin)) * yMinEndX
      const start = Math.min(start0, start1)
      const end = Math.max(end0, end1)
      blockedSegments.push([start, end])
    }
  })
  const minGapDist = 1e-3
  return trimSegments(blockedSegments, minGapDist)
}

function findBlockedParkingBounds(
  direction: "south" | "north",
  yBottom: number,
  yTop: number,
  laneWidth: number,
  blockingPolygons: Polygon[],
  minGapDist: number,
  minX: number,
  maxX: number,
  spotAngle: number,
  spotLength: number,
  spotWidth: number,
  angleDirection: string,
) {
  const spotDeltaX = spotWidth / Math.cos(spotAngle)
  let yMin = direction === "south" ? yBottom - laneWidth : yBottom
  let yMax = direction === "north" ? yTop + laneWidth : yTop

  if (spotAngle === 0) {
    const facingParkingBlockedSegments = findSegmentsOfBandCoveredByPolygons(yMin, yMax, blockingPolygons, minGapDist)
    const parkingBlockedBounds = invertSegments(facingParkingBlockedSegments, minX, maxX + spotDeltaX).flat()
    return intersectionShiftedOfBounds([0, -spotWidth], parkingBlockedBounds, parkingBlockedBounds)
  }
  blockingPolygons = blockingPolygons.filter((polygon) => boundingBoxOverlap(polygon, minX, maxX, yMin, yMax))
  if (blockingPolygons.length === 0) return [minX, maxX]

  const yBaseLine = angleDirection === "left" ? yBottom : yBottom + spotWidth * Math.sin(spotAngle)
  const unitLengthVec =
    angleDirection === "left" ? [-Math.sin(spotAngle), Math.cos(spotAngle)] : [Math.sin(spotAngle), Math.cos(spotAngle)]
  blockingPolygons = blockingPolygons.map((polygon) => {
    return coordinateTransformPolygon(polygon, [0, yBaseLine], [1, 0], unitLengthVec)
  })
  const cornerDeltaY = (spotWidth * Math.sin(spotAngle)) / Math.cos(spotAngle)
  yMin = 0
  yMax = spotLength
  if (direction === "south") yMin -= laneWidth
  else yMax += laneWidth
  if (angleDirection === "left") yMin += cornerDeltaY
  else yMax -= cornerDeltaY

  const facingParkingBlockedSegments = findSegmentsOfBandCoveredByPolygons(yMin, yMax, blockingPolygons, minGapDist)
  const parkingBlockedBounds = invertSegments(facingParkingBlockedSegments, minX, maxX + spotDeltaX).flat()

  const lowerYMinX = angleDirection === "left" ? 0 : -spotDeltaX
  const upperYMaxX = angleDirection === "left" ? -spotDeltaX : 0

  const lowerBlockedSegments = findBlockedUpperOrLowerBounds(
    blockingPolygons,
    yMin - cornerDeltaY,
    yMin,
    lowerYMinX,
    lowerYMinX,
    -spotDeltaX,
    0,
  )
  const lowerBlockedBounds = invertSegments(lowerBlockedSegments, minX, maxX).flat()
  const upperBlockedSegments = findBlockedUpperOrLowerBounds(
    blockingPolygons,
    yMax,
    yMax + cornerDeltaY,
    -spotDeltaX,
    0,
    upperYMaxX,
    upperYMaxX,
  )
  const upperBlockedBounds = invertSegments(upperBlockedSegments, minX, maxX).flat()

  return intersectionShiftedOfBounds(
    [0, -spotDeltaX, 0, 0],
    parkingBlockedBounds,
    parkingBlockedBounds,
    lowerBlockedBounds,
    upperBlockedBounds,
  )
}

function getYStartForParkingInteriorRows(
  minY: number,
  gapBetweenParkingRows: number,
  doubleRowWidth: number,
  singleRowWidth: number,
  startWithSingleRow: boolean,
) {
  let yStart = 1e-2
  if (startWithSingleRow) yStart -= doubleRowWidth - singleRowWidth
  while (yStart > minY + gapBetweenParkingRows + 0.5 * doubleRowWidth) {
    yStart -= gapBetweenParkingRows + doubleRowWidth
  }
  return yStart
}

function fillParkingInterior(
  laneWidth: number,
  spotLength: number,
  bufferedPolygon: Polygon,
  spotWidth: number,
  spotsPerColumn: number,
  columnWidth: number,
  spotAngle: number,
  transformedBlockingPolygons: Polygon[],
  startWithSingleRow: boolean,
): Polygon[] {
  const minY = Math.min(...bufferedPolygon.map((point) => point[1]))
  const maxY = Math.max(...bufferedPolygon.map((point) => point[1]))
  const minX = Math.min(...bufferedPolygon.map((point) => point[0]))
  const maxX = Math.max(...bufferedPolygon.map((point) => point[0]))
  const minGapDist = spotWidth
  const parkingSpots: Polygon[] = []
  const doubleRowWidth = 2 * spotLength * Math.cos(spotAngle) + spotWidth * Math.sin(spotAngle)
  const singleRowWidth = spotLength * Math.cos(spotAngle) + spotWidth * Math.sin(spotAngle)
  const alignmentPoint = getAlignmentPoint(bufferedPolygon, spotLength, columnWidth, doubleRowWidth) //+ 1e-3;
  const gapBetweenParkingRows = Math.max(laneWidth * Math.cos(spotAngle), spotWidth)
  const yStart = getYStartForParkingInteriorRows(
    minY,
    gapBetweenParkingRows,
    doubleRowWidth,
    singleRowWidth,
    startWithSingleRow,
  )
  const numDoubleRows = Math.floor((maxY - yStart + gapBetweenParkingRows) / (gapBetweenParkingRows + doubleRowWidth))
  const addSingleRow = maxY - yStart - numDoubleRows * (gapBetweenParkingRows + doubleRowWidth) > singleRowWidth
  for (let i = 0; i < numDoubleRows; i++) {
    const yBottom = yStart + i * gapBetweenParkingRows + i * doubleRowWidth
    const yMidBottom = yBottom + spotWidth * Math.sin(spotAngle)
    const yMidFirst = yBottom + spotLength * Math.cos(spotAngle) + spotWidth * Math.sin(spotAngle)
    const yMidSecond = yBottom + spotLength * Math.cos(spotAngle)
    const yMidTop = yBottom + 2 * spotLength * Math.cos(spotAngle)
    const yTop = yBottom + 2 * spotLength * Math.cos(spotAngle) + spotWidth * Math.sin(spotAngle)

    const bottomBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yBottom)
    const midBottomBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yMidBottom)
    const midBoundsFirst = find_polygon_intersections_with_x_axis(bufferedPolygon, yMidFirst)
    const midBoundsSecond = find_polygon_intersections_with_x_axis(bufferedPolygon, yMidSecond)
    const midTopBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yMidTop)
    const topBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yTop)

    const angleDirection = i % 2 === 0 ? "left" : "right"
    const southFacingParkingBounds = findBlockedParkingBounds(
      "south",
      yBottom,
      yMidFirst,
      laneWidth,
      transformedBlockingPolygons,
      minGapDist,
      minX,
      maxX,
      spotAngle,
      spotLength,
      spotWidth,
      angleDirection,
    )
    const northFacingParkingBounds = findBlockedParkingBounds(
      "north",
      yMidSecond,
      yTop,
      laneWidth,
      transformedBlockingPolygons,
      minGapDist,
      minX,
      maxX,
      spotAngle,
      spotLength,
      spotWidth,
      angleDirection,
    )

    let shifts
    if (i % 2 === 0)
      shifts = [
        0,
        -spotWidth * Math.cos(spotAngle),
        spotLength * Math.sin(spotAngle),
        -spotWidth * Math.cos(spotAngle) + spotLength * Math.sin(spotAngle),
        0,
      ]
    else
      shifts = [
        -spotWidth * Math.cos(spotAngle),
        0,
        -spotWidth * Math.cos(spotAngle) - spotLength * Math.sin(spotAngle),
        -spotLength * Math.sin(spotAngle),
        0,
      ]
    const combinedSouthFacingBounds = intersectionShiftedOfBounds(
      shifts,
      bottomBounds,
      midBottomBounds,
      midBoundsSecond,
      midBoundsFirst,
      southFacingParkingBounds,
    )
    const combinedNorthFacingBounds = intersectionShiftedOfBounds(
      shifts,
      midBoundsSecond,
      midBoundsFirst,
      midTopBounds,
      topBounds,
      northFacingParkingBounds,
    )

    const southAlignmentPoint = alignmentPoint - 2 * spotLength * Math.sin(spotAngle) * (i % 2)
    const northAlignmentPoint = southAlignmentPoint - Math.sin(spotAngle) * spotLength * (-1) ** i
    parkingSpots.push(
      ...getSpotsFromBounds(
        combinedSouthFacingBounds,
        yBottom,
        southAlignmentPoint,
        spotWidth,
        spotLength,
        spotsPerColumn,
        columnWidth,
        spotAngle * (-1) ** i,
      ),
    )
    parkingSpots.push(
      ...getSpotsFromBounds(
        combinedNorthFacingBounds,
        yMidSecond,
        northAlignmentPoint,
        spotWidth,
        spotLength,
        spotsPerColumn,
        columnWidth,
        spotAngle * (-1) ** i,
      ),
    )
  }
  if (addSingleRow) {
    const yBottom = yStart + numDoubleRows * gapBetweenParkingRows + numDoubleRows * doubleRowWidth
    const yMidBottom = yBottom + spotWidth * Math.sin(spotAngle)
    const yMidTop = yBottom + spotLength * Math.cos(spotAngle)
    const yTop = yBottom + singleRowWidth

    const bottomBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yBottom)
    const midBottomBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yMidBottom)
    const midTopBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yMidTop)
    const topBounds = find_polygon_intersections_with_x_axis(bufferedPolygon, yTop)

    const angleDirection = numDoubleRows % 2 === 0 ? "left" : "right"
    const southFacingParkingBoundsNew = findBlockedParkingBounds(
      "south",
      yBottom,
      yTop,
      laneWidth,
      transformedBlockingPolygons,
      minGapDist,
      minX,
      maxX,
      spotAngle,
      spotLength,
      spotWidth,
      angleDirection,
    )
    const northFacingParkingBoundsNew = findBlockedParkingBounds(
      "north",
      yBottom,
      yTop,
      laneWidth,
      transformedBlockingPolygons,
      minGapDist,
      minX,
      maxX,
      spotAngle,
      spotLength,
      spotWidth,
      angleDirection,
    )
    let southFacingNoneBlockedSegments = []
    for (let i = 0; i < southFacingParkingBoundsNew.length; i += 2)
      southFacingNoneBlockedSegments.push(southFacingParkingBoundsNew.slice(i, i + 2))
    let northFacingNoneBlockedSegments = []
    for (let i = 0; i < northFacingParkingBoundsNew.length; i += 2)
      northFacingNoneBlockedSegments.push(northFacingParkingBoundsNew.slice(i, i + 2))
    const northSouthParkingBounds = unionOfTwoSetsOfSegments(
      southFacingNoneBlockedSegments,
      northFacingNoneBlockedSegments,
    ).flat()

    const southAlignmentPoint = alignmentPoint - 2 * spotLength * Math.sin(spotAngle) * (numDoubleRows % 2)
    let shifts
    if (numDoubleRows % 2 === 0)
      shifts = [
        0,
        -spotWidth * Math.cos(spotAngle),
        spotLength * Math.sin(spotAngle),
        -spotWidth * Math.cos(spotAngle) + spotLength * Math.sin(spotAngle),
        0,
      ]
    else
      shifts = [
        -spotWidth * Math.cos(spotAngle),
        0,
        -spotWidth * Math.cos(spotAngle) - spotLength * Math.sin(spotAngle),
        -spotLength * Math.sin(spotAngle),
        0,
      ]
    const combinedBounds = intersectionShiftedOfBounds(
      shifts,
      bottomBounds,
      midBottomBounds,
      midTopBounds,
      topBounds,
      northSouthParkingBounds,
    )
    parkingSpots.push(
      ...getSpotsFromBounds(
        combinedBounds,
        yBottom,
        southAlignmentPoint,
        spotWidth,
        spotLength,
        spotsPerColumn,
        columnWidth,
        spotAngle * (-1) ** numDoubleRows,
      ),
    )
  }
  return parkingSpots
}

function getSpotsFromBounds(
  intersections: number[],
  yBottom: number,
  alignmentPoint: number,
  spotWidth: number,
  spotLength: number,
  spotsPerColumn: number,
  columnWidth: number,
  spotAngle: number,
): Polygon[] {
  const eps = 1e-4
  const groupWidth = (spotsPerColumn * spotWidth + columnWidth) / Math.cos(spotAngle)
  let spots: Polygon[] = []
  for (let i = 0; i < intersections.length; i += 2) {
    const xStart = intersections[i]
    const xEnd = intersections[i + 1]
    const groupInteger = Math.ceil((xStart - alignmentPoint) / groupWidth)
    const alignedStart = alignmentPoint + groupInteger * groupWidth
    const precedingSpots = Math.floor(
      (alignedStart - xStart - columnWidth / Math.cos(spotAngle)) / (spotWidth / Math.cos(spotAngle)),
    )
    if (xEnd - alignedStart > eps) {
      spots.push(
        ...getAngledSpotsOnLineSegment(
          alignedStart,
          xEnd,
          yBottom,
          spotWidth,
          spotLength,
          spotsPerColumn,
          columnWidth,
          spotAngle,
        ),
      )
    }
    if (precedingSpots > 0) {
      const leftExtension = (precedingSpots * spotWidth + columnWidth) / Math.cos(spotAngle)
      const endPrecedingX = Math.min(alignedStart - columnWidth / Math.cos(spotAngle) - 1e-3, xEnd)
      spots.push(
        ...getAngledSpotsOnLineSegment(
          alignedStart - leftExtension,
          endPrecedingX,
          yBottom,
          spotWidth,
          spotLength,
          spotsPerColumn,
          columnWidth,
          spotAngle,
        ),
      )
    }
  }
  return spots
}

export function getIndexOfLongestEdge(polygon: Polygon) {
  const n = polygon.length
  let maxLength = 0
  let maxLengthIndex = 0
  for (let i = 0; i < n; i++) {
    const [x0, y0] = polygon[i]
    const [x1, y1] = polygon[(i + 1) % n]
    const length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
    if (length > maxLength) {
      maxLength = length
      maxLengthIndex = i
    }
  }
  return maxLengthIndex
}

function getAnglesOfEdges(polygon: Polygon) {
  const n = polygon.length
  const angles = []
  for (let i = 0; i < n; i++) {
    const [x0, y0] = polygon[i]
    const [x1, y1] = polygon[mod(i + 1, n)]
    const angle = Math.atan2(y1 - y0, x1 - x0)
    angles.push(angle)
  }
  return angles
}

function getIndexOfClosestValue(list: number[], value: number) {
  let minDist = Infinity
  let minDistIndex = 0
  for (let i = 0; i < list.length; i++) {
    const dist = Math.abs(list[i] - value)
    if (dist < minDist) {
      minDist = dist
      minDistIndex = i
    }
  }
  return minDistIndex
}

function getInnerParkingCoordinateSystem(polygon: Polygon, rowsAngle: number) {
  const n = polygon.length
  const angles = getAnglesOfEdges(polygon)
  const baseEdgeIndex = rowsAngle !== null ? getIndexOfClosestValue(angles, rowsAngle) : getIndexOfLongestEdge(polygon)

  const [x0, y0] = polygon[mod(baseEdgeIndex, n)]
  const [x1, y1] = polygon[mod(baseEdgeIndex + 1, n)]
  const origin = [x0, y0]
  const angle = Math.atan2(y1 - y0, x1 - x0)

  const worldCoordsToSimpleCoords = createRotateTranslateAffine(-angle, origin, [-origin[0], -origin[1]])
  const simpleCoordsToWorldCoords = createRotateTranslateAffine(angle, [0, 0], origin)
  return { worldCoordsToSimpleCoords, simpleCoordsToWorldCoords }
}

function getBlockingPolygonsAlongEdges(polygon: Polygon, freeSides: number[], spotLength: number) {
  return polygon.map((point, i) => {
    const numFreeSides = freeSides.filter((freeI) => freeI === i).length
    let blockingWidth = 1e-4
    if (numFreeSides === 0) blockingWidth = spotLength
    const nextPoint = polygon[(i + 1) % polygon.length]
    const vec = getVectorFromPointToPoint(point, nextPoint)
    const normal = [-vec[1], vec[0]]
    return [
      point,
      nextPoint,
      movePointAlongVector(nextPoint, normal, blockingWidth),
      movePointAlongVector(point, normal, blockingWidth),
    ]
  })
}

export function fillPolygonWithParkingSpots(
  polygon: Polygon,
  params: ParkingParams,
  entrances: any[],
  blockingPolygons: Polygon[],
) {
  const {
    laneWidth,
    spotWidth,
    spotLength,
    columnWidth,
    spotsPerColumn,
    spotAngle: spotAngleDegrees,
    parkingRowsAngle: rowsAngleEdgeIndex,
  } = params
  const rowsAngle =
    rowsAngleEdgeIndex === null ? rowsAngleEdgeIndex : getAnglesOfEdges(polygon)[rowsAngleEdgeIndex % polygon.length]
  const spotAngle = (spotAngleDegrees / 180) * Math.PI
  const freeSides = params.freeSides || []
  const parkingSpots = addParkingSpotsAlongExterior(
    polygon,
    spotWidth,
    spotLength,
    laneWidth,
    spotsPerColumn,
    columnWidth,
    entrances,
    blockingPolygons,
    freeSides,
  )
  const numFreeSides = polygon.map((_, i) => freeSides.filter((freeI) => freeI === i).length)
  const startWithSingleRow: boolean =
    rowsAngleEdgeIndex !== null && numFreeSides[mod(rowsAngleEdgeIndex, numFreeSides.length)] === 2
  const bufferedPolygons = bufferPolygonWithVaryingOffsets(
    polygon,
    polygon.map((_, i) => {
      switch (numFreeSides[i]) {
        case 0:
          return laneWidth + spotLength
        case 1:
          return laneWidth
        default:
          return MIN_DIST_FROM_WALL
      }
    }),
    100,
  )
  const blockingPolygonsAlongEdges = getBlockingPolygonsAlongEdges(polygon, freeSides, spotLength)
  bufferedPolygons.forEach((bufferedPolygon) => {
    const { worldCoordsToSimpleCoords, simpleCoordsToWorldCoords } = getInnerParkingCoordinateSystem(
      bufferedPolygon,
      rowsAngle,
    )
    const transformedPolygon = bufferedPolygon.map((point) => affineMultiply(point, worldCoordsToSimpleCoords))
    const transformedBlockingPolygons = [...blockingPolygons, ...blockingPolygonsAlongEdges].map((poly) =>
      poly.map((p) => affineMultiply(p, worldCoordsToSimpleCoords)),
    )
    const interiorParkingSpots = fillParkingInterior(
      laneWidth,
      spotLength,
      transformedPolygon,
      spotWidth,
      spotsPerColumn,
      columnWidth,
      spotAngle,
      transformedBlockingPolygons,
      startWithSingleRow,
    ).map((poly) => poly.map((point) => affineMultiply(point, simpleCoordsToWorldCoords)))
    parkingSpots.push(...interiorParkingSpots)
    // parkingSpots.push(bufferedPolygon); // nice for debugging
  })

  return parkingSpots
}
