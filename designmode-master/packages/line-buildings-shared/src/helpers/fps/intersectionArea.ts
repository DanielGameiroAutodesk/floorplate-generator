import type { Polygon } from "../../lineBuildingGenerator/lib/lineBuilding9000/BuildingTypes.js"
import type { Vec2 } from "../../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"
import type { PolygonWithHolesVec2 } from "../../lineBuildingGenerator/lib/sectionFill/getSectionFill.js"

type LineGroup = {
  x0: number
  y0: number
  x1: number
  y1: number
  type: number
  group: number
}
function findCrossingPointsManyGroups(lineGroups: LineGroup[][]) {
  let crossing_points: number[] = []
  for (let i = 0; i < lineGroups.length - 1; i++) {
    lineGroups[i].forEach((line1) => {
      for (let j = i + 1; j < lineGroups.length; j++) {
        for (let k = 0; k < lineGroups[j].length; k++) {
          const line2 = lineGroups[j][k]
          if (line2.x0 >= line1.x1) {
            break
          }
          if ((line2.x0 === line1.x0 && line2.y0 === line1.y0) || (line2.x1 === line1.x1 && line2.y1 === line1.y1)) {
            continue
          }
          const denominator =
            (line2.y1 - line2.y0) * (line1.x1 - line1.x0) - (line1.y1 - line1.y0) * (line2.x1 - line2.x0)
          if (Math.abs(denominator) < 1e-8) {
            continue
          }

          const nominator =
            (line1.x1 - line1.x0) * (line2.x0 * line2.y1 - line2.x1 * line2.y0) -
            (line2.x1 - line2.x0) * (line1.x0 * line1.y1 - line1.x1 * line1.y0)
          const x = nominator / denominator
          if (x <= Math.max(line2.x0, line1.x0) || x >= Math.min(line2.x1, line1.x1)) {
            continue
          }
          crossing_points.push(x)
        }
      }
    })
  }
  return crossing_points
}

function getLinesOnSegment(
  allLines: LineGroup[],
  _activeLines: LineGroup[],
  startI: number,
  xStart: number,
  xEnd: number,
) {
  const activeLines = _activeLines.filter((l) => l.x1 > xStart)
  let i = startI
  while (i < allLines.length && allLines[i].x0 < xEnd) {
    if (allLines[i].x1 > xStart) activeLines.push(allLines[i])
    i += 1
  }
  return [activeLines, i] as const
}

function get_y_at_x(line: LineGroup, x: number) {
  return ((x - line.x0) * line.y1 + (line.x1 - x) * line.y0) / (line.x1 - line.x0)
}

function cmp_2(a: number[], b: number[]) {
  const d0 = a[0] - b[0]
  if (Math.abs(d0) > 1e-10) {
    return d0
  }
  return b[1] - a[1]
}

function getIntersectionAreasOnSegment(
  x_start: number,
  x_end: number,
  lines_on_segment: LineGroup[],
  mutAreas: number[],
) {
  const groupIndices = Array.from(new Set(lines_on_segment.map((line) => line.group)))
  let areas: Record<number, number> = {}
  let counters: Record<number, number> = {}
  groupIndices.forEach((i) => {
    areas[i] = 0.0
    counters[i] = 0
  })

  const x_center = (x_start + x_end) / 2.0
  const ys = lines_on_segment.map((line) => [get_y_at_x(line, x_center), line.type, line.group]).sort(cmp_2)

  let sumCounters = 0

  for (let y of ys) {
    const i = y[2]
    if (sumCounters - counters[i] > 0) {
      if (counters[i] === 0 && y[1] === 1) {
        areas[i] -= y[0]
      } else if (counters[i] === 1 && y[1] === -1) {
        areas[i] += y[0]
      }
    }
    if (sumCounters - counters[i] === 1) {
      const insideIndices = groupIndices.filter((index) => index !== i && counters[index] > 0)
      if (insideIndices.length === 1) {
        if (counters[i] === 0 && y[1] === 1) {
          areas[insideIndices[0]] -= y[0]
        } else if (counters[i] === 1 && y[1] === -1) {
          areas[insideIndices[0]] += y[0]
        }
      }
    }
    counters[i] += y[1]
    sumCounters += y[1]
  }
  groupIndices.forEach((i) => (mutAreas[i] += areas[i] * (x_end - x_start)))
}

