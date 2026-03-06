import { Vector2 } from "three"

export type CircleSegmentDefinition = {
  centerX: number
  centerY: number
  radius: number
  startAngle: number
  endAngle: number
  clockwise: boolean
}

export const getCircleSegment = (start: Vector2, corner: Vector2, end: Vector2) => {
  const vec1 = start.clone().sub(corner)
  const vec2 = end.clone().sub(corner)

  const angle = vec1.angleTo(vec2)
  const isClockwise = vec1.cross(vec2) > 0
  const startVectorIsShorter = vec1.length() < vec2.length()
  const limitingVec = startVectorIsShorter ? vec1 : vec2
  const otherVec = startVectorIsShorter ? vec2 : vec1

  const startAngle = vec1.angle() + (Math.PI / 2) * (isClockwise ? -1 : 1)
  const radius = limitingVec.length() * Math.abs(Math.tan(angle / 2))
  const endAngle = vec2.angle() + (Math.PI / 2) * (isClockwise ? 1 : -1)
  const orthogonal = limitingVec
    .clone()
    .rotateAround(new Vector2(), Math.PI / 2)
    .normalize()
  orthogonal.multiplyScalar(orthogonal.dot(otherVec) > 0 ? 1 : -1)
  const center = (startVectorIsShorter ? start : end).clone().add(orthogonal.multiplyScalar(radius))
  return { centerX: center.x, centerY: center.y, radius, startAngle, endAngle, clockwise: isClockwise }
}

export const computeMaxSegmentLengthFromAngleAndRadius = (angle: number, radius: number) => {
  return radius * Math.tan((Math.PI - angle) / 2)
}

function computeRadiusFromAngleAndSegmentLength(angle: number, segmentLength: number) {
  return segmentLength * Math.tan(angle / 2)
}

const computeCircleTangentPt = (leftAngle: number, rightAngle: number) => {
  if (Math.abs(Math.sin(leftAngle)) < 0.0001) return 0
  if (Math.abs(Math.sin(rightAngle)) < 0.0001) return 0
  return Math.tan(leftAngle / 2) / (Math.tan(rightAngle / 2) + Math.tan(leftAngle / 2))
}

export const getSegmentLengthsPerCorner = (corners: Vector2[], defaultRadius: number | undefined) => {
  const edgeVecs = corners.slice(1).map((v, i) => v.clone().sub(corners[i]))
  const edgeLengths = edgeVecs.map((v) => v.length())
  const anglesBetweenEdges = edgeVecs.slice(1).map((v, i) => Math.PI - Math.abs(v.angleTo(edgeVecs[i])))
  const segmentLengths: number[] = []
  for (let i = 0; i < corners.length - 2; i++) {
    if (Math.abs(Math.sin(anglesBetweenEdges[i])) < 0.0001) {
      segmentLengths.push(0)
    } else {
      const previousSegmentLength = segmentLengths[i - 1] ?? 0
      const remainingLength = edgeLengths[i] - previousSegmentLength
      const lengthLimitFromRadius =
        defaultRadius !== undefined
          ? computeMaxSegmentLengthFromAngleAndRadius(anglesBetweenEdges[i], defaultRadius)
          : Infinity
      const circleTangentPt = i > 0 ? computeCircleTangentPt(anglesBetweenEdges[i - 1], anglesBetweenEdges[i]) : 0
      const circleTangentDistance = edgeLengths[i] * circleTangentPt
      segmentLengths.push(
        Math.min(Math.max(circleTangentDistance, remainingLength), edgeLengths[i + 1], lengthLimitFromRadius),
      )
      if (i > 0) segmentLengths[i - 1] = Math.min(edgeLengths[i] - segmentLengths[i], segmentLengths[i - 1])
    }
  }
  return segmentLengths
}

export const getRadiusPerCorner = (vec2s: Vector2[], defaultRadius: number | undefined) => {
  const segmentLengths = getSegmentLengthsPerCorner(vec2s, defaultRadius)
  const radiusPerInternalCorner = computeRadiusPerInternalCornerFromSegmentLengths(vec2s, segmentLengths)
  return [0, ...radiusPerInternalCorner, 0]
}

