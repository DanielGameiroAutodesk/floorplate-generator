function findCrossingPoints(lines1, lines2) {
  const n1 = lines1.length
  const n2 = lines2.length
  let crossing_points = []
  for (let i = 0; i < n1; i += 1) {
    const l1 = lines1[i]
    for (let j = 0; j < n2; j += 1) {
      const l2 = lines2[j]
      if (l2.x0 >= l1.x1) {
        break
      }
      if ((l2.x0 === l1.x0 && l2.y0 === l1.y0) || (l2.x1 === l1.x1 && l2.y1 === l1.y1)) {
        continue
      }
      const denominator = (l2.y1 - l2.y0) * (l1.x1 - l1.x0) - (l1.y1 - l1.y0) * (l2.x1 - l2.x0)
      if (Math.abs(denominator) < 1e-8) {
        continue
      }

      const nominator =
        (l1.x1 - l1.x0) * (l2.x0 * l2.y1 - l2.x1 * l2.y0) - (l2.x1 - l2.x0) * (l1.x0 * l1.y1 - l1.x1 * l1.y0)
      const x = nominator / denominator
      if (x <= Math.max(l2.x0, l1.x0) || x >= Math.min(l2.x1, l1.x1)) {
        continue
      }
      crossing_points.push(x)
    }
  }
  return crossing_points
}

