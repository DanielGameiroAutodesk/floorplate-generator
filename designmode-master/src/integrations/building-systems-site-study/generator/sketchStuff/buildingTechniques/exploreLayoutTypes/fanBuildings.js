import { v4 as uuidv4 } from "uuid"
import {
  lineIntersectionPoint,
  normalizeVector,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import {
  getIntersectionAreaBetweenGroupsOfDisjunctPolygons,
  getIntersectionAreas,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/intersectionArea.js"
import { getDotProduct } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"

function distance(p1, p2) {
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2))
}

function getVectorNorm(p1, p2) {
  const l = distance(p1, p2)
  return [(p2[0] - p1[0]) / l, (p2[1] - p1[1]) / l]
}

function segmentsToGraph(segments, edgeOptions) {
  return segments.reduce(
    (acc, [p1, p2]) => {
      const v1 = {
        id: uuidv4(),
        x: p1[0],
        y: p1[1],
      }
      const v2 = {
        id: uuidv4(),
        x: p2[0],
        y: p2[1],
      }
      acc.vertices[v1.id] = v1
      acc.vertices[v2.id] = v2
      const edge = {
        id: uuidv4(),
        start: v1.id,
        end: v2.id,
        ...edgeOptions,
      }
      // if (i === 0) edge.width = 3;
      acc.edges[edge.id] = edge
      return acc
    },
    { vertices: {}, edges: {} },
  )
}

function getValidatedSegments(segments, buildingWidth) {
  if (!(segments && segments.length > 0)) return []
  const segmentsWithPolygons = segments
    .filter(([p1, p2]) => distance(p1, p2) > 16)
    .map(([p1, p2]) => {
      return [[p1, p2], getSegmentPolygon(p1, p2, buildingWidth * 1.9)]
    })

  return getIntersectionAreas(segmentsWithPolygons.map(([, p]) => p)).some((a) => {
    return a > 0.1
  })
    ? []
    : segmentsWithPolygons.map(([s]) => s)
}

function score(segments) {
  return segments.reduce((acc, [p1, p2]) => acc + distance(p1, p2), 0)
}

function clipPolygon(polygon, clip1, clip2) {
  const clip = (p1, p2, plane) => {
    const d1 = p1[0] * plane[0] + p1[1] * plane[1] - plane[2]
    const d2 = p2[0] * plane[0] + p2[1] * plane[1] - plane[2]
    const t = (0 - d1) / (d2 - d1)
    return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]
  }
  const inside = (p, plane) => {
    const d = p[0] * plane[0] + p[1] * plane[1]
    return d > plane[2]
  }
  const plane = [clip1[1] - clip2[1], clip2[0] - clip1[0], 0]
  plane[2] = clip1[0] * plane[0] + clip1[1] * plane[1]
  const clippedPolygon = []
  let s = polygon[polygon.length - 1]
  polygon.forEach((p) => {
    if (inside(p, plane)) {
      if (inside(s, plane)) {
        clippedPolygon.push(p)
      } else {
        clippedPolygon.push(clip(s, p, plane))
        clippedPolygon.push(p)
      }
    } else {
      if (inside(s, plane)) {
        clippedPolygon.push(clip(s, p, plane))
      }
    }
    s = p
  })
  return clippedPolygon
}

function clipSegments(segments, x1, x2) {
  const clip = (p1, p2, plane) => {
    const d1 = p1[0] * plane[0] + p1[1] * plane[1] - plane[2]
    const d2 = p2[0] * plane[0] + p2[1] * plane[1] - plane[2]
    const t = (0 - d1) / (d2 - d1)
    return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]
  }
  const inside = (p, plane) => {
    const d = p[0] * plane[0] + p[1] * plane[1]
    return d > plane[2]
  }
  const plane = [x1[1] - x2[1], x2[0] - x1[0], 0]
  plane[2] = x1[0] * plane[0] + x1[1] * plane[1]
  return segments
    .map(([s, p]) => {
      if (inside(p, plane)) {
        if (inside(s, plane)) {
          return [s, p]
        } else {
          return [p, clip(s, p, plane)]
        }
      } else {
        if (inside(s, plane)) {
          return [clip(s, p, plane), s]
        }
      }
      return null
    })
    .filter((s) => s)
}