export function insertUpdatedRadius(
  corners: Vector2[],
  prevRadiusPerInternalCorner: number[],
  updateIdx: number,
  updatedRadius: number,
) {
  const edgeVecs = corners.slice(1).map((v, i) => v.clone().sub(corners[i]))
  const edgeLengths = edgeVecs.map((v) => v.length())
  const anglesBetweenEdges = edgeVecs.slice(1).map((v, i) => Math.PI - Math.abs(v.angleTo(edgeVecs[i])))
  const segmentLengthPerInternalCorner = prevRadiusPerInternalCorner.map((r, i) =>
    computeMaxSegmentLengthFromAngleAndRadius(anglesBetweenEdges[i], r),
  )
  const internalCornersIdx = updateIdx - 1
  const targetSegmentLength = computeMaxSegmentLengthFromAngleAndRadius(
    anglesBetweenEdges[internalCornersIdx],
    updatedRadius,
  )
  const segmentLength = Math.min(targetSegmentLength, edgeLengths[updateIdx - 1], edgeLengths[updateIdx])
  const newSegmentLengths = [...segmentLengthPerInternalCorner]
  newSegmentLengths[internalCornersIdx] = segmentLength
  // Update segment length at previous index if there's no longer space for it's current segment length
  if (internalCornersIdx > 0)
    newSegmentLengths[internalCornersIdx - 1] = Math.min(
      edgeLengths[internalCornersIdx] - segmentLength,
      newSegmentLengths[internalCornersIdx - 1],
    )
  // Update segment length at next index if there's no longer space for it's current segment length
  if (internalCornersIdx < newSegmentLengths.length - 1)
    newSegmentLengths[internalCornersIdx + 1] = Math.min(
      edgeLengths[internalCornersIdx + 1] - segmentLength,
      newSegmentLengths[internalCornersIdx + 1],
    )
  return newSegmentLengths.map((l, i) => computeRadiusFromAngleAndSegmentLength(anglesBetweenEdges[i], l))
}

export function computeRadiusPerInternalCornerFromSegmentLengths(
  corners: Vector2[],
  segmentLengthPerInternalCorner: number[],
) {
  const edgeVecs = corners.slice(1).map((v, i) => v.clone().sub(corners[i]))
  const anglesBetweenEdges = edgeVecs.slice(1).map((v, i) => Math.PI - Math.abs(v.angleTo(edgeVecs[i])))
  return segmentLengthPerInternalCorner.map((l, i) => computeRadiusFromAngleAndSegmentLength(anglesBetweenEdges[i], l))
}

