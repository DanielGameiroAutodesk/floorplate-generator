import type { FootPrint } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import type { LineXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  filterZeroEdgesAndAngles,
  getDistBetweenPoints,
  getUnitVectorXY,
  transformPoint,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { doOuterShapesMatch, rotateAndTranslatePolygon } from "./compareOuterShapes"
import type { SpaceUnits } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import type { PointXY } from "src/lib/geometry/polygonXY"

export function getRealignFootPrintTransform(
  footPrint: FootPrint,
): { origin: PointXY; unitVector: PointXY } | undefined {
  let longestEdge: LineXY | undefined
  let maxLength = 0
  for (const polygonWithHoles of footPrint) {
    const polygon = filterZeroEdgesAndAngles(polygonWithHoles.polygon)
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
  }
  if (longestEdge === undefined) return undefined
  const unitVector = getUnitVectorXY(...longestEdge)
  const origin = longestEdge[0]
  return { origin, unitVector }
}
export function realignOuterShape(outerShape: FootPrint): FootPrint {
  let longestEdge: LineXY | undefined
  let maxLength = 0
  for (const polygonWithHoles of outerShape) {
    const polygon = filterZeroEdgesAndAngles(polygonWithHoles.polygon)
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
  }
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

///

export function transformFloorPlan(spaceUnits: SpaceUnits, rotation: PointXY, translation: PointXY): SpaceUnits {
  return spaceUnits.map((spaceUnit) => {
    const polygon = rotateAndTranslatePolygon(spaceUnit.polygon, rotation, translation)
    const holes = spaceUnit.holes.map((hole) => rotateAndTranslatePolygon(hole, rotation, translation))
    return { ...spaceUnit, polygon, holes }
  })
}

export type FloorPlanWithFootPrint = { spaceUnits: SpaceUnits; footPrint: FootPrint }
export function alignFloorPlanWithOuterShape(floorPlanWithFootPrint: FloorPlanWithFootPrint, outerShape: FootPrint) {
  const match = doOuterShapesMatch(outerShape, floorPlanWithFootPrint.footPrint)
  if (!match.match) return floorPlanWithFootPrint

  const spaceUnits = transformFloorPlan(floorPlanWithFootPrint.spaceUnits, match.rotation, match.translation)
  return { ...floorPlanWithFootPrint, spaceUnits }
}
