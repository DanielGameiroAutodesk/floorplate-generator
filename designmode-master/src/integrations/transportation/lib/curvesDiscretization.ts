import { Vector2 } from "three"
import { computeMaxSegmentLengthFromAngleAndRadius, getCircleSegment, type CircleSegmentDefinition } from "./curvesCore"

export type CurveEndpoint = {
  point: Vector2
  direction: Vector2
}

export const getStartEndPointPerCurve = (
  vec2s: Vector2[],
  radiusPerCorner: number[],
): [CurveEndpoint, CurveEndpoint][] => {
  const edgeVecs = vec2s.slice(1).map((v, i) => v.clone().sub(vec2s[i]))
  const edgeVecsNormalized = edgeVecs.map((v) => v.clone().normalize())
  const anglesBetweenEdges = edgeVecs.slice(1).map((v, i) => Math.PI - Math.abs(v.angleTo(edgeVecs[i])))
  const segmentLengths = radiusPerCorner
    .slice(1, -1)
    .map((r, i) => computeMaxSegmentLengthFromAngleAndRadius(anglesBetweenEdges[i], r))
  return segmentLengths.map((l, i) => {
    const startPt = vec2s[i + 1].clone().sub(edgeVecsNormalized[i].clone().multiplyScalar(l))
    const endPt = vec2s[i + 1].clone().add(edgeVecsNormalized[i + 1].clone().multiplyScalar(l))
    const startDir = edgeVecsNormalized[i].clone()
    const endDir = edgeVecsNormalized[i + 1].clone()
    return [
      { point: startPt, direction: startDir },
      { point: endPt, direction: endDir },
    ]
  })
}

export const polygonsFromCircleSegmentCurve = (vec2s: Vector2[], radiusPerCorner: number[], buffer: number) => {
  const edgeVecs = vec2s.slice(1).map((v, i) => v.clone().sub(vec2s[i]))
  const edgeVecsNormalized = edgeVecs.map((v) => v.clone().normalize())
  const angles = edgeVecs.slice(1).map((v, i) => v.angleTo(edgeVecs[i]))
  const segmentLengths = radiusPerCorner
    .slice(1, -1)
    .map((r, i) => computeMaxSegmentLengthFromAngleAndRadius(Math.PI - angles[i], r))

  const polygons: [number, number][][] = []
  let prevPt = vec2s[0]
  for (let i = 1; i < vec2s.length - 1; i++) {
    const corner = vec2s[i]
    const start = corner.clone().sub(edgeVecsNormalized[i - 1].clone().multiplyScalar(segmentLengths[i - 1]))
    const end = corner.clone().add(edgeVecsNormalized[i].clone().multiplyScalar(segmentLengths[i - 1]))

    if (start.distanceTo(prevPt) > 1e-6) polygons.push(bufferLineSegment(prevPt, start, buffer))
    if (start.distanceTo(end) > 1e-6) {
      if (Math.abs(Math.sin(angles[i - 1])) < 0.0001) {
        polygons.push(bufferLineSegment(start, end, buffer))
      } else {
        const curve = getCircleSegment(start, corner, end)
        polygons.push(bufferCircleSegmentToPolygon(curve, buffer))
      }
    } else if (Math.abs(Math.sin(angles[i - 1])) > 0.0001) {
      const orthogonal1 = new Vector2(-edgeVecsNormalized[i - 1].y, edgeVecsNormalized[i - 1].x)
      const orthogonal2 = new Vector2(-edgeVecsNormalized[i].y, edgeVecsNormalized[i].x)
      polygons.push(bufferCorner(corner, orthogonal1, orthogonal2, buffer))
    }
    prevPt = end
  }
  const lastPoint = vec2s[vec2s.length - 1]
  if (lastPoint.distanceTo(prevPt) > 1e-6) {
    polygons.push(bufferLineSegment(prevPt, lastPoint, buffer))
  }
  return polygons
}

function bufferCircleSegmentToPolygon(circleSegment: CircleSegmentDefinition, buffer: number) {
  // Combining outwards and inwards buffered circle segments to discretize to polygon
  const bufferedOutSegment = { ...circleSegment, radius: circleSegment.radius + buffer / 2 }
  const bufferedInSegment = { ...circleSegment, radius: circleSegment.radius - buffer / 2 }
  const outer = sampleCircleSegment(bufferedOutSegment)
  let inner: [number, number][] = []
  const { centerX, centerY, radius } = circleSegment
  if (bufferedInSegment.radius > 0) inner = sampleCircleSegment(bufferedInSegment)
  else {
    // If buffering curve inwards results in self-intersecting shape, use just self-intersection point as inner arc
    const outerSegmentMidPoint = getCircleSegmentMidpoint(bufferedOutSegment)
    const dirToIntersection = new Vector2(centerX, centerY).sub(outerSegmentMidPoint).normalize()
    const intersection = outerSegmentMidPoint.clone().add(dirToIntersection.setLength(radius + buffer / 2))
    inner = [intersection.toArray()]
  }
  return circleSegment.clockwise ? inner.concat([...outer].reverse()) : outer.concat([...inner].reverse())
}

