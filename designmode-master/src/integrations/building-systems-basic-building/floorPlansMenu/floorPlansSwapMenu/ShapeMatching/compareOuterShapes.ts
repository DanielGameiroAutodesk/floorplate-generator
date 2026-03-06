import type { FootPrint } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import type { LineXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  filterZeroEdgesAndAngles,
  getAnglesInPolygon,
  getDistBetweenPoints,
  getEdgeLengthsInPolygon,
  getUnitVectorXY,
  transformPoint,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { PointXY, PolygonXY } from "src/lib/geometry/polygonXY"

export function getRotationAndTranslationToAlignPolygons(
  polyOne: PolygonXY,
  polyTwo: PolygonXY,
  matchingIndex: number,
): { rotation: PointXY; translation: PointXY } {
  const m = polyTwo.length

  const p0 = polyOne[0]
  const p1 = polyOne[1]

  const p2 = polyTwo[matchingIndex]
  const p3 = polyTwo[(matchingIndex + 1) % m]

  const unitVecOne = getUnitVectorXY(p0, p1)
  const unitVecTwo = getUnitVectorXY(p2, p3)

  const s = unitVecOne.x * unitVecTwo.x + unitVecOne.y * unitVecTwo.y
  const t = -unitVecOne.x * unitVecTwo.y + unitVecOne.y * unitVecTwo.x

  const rotation: PointXY = { x: s, y: t }

  const tx = p0.x - (p2.x * s - p2.y * t)
  const ty = p0.y - (p2.y * s + p2.x * t)
  const translation: PointXY = { x: tx, y: ty }

  return { rotation, translation }
}
function areAnglesEqual(angleOne: number, angleTwo: number, eps: number = 1e-4) {
  const a = (angleOne - angleTwo) / (2 * Math.PI)
  const b = Math.abs(a - Math.round(a)) * (2 * Math.PI)
  return b < eps
}

// TODO figure out a good threshold for when edges are same length
function areEdgeLengthsEqual(edgeLengthOne: number, edgeLengthTwo: number, eps: number = 5e-3) {
  return Math.abs(edgeLengthOne - edgeLengthTwo) < eps
}

export function getPolygonMatchIndexes(
  anglesOne: number[],
  anglesTwo: number[],
  edgeLengthsOne: number[],
  edgeLengthsTwo: number[],
): number[] {
  if (anglesOne.length !== anglesTwo.length) return []

  const matchIndexes = []
  const m = anglesOne.length
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const angleOne = anglesOne[j]
      const edgeLengthOne = edgeLengthsOne[j]

      const angleTwo = anglesTwo[(j + i) % m]
      const edgeLengthTwo = edgeLengthsTwo[(j + i) % m]

      if (!areAnglesEqual(angleOne, angleTwo)) break
      if (!areEdgeLengthsEqual(edgeLengthOne, edgeLengthTwo)) break

      if (j === m - 1) {
        matchIndexes.push(i)
      }
    }
  }
  return matchIndexes
}

export function rotateAndTranslatePolygon(polygon: PolygonXY, rotation: PointXY, translation: PointXY): PolygonXY {
  return polygon.map(({ x, y }) => {
    const xr = x * rotation.x - y * rotation.y
    const yr = y * rotation.x + x * rotation.y

    const xrt = xr + translation.x
    const yrt = yr + translation.y
    return { x: xrt, y: yrt }
  })
}

function rotateAndTranslateOuterShape(outerShape: FootPrint, rotation: PointXY, translation: PointXY): FootPrint {
  return outerShape.map((polyHole) => {
    const polygon = rotateAndTranslatePolygon(polyHole.polygon, rotation, translation)
    const holes = polyHole.holes.map((hole) => rotateAndTranslatePolygon(hole, rotation, translation))
    return { polygon, holes }
  })
}

export type Wall = [PointXY, PointXY]