export function getRadiusPerCornerWithPointUpdate(
  corners: Vector2[],
  radiusPerInternalCorner: number[],
  updateIdx: number,
) {
  const edgeVecs = corners.slice(1).map((v, i) => v.clone().sub(corners[i]))
  const edgeLengths = edgeVecs.map((v) => v.length())
  const anglesBetweenEdges = edgeVecs.slice(1).map((v, i) => Math.PI - Math.abs(v.angleTo(edgeVecs[i])))
  const segmentLengthsFromRadii = radiusPerInternalCorner.map((r, i) =>
    computeMaxSegmentLengthFromAngleAndRadius(anglesBetweenEdges[i], r),
  )
  const internalCornersIdx = updateIdx - 1
  let segmentLengthForUpdatedCorner = Math.min(
    edgeLengths[internalCornersIdx],
    edgeLengths[internalCornersIdx + 1],
    segmentLengthsFromRadii[internalCornersIdx],
  )
  const updatedSegmentLengths = [...segmentLengthsFromRadii]
  if (internalCornersIdx > 0) {
    const newLeftAngle = anglesBetweenEdges[internalCornersIdx - 1]
    const newEdgeLength = edgeLengths[internalCornersIdx]
    // Find maximum space left for segment length of previous curve
    const maxLeftSegmentLength = Math.min(
      newEdgeLength,
      edgeLengths[internalCornersIdx - 1] - (segmentLengthsFromRadii[internalCornersIdx - 2] ?? 0),
    )
    // Previous curve's radius is same as before if there is space for it's segment length, otherwise recalculated from available segment length
    const radiusLeft = Math.min(
      computeRadiusFromAngleAndSegmentLength(newLeftAngle, maxLeftSegmentLength),
      radiusPerInternalCorner[internalCornersIdx - 1],
    )
    // Update segment length of previous curve, with numerical precision offset from edge length
    updatedSegmentLengths[internalCornersIdx - 1] = Math.min(
      computeMaxSegmentLengthFromAngleAndRadius(newLeftAngle, radiusLeft),
      newEdgeLength - 1e-8,
    )
    // Segment length for update corner is potentially reduced by segment length of previous curve
    segmentLengthForUpdatedCorner = Math.min(
      newEdgeLength - updatedSegmentLengths[internalCornersIdx - 1],
      segmentLengthForUpdatedCorner,
    )
  }
  if (internalCornersIdx < updatedSegmentLengths.length - 1) {
    const newRightAngle = anglesBetweenEdges[updateIdx]
    const newEdgeLength = edgeLengths[updateIdx]
    // Find maximum space left for segment length of next curve
    const maxRightSegmentLength = Math.min(
      newEdgeLength,
      edgeLengths[internalCornersIdx + 2] - (segmentLengthsFromRadii[internalCornersIdx + 2] ?? 0),
    )
    // Next curve's radius is same as before if there is space for it's segment length, otherwise recalculated from available segment length
    const radiusRight = Math.min(
      computeRadiusFromAngleAndSegmentLength(newRightAngle, maxRightSegmentLength),
      radiusPerInternalCorner[internalCornersIdx + 1],
    )
    // Update segment length of next curve, with numerical precision offset from edge length
    updatedSegmentLengths[internalCornersIdx + 1] = Math.min(
      computeMaxSegmentLengthFromAngleAndRadius(newRightAngle, radiusRight),
      newEdgeLength - 1e-8,
    )
    // Segment length for update corner is potentially reduced by segment length of next curve
    segmentLengthForUpdatedCorner = Math.min(
      segmentLengthForUpdatedCorner,
      newEdgeLength - updatedSegmentLengths[internalCornersIdx + 1],
    )
  }
  if (internalCornersIdx >= 0 && internalCornersIdx < updatedSegmentLengths.length)
    updatedSegmentLengths[internalCornersIdx] = segmentLengthForUpdatedCorner
  const ret = [0, ...computeRadiusPerInternalCornerFromSegmentLengths(corners, updatedSegmentLengths), 0]
  return ret
}

export function getRadiusPerCornerWithPointInsert(
  corners: Vector2[],
  radiusPerInternalCorner: number[],
  insertIdx: number,
  insertedPoint: Vector2,
) {
  const newCorners = corners.toSpliced(insertIdx, 0, insertedPoint)
  const initRadiusPerInternalCorner = radiusPerInternalCorner.toSpliced(insertIdx - 1, 0, 0)
  return getRadiusPerCornerWithPointUpdate(newCorners, initRadiusPerInternalCorner, insertIdx)
}

export function getRadiusPerCornerWithPointDelete(
  corners: Vector2[],
  radiusPerInternalCorner: number[],
  deleteIdx: number,
) {
  const newCorners = corners.toSpliced(deleteIdx, 1)
  const initRadiusPerInternalCorner = radiusPerInternalCorner.toSpliced(Math.max(deleteIdx - 1, 0), 1)
  const updateIdx = Math.min(deleteIdx, corners.length - 1)
  return getRadiusPerCornerWithPointUpdate(newCorners, initRadiusPerInternalCorner, updateIdx)
}

export function getRadiusPerCornerWithRadiusUpdate(
  corners: Vector2[],
  radiusPerInternalCorner: number[],
  updateIdx: number,
  updatedRadius: number,
) {
  return insertUpdatedRadius(corners, radiusPerInternalCorner, updateIdx, updatedRadius)
}