function getCircleSegmentMidpoint(circleSegment: CircleSegmentDefinition) {
  const { centerX, centerY, radius, startAngle, endAngle, clockwise } = circleSegment
  const angleDiff = Math.abs(startAngle - endAngle)
  const angleSpan = Math.min(angleDiff, Math.PI * 2 - angleDiff)
  const angle = startAngle + (angleSpan / 2) * (clockwise ? -1 : 1)
  return new Vector2(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle))
}

function bufferLineSegment(start: Vector2, end: Vector2, buffer: number): [number, number][] {
  const normal = new Vector2(-end.y + start.y, end.x - start.x).normalize()
  return [
    [start.x - normal.x * (buffer / 2), start.y - normal.y * (buffer / 2)],
    [end.x - normal.x * (buffer / 2), end.y - normal.y * (buffer / 2)],
    [end.x + normal.x * (buffer / 2), end.y + normal.y * (buffer / 2)],
    [start.x + normal.x * (buffer / 2), start.y + normal.y * (buffer / 2)],
  ]
}

function bufferCorner(corner: Vector2, normal1: Vector2, normal2: Vector2, buffer: number) {
  const turn = normal1.cross(normal2) > 0 ? -1 : 1
  const offset1 = normal1.clone().multiplyScalar(turn * (buffer / 2))
  const offset2 = normal2.clone().multiplyScalar(turn * (buffer / 2))
  return [corner.clone().add(offset1).toArray(), corner.clone().add(offset2).toArray(), corner.toArray()]
}

export const linestringFromCircleSegmentCurve = (vec2s: Vector2[], radiusPerCorner: number[]) => {
  const edgeVecs = vec2s.slice(1).map((v, i) => v.clone().sub(vec2s[i]))
  const edgeVecsNormalized = edgeVecs.map((v) => v.clone().normalize())
  const angles = edgeVecs.slice(1).map((v, i) => v.angleTo(edgeVecs[i]))
  const segmentLengths = radiusPerCorner
    .slice(1, -1)
    .map((r, i) => computeMaxSegmentLengthFromAngleAndRadius(Math.PI - angles[i], r))

  const lines: [number, number][][] = []
  let prevPt = vec2s[0]
  for (let i = 1; i < vec2s.length - 1; i++) {
    const corner = vec2s[i]
    const start = corner.clone().sub(edgeVecsNormalized[i - 1].clone().multiplyScalar(segmentLengths[i - 1]))
    const end = corner.clone().add(edgeVecsNormalized[i].clone().multiplyScalar(segmentLengths[i - 1]))

    if (start.distanceTo(prevPt) > 1e-6)
      lines.push([
        [prevPt.x, prevPt.y],
        [start.x, start.y],
      ])
    if (start.distanceTo(end) > 1e-6) {
      if (Math.abs(Math.sin(angles[i - 1])) < 0.0001) {
        lines.push([
          [start.x, start.y],
          [end.x, end.y],
        ])
      } else {
        const curve = getCircleSegment(start, corner, end)
        lines.push(sampleCircleSegment(curve).map((p) => [p[0], p[1]]))
      }
    }
    prevPt = end
  }
  if (vec2s[vec2s.length - 1].distanceTo(prevPt) > 1e-6)
    lines.push([
      [prevPt.x, prevPt.y],
      [vec2s[vec2s.length - 1].x, vec2s[vec2s.length - 1].y],
    ])
  if (lines.length == 0) return []
  return lines
    .slice(0, -1)
    .flatMap((line) => line.slice(0, -1))
    .concat(lines[lines.length - 1])
}

function sampleCircleSegment(circleSegment: CircleSegmentDefinition) {
  const { centerX, centerY, radius, startAngle, endAngle, clockwise } = circleSegment

  const angleDiff = Math.abs(startAngle - endAngle)
  const angleSpan = Math.min(angleDiff, Math.PI * 2 - angleDiff)
  const numSegments = getNumSampleSegments(angleSpan, radius)

  const dAngle = (angleSpan / numSegments) * (clockwise ? -1 : 1)
  const points: [number, number][] = []
  for (let i = 0; i <= numSegments; i++) {
    const angle = startAngle + dAngle * i
    points.push([centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle)])
  }
  return points
}