function findCrossingPointsManyGroups(lineGroups) {
  let crossing_points = []
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

function getLinesOnSegment(allLines, _activeLines, startI, xStart, xEnd) {
  const activeLines = _activeLines.filter((l) => l.x1 > xStart)
  let i = startI
  while (i < allLines.length && allLines[i].x0 < xEnd) {
    if (allLines[i].x1 > xStart) activeLines.push(allLines[i])
    i += 1
  }
  return [activeLines, i]
}

function get_y_at_x(line, x) {
  return ((x - line.x0) * line.y1 + (line.x1 - x) * line.y0) / (line.x1 - line.x0)
}

function cmp_2(a, b) {
  const d0 = a[0] - b[0]
  if (Math.abs(d0) > 1e-10) {
    return d0
  }
  return b[1] - a[1]
}

function getIntersectionAreaOnSegment(x_start, x_end, lines_on_segment) {
  let area = 0
  const x_center = (x_start + x_end) / 2.0
  const ys = lines_on_segment.map((line) => [get_y_at_x(line, x_center), line.type, line.group]).sort(cmp_2)
  let counter1 = 0
  let counter2 = 0

  for (let y of ys) {
    if (y[2] === 1) {
      if (counter2 > 0) {
        if (counter1 === 0 && y[1] === 1) {
          area -= y[0]
        } else if (counter1 === 1 && y[1] === -1) {
          area += y[0]
        }
      }
      counter1 += y[1]
    } else {
      if (counter1 > 0) {
        if (counter2 === 0 && y[1] === 1) {
          area -= y[0]
        } else if (counter2 === 1 && y[1] === -1) {
          area += y[0]
        }
      }
      counter2 += y[1]
    }
  }
  // if (area > 0) {
  // }
  return area * (x_end - x_start)
}

function findCrossingPointsInternally(lines1) {
  const n = lines1.length
  let crossing_points = []
  for (let i = 0; i < n; i += 1) {
    const l1 = lines1[i]
    for (let j = i + 1; j < n; j += 1) {
      const l2 = lines1[j]
      if (l2.x0 >= l1.x1) {
        break
      }
      if ((l2.x0 === l1.x0 && l2.y0 === l1.y0) || (l2.x1 === l1.x1 && l2.y1 === l1.y1)) {
        continue
      }
      const denominator = (l2.y1 - l2.y0) * (l1.x1 - l1.x0) - (l1.y1 - l1.y0) * (l2.x1 - l2.x0)
      if (Math.abs(denominator) < 1e-8) {
        continue
      }

      const nominator =
        (l1.x1 - l1.x0) * (l2.x0 * l2.y1 - l2.x1 * l2.y0) - (l2.x1 - l2.x0) * (l1.x0 * l1.y1 - l1.x1 * l1.y0)
      const x = nominator / denominator
      if (x <= Math.max(l2.x0, l1.x0) || x >= Math.min(l2.x1, l1.x1)) {
        continue
      }
      crossing_points.push(x)
    }
  }
  return crossing_points
}

function getAreaOnSegment(x_start, x_end, lines_on_segment) {
  let area = 0
  const x_center = (x_start + x_end) / 2.0
  const ys = lines_on_segment.map((line) => [get_y_at_x(line, x_center), line.type]).sort(cmp_2)
  let counter = 0

  for (let y of ys) {
    if (counter === 0 && y[1] === 1) {
      area -= y[0]
    } else if (counter === 1 && y[1] === -1) {
      area += y[0]
    }
    counter += y[1]
  }
  return area * (x_end - x_start)
}

export function areaOfUnionRespectWinding(polygons) {
  const [xMin, xMax] = getXBb(polygons)
  const lines = get_lines(polygons, xMax, xMin, 1)
  const crossingPoints = sorted(findCrossingPointsInternally(lines))
  const xPoints = sorted(polygons.flatMap((ring) => ring.map((p) => p[0])).filter((x) => x >= xMin && x <= xMax))

  let ci = 0
  let area = 0.0
  let activeLines = []
  let activeLinesI = 0

  for (let i = 0; i < xPoints.length - 1; i += 1) {
    let x_start = xPoints[i]
    const x_end = xPoints[i + 1]
    if (x_end === x_start) {
      continue
    }
    const _active = getLinesOnSegment(lines, activeLines, activeLinesI, x_start, x_end)
    activeLines = _active[0]
    activeLinesI = _active[1]

    while (ci < crossingPoints.length && crossingPoints[ci] < x_end) {
      const x_cross = crossingPoints[ci]
      if (x_cross > x_start) {
        area += getAreaOnSegment(x_start, x_cross, activeLines)
      }
      x_start = x_cross
      ci += 1
    }
    area += getAreaOnSegment(x_start, x_end, activeLines)
  }

  return area
}

function getIntersectionAreasOnSegment(x_start, x_end, lines_on_segment, mutAreas) {
  const groupIndices = Array.from(new Set(lines_on_segment.map((line) => line.group)))
  let areas = {}
  let counters = {}
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

function sorted(l) {
  return l.slice().sort((a, b) => a - b)
}

function getXBb(rings) {
  const ccw_xs = rings.flatMap((ring) => ring.map((p) => p[0]))
  return [Math.min(...ccw_xs), Math.max(...ccw_xs)]
}

function get_lines(rings, xMax, xMin, group) {
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

export function getIntersectionAreaBetweenGroupsOfDisjunctPolygons(polys1, polys2) {
  const [xMin1, xMax1] = getXBb(polys1)
  const [xMin2, xMax2] = getXBb(polys1)
  const xMin = Math.min(xMin1, xMin2)
  const xMax = Math.max(xMax1, xMax2)
  const allRings = polys1.concat(polys2)
  const lines1 = get_lines(polys1, xMax, xMin, 1)
  const lines2 = get_lines(polys2, xMax, xMin, 2)
  const crossingPoints = sorted(findCrossingPoints(lines1, lines2))

  const lines = lines1.concat(lines2).sort((l1, l2) => l1.x0 - l2.x0)
  const xPoints = sorted(allRings.flatMap((ring) => ring.map((p) => p[0])).filter((x) => x >= xMin && x <= xMax))

  let ci = 0
  let area = 0.0
  let activeLines = []
  let activeLinesI = 0

  for (let i = 0; i < xPoints.length - 1; i += 1) {
    let x_start = xPoints[i]
    const x_end = xPoints[i + 1]
    if (x_end === x_start) {
      continue
    }
    const _active = getLinesOnSegment(lines, activeLines, activeLinesI, x_start, x_end)
    activeLines = _active[0]
    activeLinesI = _active[1]

    while (ci < crossingPoints.length && crossingPoints[ci] < x_end) {
      const x_cross = crossingPoints[ci]
      if (x_cross > x_start) {
        area += getIntersectionAreaOnSegment(x_start, x_cross, activeLines)
      }
      x_start = x_cross
      ci += 1
    }
    area += getIntersectionAreaOnSegment(x_start, x_end, activeLines)
  }

  return area
}

export function getIntersectionAreas(polys) {
  const [xMin, xMax] = getXBb(polys)
  const lineGroups = polys.map((poly, i) => get_lines([poly], xMax, xMin, i))
  const crossingPoints = sorted(findCrossingPointsManyGroups(lineGroups))

  const lines = lineGroups.flat().sort((l1, l2) => l1.x0 - l2.x0)
  const xPoints = sorted(polys.flatMap((ring) => ring.map((p) => p[0])).filter((x) => x >= xMin && x <= xMax))
  let ci = 0
  let areas = polys.map(() => 0.0)
  let activeLines = []
  let activeLinesI = 0
  for (let i = 0; i < xPoints.length - 1; i += 1) {
    let x_start = xPoints[i]
    const x_end = xPoints[i + 1]
    if (x_end <= x_start + 1e-8) {
      continue
    }
    const _active = getLinesOnSegment(lines, activeLines, activeLinesI, x_start, x_end)
    activeLines = _active[0]
    activeLinesI = _active[1]

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

function getUnionAreaOnSegment(x_start, x_end, lines_on_segment) {
  const groupIndices = Array.from(new Set(lines_on_segment.map((line) => line.group)))
  let area = 0.0
  let counters = {}
  let blockingCounters = {}
  groupIndices.forEach((i) => {
    i % 2 === 0 ? (counters[i] = 0) : (blockingCounters[i] = 0)
  })

  const x_center = (x_start + x_end) / 2.0
  const ys = lines_on_segment.map((line) => [get_y_at_x(line, x_center), line.type, line.group]).sort(cmp_2)

  for (let y of ys) {
    const i = y[2]
    const allOtherZero = Object.keys(counters)
      .filter((key) => key !== i + "")
      .every((key) => counters[key] === 0)
    const allOtherBlockersZero = Object.keys(blockingCounters)
      .filter((key) => key !== i + "")
      .every((key) => blockingCounters[key] === 0)

    if (i % 2 === 0) {
      if (allOtherZero && allOtherBlockersZero && counters[i] === 0 && y[1] === 1) {
        area -= y[0]
      } else if (allOtherZero && allOtherBlockersZero && counters[i] === 1 && y[1] === -1) {
        area += y[0]
      }
      counters[i] += y[1]
    } else {
      if (!allOtherZero && allOtherBlockersZero && blockingCounters[i] === 0 && y[1] === 1) {
        area += y[0]
      } else if (!allOtherZero && allOtherBlockersZero && blockingCounters[i] === 1 && y[1] === -1) {
        area -= y[0]
      }
      blockingCounters[i] += y[1]
    }
  }
  return area * (x_end - x_start)
}

export function getAreaOfUnion(polys, blockingPolys = []) {
  if (polys.length === 0) return 0.0

  const allPolys = [...polys, ...blockingPolys]
  const [xMin, xMax] = getXBb(allPolys)
  const lineGroups = [
    ...polys.map((poly, i) => get_lines([poly], xMax, xMin, 2 * i)),
    ...blockingPolys.map((poly, i) => get_lines([poly], xMax, xMin, 2 * i + 1)),
  ]
  const crossingPoints = sorted(findCrossingPointsManyGroups(lineGroups))

  const lines = lineGroups.flat().sort((l1, l2) => l1.x0 - l2.x0)
  const xPoints = sorted(allPolys.flatMap((ring) => ring.map((p) => p[0])).filter((x) => x >= xMin && x <= xMax))
  let ci = 0
  let area = 0.0
  let activeLines = []
  let activeLinesI = 0
  for (let i = 0; i < xPoints.length - 1; i += 1) {
    let x_start = xPoints[i]
    const x_end = xPoints[i + 1]
    if (x_end <= x_start + 1e-8) {
      continue
    }
    const _active = getLinesOnSegment(lines, activeLines, activeLinesI, x_start, x_end)
    activeLines = _active[0]
    activeLinesI = _active[1]

    while (ci < crossingPoints.length && crossingPoints[ci] < x_end) {
      const x_cross = crossingPoints[ci]
      if (x_cross > x_start) {
        area += getUnionAreaOnSegment(x_start, x_cross, activeLines)
      }
      x_start = x_cross
      ci += 1
    }
    area += getUnionAreaOnSegment(x_start, x_end, activeLines)
  }

  return area
}