export function getWallsFromPolygon(polygon: PolygonXY): Wall[] {
  const walls: Wall[] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % n]
    walls.push([p0, p1])
  }
  return walls
}
function getWallsFromOuterShape(outerShape: FootPrint) {
  const walls: Wall[] = []
  outerShape.forEach((polyHole) => {
    walls.push(...getWallsFromPolygon(polyHole.polygon))
    polyHole.holes.forEach((hole) => {
      walls.push(...getWallsFromPolygon(hole))
    })
  })
  return walls
}
export function compareOuterShapesWithTransform(
  outerShapeOne: FootPrint,
  _outerShapeTwo: FootPrint,
  rotation: PointXY,
  translate: PointXY,
) {
  const outerShapeTwo = rotateAndTranslateOuterShape(_outerShapeTwo, rotation, translate)
  const wallsOne = getWallsFromOuterShape(outerShapeOne)
  const wallsTwo = getWallsFromOuterShape(outerShapeTwo)

  const n = wallsOne.length
  const m = wallsTwo.length
  if (n !== m) return false

  wallsOne.sort((wallOne, wallsTwo) => {
    return wallOne[0].x - wallsTwo[0].x
  })

  wallsTwo.sort((wallOne, wallsTwo) => {
    return wallOne[0].x - wallsTwo[0].x
  })

  let lowerJ = 0
  for (let i = 0; i < n; i++) {
    const wallOne = wallsOne[i]
    let wallMatch = false
    for (let j = lowerJ; j < m; j++) {
      const wallTwo = wallsTwo[j]

      const [p0, p1] = wallOne
      const [p2, p3] = wallTwo

      if (p0.x > p2.x + 1) lowerJ = j
      if (p0.x < p2.x - 1) break

      const a = (p0.x - p2.x) ** 2 + (p0.y - p2.y) ** 2
      const b = (p1.x - p3.x) ** 2 + (p1.y - p3.y) ** 2
      if (a < 1e-4 && b < 1e-4) {
        wallMatch = true
        break
      }
    }
    if (!wallMatch) return false
  }

  return true
}

function doShapesMatch(
  outerShapeOne: FootPrint,
  outerShapeTwo: FootPrint,
  outerShapeOneData: { polygonAngles: number[]; polygonEdgeLengths: number[] }[],
  outerShapeTwoData: { polygonAngles: number[]; polygonEdgeLengths: number[] }[],
): { match: false } | { match: true; rotation: PointXY; translation: PointXY } {
  if (outerShapeOne.length !== outerShapeTwo.length) return { match: false }

  const n = outerShapeOne.length
  for (let i = 0; i < n; i++) {
    const { polygonAngles: polygonAnglesOne, polygonEdgeLengths: polygonEdgeLengthsOne } = outerShapeOneData[i]
    const { polygonAngles: polygonAnglesTwo, polygonEdgeLengths: polygonEdgeLengthsTwo } = outerShapeTwoData[0]

    const polygonMatchIndexes = getPolygonMatchIndexes(
      polygonAnglesOne,
      polygonAnglesTwo,
      polygonEdgeLengthsOne,
      polygonEdgeLengthsTwo,
    )
    for (let matchingIndex of polygonMatchIndexes) {
      const polyOne = outerShapeOne[i].polygon
      const polyTwo = outerShapeTwo[0].polygon
      const { rotation, translation } = getRotationAndTranslationToAlignPolygons(polyOne, polyTwo, matchingIndex)

      const outerShapesOverlapAfterTransform = compareOuterShapesWithTransform(
        outerShapeOne,
        outerShapeTwo,
        rotation,
        translation,
      )
      if (outerShapesOverlapAfterTransform) {
        return { match: true, rotation, translation }
      }
    }
  }
  return { match: false }
}

function realignOuterShape(outerShape: FootPrint): FootPrint {
  let longestEdge: LineXY | undefined
  let maxLength = 0
  outerShape.forEach((ot) => {
    const polygon = ot.polygon
    const n = polygon.length
    for (let i = 0; i < n; i++) {
      const p0 = polygon[i]
      const p1 = polygon[(i + 1) % n]
      const dist = getDistBetweenPoints(p0, p1)
      if (dist > maxLength) {
        maxLength = dist
        longestEdge = [p0, p1]
      }
    }
  })
  if (longestEdge === undefined) return outerShape

  const [startPoint, endPoint] = longestEdge
  const unitVector = getUnitVectorXY(startPoint, endPoint)

  return outerShape.map((ot) => {
    const polygon = ot.polygon.map((point) => {
      return transformPoint(point, startPoint, unitVector)
    })
    const holes = ot.holes.map((hole) =>
      hole.map((point) => {
        return transformPoint(point, startPoint, unitVector)
      }),
    )
    return { polygon, holes }
  })
}