function getNumSampleSegments(angleSpan: number, radius: number) {
  const minSegments = 4
  const maxSegments = 30

  const segmentsFromAngle = Math.ceil((angleSpan * 36) / Math.PI)

  const tangentDeviationThreshold = 0.5
  const dAlphaFromTangentDeviation = Math.acos(Math.max(-1, Math.min(1, (radius - tangentDeviationThreshold) / radius)))
  const segmentsFromTangentDeviation = Math.ceil(angleSpan / dAlphaFromTangentDeviation)

  return Math.min(maxSegments, Math.max(minSegments, segmentsFromAngle, segmentsFromTangentDeviation))
}

type LineSegmentCurveSection = [[Vector2, Vector2], undefined]
type CircleSegmentCurveSection = [undefined, CircleSegmentDefinition]
type CurveSection = LineSegmentCurveSection | CircleSegmentCurveSection

export function sampleCurveWithNormalsAtRegularIntervals(vec2s: Vector2[], radiusPerCorner: number[], step: number) {
  const edgeVecs = vec2s.slice(1).map((v, i) => v.clone().sub(vec2s[i]))
  const edgeVecsNormalized = edgeVecs.map((v) => v.clone().normalize())
  const angles = edgeVecs.slice(1).map((v, i) => v.angleTo(edgeVecs[i]))
  const segmentLengths = radiusPerCorner
    .slice(1, -1)
    .map((r, i) => computeMaxSegmentLengthFromAngleAndRadius(Math.PI - angles[i], r))
  let prevPt = vec2s[0]
  const curveSections: CurveSection[] = []
  for (let i = 1; i < vec2s.length - 1; i++) {
    const corner = vec2s[i]
    const start = corner.clone().sub(edgeVecsNormalized[i - 1].clone().multiplyScalar(segmentLengths[i - 1]))
    const end = corner.clone().add(edgeVecsNormalized[i].clone().multiplyScalar(segmentLengths[i - 1]))
    if (start.distanceTo(prevPt) > 1e-6) curveSections.push([[prevPt, start], undefined])
    if (start.distanceTo(end) > 1e-6) {
      const curve = getCircleSegment(start, corner, end)
      curveSections.push([undefined, curve])
    }
    prevPt = end
  }
  if (vec2s[vec2s.length - 1].distanceTo(prevPt) > 1e-6)
    curveSections.push([[prevPt, vec2s[vec2s.length - 1]], undefined])

  const sectionLengths = curveSections.map(([line, circle]) => {
    if (line) return line[0].distanceTo(line[1])
    else {
      const { radius, startAngle, endAngle, clockwise } = circle
      let endAngleAdjusted = endAngle
      if (clockwise && startAngle < endAngle) endAngleAdjusted -= Math.PI * 2
      else if (!clockwise && startAngle > endAngle) endAngleAdjusted += Math.PI * 2
      return radius * Math.abs(startAngle - endAngleAdjusted)
    }
  })
  const cumulativeLengths = sectionLengths.reduce((acc: number[], l: number) => {
    const prevLength = acc[acc.length - 1] ?? 0
    acc.push(prevLength + l)
    return acc
  }, [])

  const points: Vector2[] = []
  const normals: Vector2[] = []

  const sampleLineSegment = (start: Vector2, end: Vector2, step: number, offset: number) => {
    const vec = end.clone().sub(start)
    const length = vec.length()
    const vecNormalized = vec.clone().normalize()
    const orthogonal = new Vector2(-vecNormalized.y, vecNormalized.x)
    for (let dist = offset; dist < length; dist += step) {
      points.push(start.clone().add(vecNormalized.clone().multiplyScalar(dist)))
      normals.push(orthogonal.clone())
    }
  }
  const sampleCircleSegment = (circleSegment: CircleSegmentDefinition, step: number, offset: number) => {
    const { centerX, centerY, radius, startAngle, endAngle, clockwise } = circleSegment
    let endAngleAdjusted = endAngle
    if (clockwise && startAngle < endAngle) endAngleAdjusted -= Math.PI * 2
    else if (!clockwise && startAngle > endAngle) endAngleAdjusted += Math.PI * 2
    const angleDiff = Math.abs(startAngle - endAngleAdjusted)
    const arcLength = radius * angleDiff
    for (let dist = offset; dist < arcLength; dist += step) {
      const angle = startAngle + (dist / radius) * (clockwise ? -1 : 1)
      points.push(new Vector2(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle)))
      normals.push(new Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(clockwise ? 1 : -1))
    }
  }

  for (let sectionIndex = 0; sectionIndex < curveSections.length; sectionIndex++) {
    const previousDistance = cumulativeLengths[sectionIndex - 1] ?? 0
    const offset = Math.ceil(previousDistance / step) * step - previousDistance
    const [line, circle] = curveSections[sectionIndex]
    if (line) sampleLineSegment(line[0], line[1], step, offset)
    else sampleCircleSegment(circle, step, offset)
  }
  return { points, normals }
}
