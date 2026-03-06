import type { SpaceUnit } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import type { FootPrint } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import {
  filterZeroEdgesAndAngles,
  getAnglesInPolygon,
  getEdgeLengthsInPolygon,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { Wall } from "./compareOuterShapes"
import {
  compareOuterShapesWithTransform,
  getPolygonMatchIndexes,
  getRotationAndTranslationToAlignPolygons,
  getWallsFromPolygon,
  rotateAndTranslatePolygon,
} from "./compareOuterShapes"
import type { FloorPlanWithFootPrint } from "./realignShapes"
import type { PointXY } from "src/lib/geometry/polygonXY"

function getWallsFromUnits(units: SpaceUnit[]): Record<string, Wall[]> {
  const walls: Record<string, Wall[]> = {}
  units.forEach((unit) => {
    const type = unit.program || "undefined"
    if (walls[type] === undefined) walls[type] = []
    walls[type].push(...getWallsFromPolygon(unit.polygon))
    unit.holes.forEach((hole: any) => {
      walls[type].push(...getWallsFromPolygon(hole))
    })
  })
  return walls
}

function rotateAndTranslateUnits(units: SpaceUnit[], rotation: PointXY, translation: PointXY): SpaceUnit[] {
  return units.map((unit) => {
    const polygon = rotateAndTranslatePolygon(unit.polygon, rotation, translation)
    const holes = unit.holes.map((hole) => rotateAndTranslatePolygon(hole, rotation, translation))
    return { ...unit, geo: { polygon, holes } }
  })
}
function compareUnitsWithTransform(
  unitsOne: SpaceUnit[],
  _unitsTwo: SpaceUnit[],
  rotation: PointXY,
  translate: PointXY,
) {
  const unitsTwo = rotateAndTranslateUnits(_unitsTwo, rotation, translate)
  const wallsOne = getWallsFromUnits(unitsOne)
  const wallsTwo = getWallsFromUnits(unitsTwo)

  if (Object.keys(wallsOne).length !== Object.keys(wallsTwo).length) return false
  for (let type of Object.keys(wallsOne)) {
    if (wallsTwo[type] === undefined) return false
    if (wallsTwo[type].length !== wallsOne[type].length) return false
  }

  Object.keys(wallsOne).forEach((type) => {
    wallsOne[type].sort((wallOne, wallsTwo) => {
      return wallOne[0].x - wallsTwo[0].x
    })
  })
  Object.keys(wallsTwo).forEach((type) => {
    wallsTwo[type].sort((wallOne, wallsTwo) => {
      return wallOne[0].x - wallsTwo[0].x
    })
  })

  for (let type of Object.keys(wallsOne)) {
    const n = wallsOne[type].length
    let lowerJ = 0
    for (let i = 0; i < n; i++) {
      const wallOne = wallsOne[type][i]
      let wallMatch = false
      for (let j = lowerJ; j < n; j++) {
        const wallTwo = wallsTwo[type][j]

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
  }

  return true
}
function doTemplatesMatch(
  outerShapeOne: FootPrint,
  outerShapeTwo: FootPrint,
  outerShapeOneData: { polygonAngles: number[]; polygonEdgeLengths: number[] }[],
  outerShapeTwoData: { polygonAngles: number[]; polygonEdgeLengths: number[] }[],
  unitsOne: SpaceUnit[],
  unitsTwo: SpaceUnit[],
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
        const unitsMatch = compareUnitsWithTransform(unitsOne, unitsTwo, rotation, translation)
        if (unitsMatch) return { match: true, rotation, translation }
      }
    }
  }
  return { match: false }
}

export function getUniqueFloorPlanTemplates(_floorPlanTemplates: FloorPlanWithFootPrint[]): FloorPlanWithFootPrint[] {
  const outerShapes = _floorPlanTemplates.map((floorPlanTemplate) => {
    return floorPlanTemplate.footPrint.map((polyHole) => {
      const polygon = filterZeroEdgesAndAngles(polyHole.polygon)
      const holes = polyHole.holes.map((hole) => filterZeroEdgesAndAngles(hole))
      return { polygon, holes }
    })
  })

  const outerShapesData = outerShapes.map((outerShape) => {
    return outerShape.map((polyHole) => {
      const polygonAngles = getAnglesInPolygon(polyHole.polygon)
      const polygonEdgeLengths = getEdgeLengthsInPolygon(polyHole.polygon)

      return { polygonAngles, polygonEdgeLengths }
    })
  })

  const unitsByTemplate: SpaceUnit[][] = _floorPlanTemplates.map((floorPlanTemplate) => {
    return floorPlanTemplate.spaceUnits.map((unit) => {
      const polygon = filterZeroEdgesAndAngles(unit.polygon)
      const holes = unit.holes.map((hole) => filterZeroEdgesAndAngles(hole))
      return { ...unit, polygon, holes }
    })
  })

  const uniqueShapesIndexes: number[] = []

  const n = outerShapes.length
  for (let i = 0; i < n; i++) {
    const newShape = uniqueShapesIndexes.every((j) => {
      const outerShapeOne = outerShapes[i]
      const outerShapeOneData = outerShapesData[i]

      const outerShapeTwo = outerShapes[j]
      const outerShapeTwoData = outerShapesData[j]

      const unitsOne = unitsByTemplate[i]
      const unitsTwo = unitsByTemplate[j]

      const shapesMatch = doTemplatesMatch(
        outerShapeOne,
        outerShapeTwo,
        outerShapeOneData,
        outerShapeTwoData,
        unitsOne,
        unitsTwo,
      )
      return !shapesMatch.match
    })
    if (newShape) uniqueShapesIndexes.push(i)
  }

  return uniqueShapesIndexes.map((index) => {
    return _floorPlanTemplates[index]
  })
}