function getSegmentPolygon(p1, p2, width) {
  const v = getVectorNorm(p1, p2)
  const n = [v[1], -v[0]]
  return [
    [p1[0] + (n[0] * width) / 2, p1[1] + (n[1] * width) / 2],
    [p2[0] + (n[0] * width) / 2, p2[1] + (n[1] * width) / 2],
    [p2[0] - (n[0] * width) / 2, p2[1] - (n[1] * width) / 2],
    [p1[0] - (n[0] * width) / 2, p1[1] - (n[1] * width) / 2],
  ]
}

function rayBeamSegments(p1, p2, width, obstructionSegments, minDistanceBetween) {
  const v = getVectorNorm(p1, p2)
  const clippingPoly = getSegmentPolygon(p1, p2, width)
  let prevBlockDistance = 0
  let prevSegmentDistance = -minDistanceBetween

  const unobstructed = clippingPoly
    .map((p, i, l) => [p, l[(i + 1) % l.length]])
    .reduce((acc, [clip1, clip2]) => clipSegments(acc, clip1, clip2), obstructionSegments)
    .map((s) => s.map((p) => getDotProduct(v, [p[0] - p1[0], p[1] - p1[1]])).sort((a, b) => a - b))
    .sort((a, b) => a[0] - b[0])
    .map(([start, end]) => {
      const startUnblocked = Math.max(prevSegmentDistance + minDistanceBetween, prevBlockDistance)
      if (start > startUnblocked + 16) {
        const openInterval = [startUnblocked, start]
        prevSegmentDistance = start
        prevBlockDistance = end
        return openInterval
      }
      prevBlockDistance = Math.max(end, prevBlockDistance)
      return null
    })
    .filter((s) => s)
  if (distance(p1, p2) > Math.max(prevSegmentDistance + minDistanceBetween, prevBlockDistance) + 16) {
    unobstructed.push([Math.max(prevSegmentDistance + minDistanceBetween, prevBlockDistance), distance(p1, p2)])
  }
  return unobstructed.map(([start, end]) => [
    [p1[0] + v[0] * start, p1[1] + v[1] * start],
    [p1[0] + v[0] * end, p1[1] + v[1] * end],
  ])
}

function rayBeamPolygon(p1, v, width, polygon, minShortSideDistance) {
  const obstructionSegments = polygon.map((p, i, l) => [p, l[(i + 1) % l.length]])
  const p2 = [p1[0] + v[0] * 10000, p1[1] + v[1] * 10000]
  const beamSegments = rayBeamSegments(p1, p2, width, obstructionSegments, 0)
  return beamSegments
    .filter(
      ([start, end]) =>
        getIntersectionAreaBetweenGroupsOfDisjunctPolygons([getSegmentPolygon(start, end, width)], [polygon]) >
        distance(start, end) * width - 1e-1,
    )
    .map(([start, end], i, l) => {
      if (i > 0 && distance(start, l[i - 1][1]) < minShortSideDistance) {
        const shrinkLength = 4 - distance(start, l[i - 1][1])
        if (distance(start, end) < 16 - shrinkLength) return null
        return [[start[0] + v[0] * shrinkLength, start[1] + v[1] * shrinkLength], end]
      }
      return [start, end]
    })
    .filter((s) => s)
}