export type FootPrintWithIds = { footPrint: FootPrint; ids: string[] }
export function getUniqueOuterShapes(__outerShapes: FootPrintWithIds[]) {
  const mappedShapes: Record<string, FootPrintWithIds> = {}
  __outerShapes.forEach((withIds) => {
    const key = JSON.stringify(withIds.footPrint)
    const mappedShape = mappedShapes[key]
    if (mappedShape === undefined) {
      mappedShapes[key] = withIds
    } else {
      mappedShape.ids.push(...withIds.ids)
    }
  })

  const outerShapesWithIds = Object.values(mappedShapes).map((withId) => {
    withId.footPrint = realignOuterShape(
      withId.footPrint.map((polyHole) => {
        const polygon = filterZeroEdgesAndAngles(polyHole.polygon)
        const holes = polyHole.holes.map((hole) => filterZeroEdgesAndAngles(hole))
        return { polygon, holes }
      }),
    )
    return withId
  })
  const outerShapes: FootPrint[] = outerShapesWithIds.map((mappedShape) => mappedShape.footPrint)

  const outerShapesData = outerShapes.map((outerShape) => {
    return outerShape.map((polyHole) => {
      const polygonAngles = getAnglesInPolygon(polyHole.polygon)
      const polygonEdgeLengths = getEdgeLengthsInPolygon(polyHole.polygon)

      return { polygonAngles, polygonEdgeLengths }
    })
  })

  const uniqueShapesIndexes: number[] = []

  const n = outerShapes.length
  for (let i = 0; i < n; i++) {
    const outerShapeOne = outerShapes[i]
    const outerShapeOneData = outerShapesData[i]
    const newShape = uniqueShapesIndexes.every((uniqueIndex) => {
      const outerShapeTwo = outerShapes[uniqueIndex]
      const outerShapeTwoData = outerShapesData[uniqueIndex]
      const shapesMatch = doShapesMatch(outerShapeOne, outerShapeTwo, outerShapeOneData, outerShapeTwoData)
      if (shapesMatch.match) {
        outerShapesWithIds[uniqueIndex].ids.push(...outerShapesWithIds[i].ids)
      }
      return !shapesMatch.match
    })
    if (newShape) uniqueShapesIndexes.push(i)
  }

  return uniqueShapesIndexes.map((index) => {
    return outerShapesWithIds[index]
  })
}

////
//

function sameShapePolygons(
  _polyOne: PolygonXY,
  _polyTwo: PolygonXY,
): { match: false } | { match: true; rotation: PointXY; translation: PointXY } {
  const polyOne = filterZeroEdgesAndAngles(_polyOne)
  const polyTwo = filterZeroEdgesAndAngles(_polyTwo)

  const anglesOne: number[] = getAnglesInPolygon(polyOne)
  const edgeLengthsOne: number[] = getEdgeLengthsInPolygon(polyOne)

  const anglesTwo: number[] = getAnglesInPolygon(polyTwo)
  const edgeLengthsTwo: number[] = getEdgeLengthsInPolygon(polyTwo)

  if (anglesOne.length !== anglesTwo.length) return { match: false }

  const m = anglesOne.length

  let matchingIndex
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      const angleOne = anglesOne[j]
      const edgeLengthOne = edgeLengthsOne[j]

      const angleTwo = anglesTwo[(j + i) % m]
      const edgeLengthTwo = edgeLengthsTwo[(j + i) % m]

      if (!areAnglesEqual(angleOne, angleTwo)) break
      if (!areEdgeLengthsEqual(edgeLengthOne, edgeLengthTwo)) break

      if (j === m - 1) {
        matchingIndex = i
      }
    }
  }
  if (matchingIndex === undefined) return { match: false }

  const { rotation, translation } = getRotationAndTranslationToAlignPolygons(polyOne, polyTwo, matchingIndex)

  return { match: true, rotation, translation }
}
export function doOuterShapesMatch(
  _outerShapeOne: FootPrint,
  _outerShapeTwo: FootPrint,
): { match: false } | { match: true; rotation: PointXY; translation: PointXY } {
  if (_outerShapeOne.length !== _outerShapeTwo.length) return { match: false }
  if (_outerShapeOne.length === 1 && _outerShapeOne[0].holes.length === 0 && _outerShapeTwo[0].holes.length === 0) {
    const polygonOne = _outerShapeOne[0].polygon
    const polygonTwo = _outerShapeTwo[0].polygon
    return sameShapePolygons(polygonOne, polygonTwo)
  }

  const [outerShapeOne, outerShapeTwo] = [_outerShapeOne, _outerShapeTwo].map((outerShape) => {
    return outerShape.map((polyHole) => {
      const polygon = filterZeroEdgesAndAngles(polyHole.polygon)
      const holes = polyHole.holes.map((hole) => filterZeroEdgesAndAngles(hole))
      return { polygon, holes }
    })
  })

  const [outerShapeOneData, outerShapeTwoData] = [outerShapeOne, outerShapeTwo].map((outerShape) => {
    return outerShape.map((polyHole) => {
      const polygonAngles = getAnglesInPolygon(polyHole.polygon)
      const polygonEdgeLengths = getEdgeLengthsInPolygon(polyHole.polygon)

      return { polygonAngles, polygonEdgeLengths }
    })
  })

  return doShapesMatch(outerShapeOne, outerShapeTwo, outerShapeOneData, outerShapeTwoData)
}
