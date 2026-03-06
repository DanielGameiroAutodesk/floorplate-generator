import type { Polygon, PolygonWithHoles } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { areaOfUnionRespectWinding } from "./intersectionArea"

function getUniquePoints(allPointsValues: [number, number][]) {
  const uniquePointHashes = new Set<string>()
  for (const point of allPointsValues) {
    uniquePointHashes.add(point.join(":"))
  }
  return Array.from(uniquePointHashes).map((s) => s.split(":").map(parseFloat))
}
function pointsOnLine(p0: number[], p1: number[], all_points: number[][], snapDistance = 0.05) {
  function _dot(v1: number[], v2: number[]) {
    return v1[0] * v2[0] + v1[1] * v2[1]
  }

  const xmin = Math.min(p0[0], p1[0]) - snapDistance,
    xmax = Math.max(p0[0], p1[0]) + snapDistance,
    ymin = Math.min(p0[1], p1[1]) - snapDistance,
    ymax = Math.max(p0[1], p1[1]) + snapDistance

  const s_vec = [p1[0] - p0[0], p1[1] - p0[1]],
    t_vec = [s_vec[1], -s_vec[0]]
  const t_base = _dot(t_vec, p0),
    s_min = _dot(s_vec, p0),
    s_max = _dot(s_vec, p1),
    t_length = Math.pow(Math.pow(t_vec[0], 2) + Math.pow(t_vec[1], 2), 0.5),
    t_max = snapDistance * t_length

  const sorted_points_on_line: number[][] = []
  all_points.forEach((point) => {
    if (xmin <= point[0] && point[0] <= xmax && ymin <= point[1] && point[1] <= ymax) {
      const s_val = _dot(point, s_vec),
        t_val = _dot(point, t_vec) - t_base
      if (Math.abs(t_val) < t_max && s_min < s_val && s_val < s_max) {
        let insertIndex = 0
        for (let i = 0; i < sorted_points_on_line.length; i++) {
          if (s_val > _dot(sorted_points_on_line[i], s_vec)) insertIndex++
          else break
        }
        sorted_points_on_line.splice(insertIndex, 0, point)
      }
    }
  })

  return sorted_points_on_line
}

function addPointsOnLines(geometry: PolygonWithHoles, points: number[][], snapDistance: number): PolygonWithHoles {
  function addToPoly(poly: number[][]) {
    const newPoly: number[][] = []
    poly.forEach((p0, i, l) => {
      newPoly.push(p0)
      const p1 = l[(i + 1) % l.length]
      const fill = pointsOnLine(p0, p1, points, snapDistance)
      for (const p of fill) {
        newPoly.push(p)
      }
    })
    return newPoly as [number, number][]
  }

  return {
    polygon: addToPoly(geometry.polygon),
    holes: geometry.holes.map((hole) => addToPoly(hole)),
  }
}

export function validateRelationsBetweenHolesAndExterior(geo: PolygonWithHoles) {
  function polygonArea(poly: Polygon) {
    let area = 0
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i]
      const p2 = poly[(i + 1) % poly.length]
      area += p1[0] * p2[1] - p1[1] * p2[0]
    }
    return 0.5 * Math.abs(area)
  }

  if (geo.holes.length === 0) return true
  const exteriorArea = polygonArea(geo.polygon)
  const holesArea = geo.holes.reduce((acc, hole) => acc + polygonArea(hole), 0)
  const allRings = [geo.polygon, ...geo.holes]
  const areaOutsideHoles = areaOfUnionRespectWinding(allRings)

  if (exteriorArea - holesArea - areaOutsideHoles > 0.01) {
    console.warn("wtf?", exteriorArea, holesArea, areaOutsideHoles)
    return false
  }
  if (exteriorArea - holesArea - areaOutsideHoles < -0.01) {
    console.warn("holes outside of exterior or overlapping holes", exteriorArea, holesArea, areaOutsideHoles)
    return false
  }

  const uniquePoints = getUniquePoints(allRings.flat())
  const withAddedPointsOnLines = addPointsOnLines(geo, uniquePoints, 0.0001)
  if (
    geo.polygon.length !== withAddedPointsOnLines.polygon.length ||
    withAddedPointsOnLines.holes.some((hole, i) => hole.length !== geo.holes[i].length)
  ) {
    console.warn("some points on lines")
    return false
  }

  const exteriorPoints = new Set<string>(geo.polygon.map((point) => point[0] + ":" + point[1]))
  const holePointOwnership: Record<string, number[]> = {}
  for (const [i, hole] of geo.holes.entries()) {
    for (const point of hole) {
      const pointHash = point[0] + ":" + point[1]
      if (exteriorPoints.has(pointHash)) {
        console.warn("shared point between exterior and hole")
        return false
      }
      if (holePointOwnership[pointHash]) {
        if (!holePointOwnership[pointHash].includes(i)) holePointOwnership[pointHash].push(i)
      } else {
        holePointOwnership[pointHash] = [i]
      }
    }
  }
  for (const hole of geo.holes) {
    const sharedPoints = new Set<string>()
    for (const point of hole) {
      const pointHash = point[0] + ":" + point[1]
      if (holePointOwnership[pointHash].length > 1) {
        sharedPoints.add(pointHash)
      }
    }
    const numSharedPoints = sharedPoints.size
    if (numSharedPoints > 1) {
      console.warn("more than one shared point in hole")
      return false
    }
  }
  return true
}