function sorted(l: number[]) {
  return l.slice().sort((a, b) => a - b)
}

function getXBb(rings: Polygon[]) {
  const ccw_xs = rings.flatMap((ring) => ring.map((p) => p[0]))
  return [Math.min(...ccw_xs), Math.max(...ccw_xs)]
}

function get_lines(rings: Polygon[], xMax: number, xMin: number, group: number) {
  let lines = []
  for (let ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      const [x0, y0] = ring[i]
      const [x1, y1] = ring[(i + 1) % ring.length]

      if (x1 > x0 && x0 <= xMax && x1 >= xMin) {
        lines.push({ x0, y0, x1, y1, type: 1, group })
      } else if (x0 > x1 && x1 <= xMax && x0 >= xMin) {
        lines.push({ x0: x1, y0: y1, x1: x0, y1: y0, type: -1, group })
      }
    }
  }
  lines.sort((l1, l2) => l1.x0 - l2.x0)
  return lines
}

export function getIntersectionAreasXY(polys: Vec2[][]) {
  return getIntersectionAreas(
    polys.map((polygon) => {
      return polygon.map((point) => {
        return [point.x, point.y]
      })
    }),
  )
}

function getIntersectionAreaOfPolygonAndPolygonWithHoles(polygon: Vec2[], polygonWithHoles: PolygonWithHolesVec2) {
  const [, outerArea, ...holeAreas] = getIntersectionAreasXY([
    polygon,
    polygonWithHoles.polygon,
    ...(polygonWithHoles.holes || []),
  ])
  let intersectionArea = outerArea
  holeAreas.forEach((holeArea) => {
    intersectionArea -= holeArea
  })
  return intersectionArea
}

export function getIntersectionAreaOfPolygonsWithHoles(polyOne: PolygonWithHolesVec2, polyTwo: PolygonWithHolesVec2) {
  let area = getIntersectionAreaOfPolygonAndPolygonWithHoles(polyOne.polygon, polyTwo)
  ;(polyOne.holes || [])
    .map((hole) => getIntersectionAreaOfPolygonAndPolygonWithHoles(hole, polyTwo))
    .forEach((holeArea) => {
      area -= holeArea
    })
  return area
}

export function getIntersectionAreas(polys: Polygon[]) {
  const [xMin, xMax] = getXBb(polys)
  const lineGroups = polys.map((poly, i) => get_lines([poly], xMax, xMin, i))
  const crossingPoints = sorted(findCrossingPointsManyGroups(lineGroups))

  const lines = lineGroups.flat().sort((l1, l2) => l1.x0 - l2.x0)
  const xPoints = sorted(polys.flatMap((ring) => ring.map((p) => p[0])).filter((x) => x >= xMin && x <= xMax))
  let ci = 0
  let areas = polys.map(() => 0.0)
  let activeLines: LineGroup[] = []
  let activeLinesI = 0
  for (let i = 0; i < xPoints.length - 1; i += 1) {
    let x_start = xPoints[i]
    const x_end = xPoints[i + 1]
    if (x_end <= x_start + 1e-8) {
      continue
    }
    const [activeLinesGroup, activelineIndex] = getLinesOnSegment(lines, activeLines, activeLinesI, x_start, x_end)
    activeLines = activeLinesGroup
    activeLinesI = activelineIndex

    while (ci < crossingPoints.length && crossingPoints[ci] < x_end) {
      const x_cross = crossingPoints[ci]
      if (x_cross > x_start) {
        getIntersectionAreasOnSegment(x_start, x_cross, activeLines, areas)
      }
      x_start = x_cross
      ci += 1
    }
    getIntersectionAreasOnSegment(x_start, x_end, activeLines, areas)
  }

  return areas
}