function findFanBaseSuggestions(polygon, i) {
  let p1 = polygon[i]
  let p2 = polygon[(i + 1) % polygon.length]
  if (distance(p1, p2) < 0.1) return []
  const vBase = getVectorNorm(p1, p2)
  const vBaseNorm = [-vBase[1], vBase[0]]

  let jumpsLeft = 0
  let vLeft, p0
  do {
    jumpsLeft++
    p0 = polygon[(i - jumpsLeft + polygon.length) % polygon.length]
    vLeft = getVectorNorm(p1, p0)
  } while (jumpsLeft < polygon.length - 2 && getDotProduct(vLeft, vBaseNorm) <= 0.0)
  if (jumpsLeft > 1) {
    p1 = lineIntersectionPoint(p1, p2, p0, polygon[(i - jumpsLeft + polygon.length + 1) % polygon.length])
    if (!p1) return []
    vLeft = getVectorNorm(p1, p0)
  }
  let jumpsRight = 0
  let vRight, p3
  do {
    jumpsRight++
    p3 = polygon[(i + 1 + jumpsRight) % polygon.length]
    vRight = getVectorNorm(p2, p3)
  } while (jumpsRight < polygon.length - 1 - jumpsLeft && getDotProduct(vRight, vBaseNorm) <= 0)
  if (jumpsRight > 1) {
    p2 = lineIntersectionPoint(p1, p2, p3, polygon[(i + jumpsRight) % polygon.length])
    if (!p2) return []
    vRight = getVectorNorm(p2, p3)
  }
  if (getDotProduct(vLeft, vBaseNorm) < 0 || getDotProduct(vRight, vBaseNorm) < 0) return []

  let scanDepth = 0
  if (polygon.length < 100) {
    if (polygon.length < 50) {
      scanDepth = 4
    }
    scanDepth = 2
  }

  const bases = [{ p1, p2, vBase, vLeft, vRight }]
  let extraJumpsLeftI = 0
  const extraVLefts = []
  while (extraJumpsLeftI + jumpsLeft + jumpsRight < polygon.length && extraVLefts.length < scanDepth) {
    extraJumpsLeftI++
    const extraLeft = polygon[(i - jumpsLeft - extraJumpsLeftI + polygon.length) % polygon.length]
    const extraVLeft = getVectorNorm(p1, extraLeft)
    if (
      getDotProduct(extraVLeft, vBaseNorm) > 0.1 &&
      getDotProduct(extraVLeft, vBase) > getDotProduct(vLeft, vBase) &&
      (extraVLefts.length === 0 ||
        getDotProduct(extraVLeft, vBase) > getDotProduct(extraVLefts[extraVLefts.length - 1][1], vBase))
    ) {
      extraVLefts.push([extraJumpsLeftI, extraVLeft])
    }
  }

  let extraJumpsRightI = 0
  const extraVRights = []
  while (extraJumpsRightI + jumpsLeft + jumpsRight < polygon.length && extraVRights.length < scanDepth) {
    extraJumpsRightI++
    const extraRight = polygon[(i + 1 + jumpsRight + extraJumpsRightI) % polygon.length]
    const extraVRight = getVectorNorm(p2, extraRight)
    if (
      getDotProduct(extraVRight, vBaseNorm) > 0.1 &&
      getDotProduct(extraVRight, vBase) < getDotProduct(vRight, vBase) &&
      (extraVRights.length === 0 ||
        getDotProduct(extraVRight, vBase) < getDotProduct(extraVRights[extraVRights.length - 1][1], vBase))
    ) {
      extraVRights.push([extraJumpsRightI, extraVRight])
    }
  }

  extraVLefts.forEach(([lI, lV]) => {
    bases.push({ p1, p2, vBase, vLeft: lV, vRight })
    extraVRights.forEach(([rI, rV]) => {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      if (rI + lI + jumpsLeft + jumpsRight < polygon.length) {
        bases.push({ p1, p2, vBase, vLeft: lV, vRight: rV })
      }
    })
  })
  return bases
}

function populateFan(base, buildingWidth, polygon) {
  const { p1, p2, vLeft, vRight } = base
  const vBase = getVectorNorm(p1, p2)
  const leftW = 1e-5 + buildingWidth / Math.abs(getDotProduct([vLeft[1], -vLeft[0]], vBase)) / 2
  const left = [p1[0] + vBase[0] * leftW, p1[1] + vBase[1] * leftW]
  const rightW = 1e-5 + buildingWidth / Math.abs(getDotProduct([vRight[1], -vRight[0]], vBase)) / 2
  const right = [p2[0] - vBase[0] * rightW, p2[1] - vBase[1] * rightW]
  const count = 1 + Math.round((distance(p1, p2) - buildingWidth) / (buildingWidth * 2))
  return Array(3)
    .fill(0)
    .map((_, i) => count - 1 + i)
    .filter((c) => c > 0)
    .map((c) => {
      const beams = []
      for (let i = 0; i < c; i += 1) {
        const fLeft = c === 1 ? 0.5 : i / (c - 1)
        const fRight = c === 1 ? 0.5 : 1 - fLeft
        const p = [left[0] * fLeft + right[0] * fRight, left[1] * fLeft + right[1] * fRight]
        const v = normalizeVector([vLeft[0] * fLeft + vRight[0] * fRight, vLeft[1] * fLeft + vRight[1] * fRight])
        let beam = rayBeamPolygon(p, v, buildingWidth, polygon, 4)
        if (beam.length > 0) {
          const backward = rayBeamPolygon(beam[0][1], [-v[0], -v[1]], buildingWidth, polygon, 4)
          beam = backward
            .reverse()
            .map((s) => s.reverse())
            .concat(beam.slice(1, beam.length))
        }
        if (i > 0) {
          const prevSegments = beams
            .slice(0, i)
            .flatMap((b) => b)
            .flatMap(([p1, p2]) =>
              getSegmentPolygon(p1, p2, buildingWidth).map((p, i, l) => [p, l[(i + 1) % l.length]]),
            )
          beam = beam.flatMap(([p1, p2]) => rayBeamSegments(p1, p2, buildingWidth * 3 + 1e-5, prevSegments, 4))
        }
        beams.push(beam)
      }
      return getValidatedSegments(
        beams.flatMap((b) => b),
        buildingWidth,
      )
    })
    .reduce((acc, s) => (acc && score(acc) > score(s) ? acc : s), [])
}

function _getFanBuildings(_polygon, buildingWidth, stories) {
  const polygon = _polygon.filter((p, i, l) => distance(p, l[(i + 1) % l.length]) > 0.001)
  const segments = polygon
    .flatMap((p, i, l) =>
      findFanBaseSuggestions(l, i).map((base) => {
        if (!base) return []
        return populateFan(base, buildingWidth, polygon)
      }),
    )
    .reduce((acc, s) => {
      if (acc && score(acc) > score(s)) return acc
      return s
    }, [])
  return segments ? segmentsToGraph(segments, { width: buildingWidth, stories }) : { vertices: {}, edges: {} }
}

function _getETypeBuildings(_polygon, buildingWidth, stories) {
  const polygon = _polygon.filter((p, i, l) => distance(p, l[(i + 1) % l.length]) > 0.001)
  const segments = polygon
    .flatMap((p, i, l) =>
      findFanBaseSuggestions(l, i).map((base) => {
        if (!base) return []
        const { p1, p2 } = base
        const vBase = getVectorNorm(p1, p2)
        const nBase = [-vBase[1], vBase[0]]
        const baseBuildingSegments = rayBeamPolygon(
          [p1[0] + (nBase[0] * buildingWidth) / 1.99, p1[1] + (nBase[1] * buildingWidth) / 1.99],
          vBase,
          buildingWidth,
          polygon,
          4,
        )

        const startFanLine = [
          [p1[0] + nBase[0] * (buildingWidth * 2), p1[1] + nBase[1] * (buildingWidth * 2)],
          [p2[0] + nBase[0] * (buildingWidth * 2), p2[1] + nBase[1] * (buildingWidth * 2)],
        ]
        const clipped = clipPolygon(polygon, startFanLine[0], startFanLine[1])

        return [...baseBuildingSegments, ...populateFan(base, buildingWidth, clipped)]
      }),
    )
    .reduce((acc, s) => (acc && score(acc) > score(s) ? acc : s), null)
  return segments ? segmentsToGraph(segments, { width: buildingWidth, stories }) : { vertices: {}, edges: {} }
}

export function getFanBuildings(polygon, stories, buildingWidth) {
  return _getFanBuildings(polygon, buildingWidth, stories)
}

export function getETypeBuildings(polygon, stories, buildingWidth) {
  return _getETypeBuildings(polygon, buildingWidth, stories)
}
