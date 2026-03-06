import {
  distance,
  getAngle,
  getNeighbourEdgeProps,
  getNormVector,
  getPullBackDistance,
  getRelativeEdgeProps,
  removeDegeneratePoints,
} from "./helpers.js"
import { movePointAlongVector } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { getOuterWalls } from "./floorPlans.js"

const CORE_LONG_SIDE = 6
const APT_WIDTH = 6
const MIN_CORNER_TO_CORNER_DIST = 6
const MIN_TEMPLATE_LENGTH = 12

function getMultiCornerGeometry(corner, vertices) {
  const { vertex, edges } = corner
  const center = [vertex.x, vertex.y]
  const legs = edges
    .map((e) => getRelativeEdgeProps(e, vertices, vertex.id))
    .sort((a, b) => Math.atan2(a.direction[1], a.direction[0]) - Math.atan2(b.direction[1], b.direction[0]))

  const angles = legs.map((leg, i) => {
    const neighbour = legs[(i + 1) % legs.length]
    const signedAngle = getAngle(leg.point, center, neighbour.point)
    return signedAngle < 0 ? signedAngle + Math.PI * 2 : signedAngle
  })
  if (angles.some((a) => a < Math.PI / 6)) return null

  const leftPullbackDistances = legs.map((leg, i) => {
    const neighbour = legs[(i - 1 + legs.length) % legs.length]
    const angle = -getAngle(leg.point, center, neighbour.point)
    return getPullBackDistance(angle, leg.width, neighbour.width)
  })
  const rightPullbackDistances = legs.map((leg, i) => {
    const neighbour = legs[(i + 1) % legs.length]
    const angle = getAngle(leg.point, center, neighbour.point)
    return getPullBackDistance(angle, leg.width, neighbour.width)
  })

  let centerPoly = []
  const edgePullback = {}
  for (let i = 0; i < legs.length; i++) {
    const activePullBack = Math.max(leftPullbackDistances[i], rightPullbackDistances[i])
    if (activePullBack > legs[i].length || activePullBack > 25) return null
    edgePullback[legs[i].edgeId] = activePullBack
    const legLeftCorner = movePointAlongVector(center, legs[i].normal, -legs[i].width / 2)
    const legLeftPoint = movePointAlongVector(legLeftCorner, legs[i].direction, activePullBack)
    centerPoly.push(legLeftPoint)
    const legRightCorner = movePointAlongVector(center, legs[i].normal, legs[i].width / 2)
    const legRightPoint = movePointAlongVector(legRightCorner, legs[i].direction, activePullBack)
    centerPoly.push(legRightPoint)
  }

  return { polygon: centerPoly, edgePullback }
}

function getTwoEdgeCornerMinPullback(corner, edgeId, vertices) {
  const center = [corner.vertex.x, corner.vertex.y]
  const first = getRelativeEdgeProps(corner.edges[0], vertices, corner.vertex.id)
  const second = getRelativeEdgeProps(corner.edges[1], vertices, corner.vertex.id)

  const signedAngle = getAngle(first.point, center, second.point)
  const angle = Math.abs(signedAngle)
  if (angle > Math.PI * (2 / 3)) return null
  if (angle < Math.PI / 6) return null

  const left = signedAngle > 0 ? second : first
  const right = signedAngle > 0 ? first : second

  const leftPullback = getPullBackDistance(angle, left.width, right.width)
  const rightPullback = getPullBackDistance(angle, right.width, left.width)

  const leftHanded = left.width <= right.width
  const minLeftLegLength = leftHanded ? 0 : Math.max(0, CORE_LONG_SIDE * Math.cos(Math.PI - angle))
  const minRightLegLength = leftHanded ? Math.max(0, CORE_LONG_SIDE * Math.cos(Math.PI - angle)) : 0

  return left.edgeId === edgeId ? leftPullback + minLeftLegLength : rightPullback + minRightLegLength
}

function getNeighbours(edge, vertices, edges) {
  const left = Object.values(edges)
    .map((e) => {
      if (e.id !== edge.id && e.start === edge.start) {
        return [[vertices[e.end].x, vertices[e.end].y], e]
      } else if (e.id !== edge.id && e.end === edge.start) {
        return [[vertices[e.start].x, vertices[e.start].y], e]
      } else {
        return null
      }
    })
    .filter((e) => e)
  const right = Object.values(edges)
    .map((e) => {
      if (e.id !== edge.id && e.start === edge.end) {
        return [[vertices[e.end].x, vertices[e.end].y], e]
      } else if (e.id !== edge.id && e.end === edge.end) {
        return [[vertices[e.start].x, vertices[e.start].y], e]
      } else {
        return null
      }
    })
    .filter((e) => e)
  return { leftNeighbours: left, rightNeighbours: right }
}

function clip(edge, minLength, vertices, leftNeighbours, rightNeighbours, cornerSections) {
  const start = [vertices[edge.start].x, vertices[edge.start].y]
  const end = [vertices[edge.end].x, vertices[edge.end].y]
  const leftCornerNeighbour = cornerSections.find((section) => section.vertex.id === edge.start)
  const rightCornerNeighbour = cornerSections.find((section) => section.vertex.id === edge.end)
  const { effectiveLength, startOffset } = getLengthAndOffset(
    start,
    end,
    cornerSections,
    edge,
    leftCornerNeighbour,
    rightCornerNeighbour,
  )

  if (effectiveLength < 0.1) return []

  const numEdges = Math.max(Math.floor(effectiveLength / minLength), 1)
  const clipLength = effectiveLength / numEdges
  const vec = getNormVector(start, end)
  const sections = Array(numEdges)
    .fill(0)
    .map((_, i) => {
      const _start = [
        start[0] + vec[0] * (clipLength * i + startOffset),
        start[1] + vec[1] * (clipLength * i + startOffset),
      ]
      const _end = [
        start[0] + vec[0] * (clipLength * (i + 1) + startOffset),
        start[1] + vec[1] * (clipLength * (i + 1) + startOffset),
      ]
      return [_start, _end]
    })
    .map(([_start, _end], i, clipped) => {
      const _left = i === 0 ? leftNeighbours : (clipped[i - 1] && [[clipped[i - 1][0], edge]]) || []
      const _right = i === numEdges - 1 ? rightNeighbours : (clipped[i + 1] && [[clipped[i + 1][0], edge]]) || []
      return getOuterWalls(
        leftCornerNeighbour ? [] : _left,
        _start,
        _end,
        rightCornerNeighbour ? [] : _right,
        edge.width,
      )
    })

  const { startWall, endWall } = getOuterWalls(
    leftCornerNeighbour ? [] : leftNeighbours,
    [start[0] + vec[0] * startOffset, start[1] + vec[1] * startOffset],
    [
      start[0] + vec[0] * (clipLength * numEdges + startOffset),
      start[1] + vec[1] * (clipLength * numEdges + startOffset),
    ],
    rightCornerNeighbour ? [] : rightNeighbours,
    edge.width,
  )

  return { exteriorPolygon: [...startWall, ...endWall.map((_, i) => endWall[endWall.length - i - 1])], sections }
}

function getLengthAndOffset(start, end, cornerSections, edge, leftCornerNeighbour, rightCornerNeighbour) {
  let effectiveLength = distance(start, end)
  let startOffset = 0

  if (leftCornerNeighbour) {
    const offset = leftCornerNeighbour.edgePullback[edge.id]
    effectiveLength = effectiveLength - offset
    startOffset = offset
  }
  if (rightCornerNeighbour) {
    const offset = rightCornerNeighbour.edgePullback[edge.id]
    effectiveLength = effectiveLength - offset
  }
  effectiveLength = Math.max(effectiveLength, 0)
  return { effectiveLength, startOffset }
}

export function getOldCornerSections(edges, vertices) {
  const corners = Object.values(vertices).map((v) => ({
    vertex: v,
    edges: Object.values(edges).filter((e) => e.start === v.id || e.end === v.id),
  }))

  const multiCornerSections = corners
    .filter((corner) => corner.edges.length > 2)
    .map((corner) => {
      const result = getMultiCornerGeometry(corner, vertices)
      if (result) {
        const { polygon, edgePullback } = result
        return {
          exteriorPolygon: removeDegeneratePoints(polygon),
          vertex: corner.vertex,
          edgePullback,
        }
      }
      return {
        exteriorPolygon: null,
        vertex: corner.vertex,
        edgePullback: null,
      }
    })

  const twoEdgeCorners = corners.filter((corner) => corner.edges.length === 2)
  const twoCornerSections = twoEdgeCorners.map((corner) => {
    const { center, right, left, angle } = getNeighbourEdgeProps(edges, vertices, corner.vertex.id)
    if (angle > Math.PI * (2 / 3)) return null
    if (angle < Math.PI / 6) return null

    const leftHanded = left.width <= right.width
    const minLeftLegLength = leftHanded ? 0 : Math.max(0, CORE_LONG_SIDE * Math.cos(Math.PI - angle))
    const minRightLegLength = leftHanded ? Math.max(0, CORE_LONG_SIDE * Math.cos(Math.PI - angle)) : 0

    const rightPullback = getPullBackDistance(angle, right.width, left.width)
    const leftPullback = getPullBackDistance(angle, left.width, right.width)
    if (rightPullback + minRightLegLength > right.length || leftPullback + minLeftLegLength > left.length) {
      return null
    }

    const leftMultiCorner = multiCornerSections.find((c) => c.vertex.id === left.otherVertexId)
    const leftTwoEdgeCorner = twoEdgeCorners.find((c) => c.vertex.id === left.otherVertexId)
    const leftLegFarPullback =
      leftMultiCorner && leftMultiCorner.exteriorPolygon
        ? leftMultiCorner.edgePullback[left.edgeId]
        : leftTwoEdgeCorner
          ? getTwoEdgeCornerMinPullback(leftTwoEdgeCorner, left.edgeId, vertices)
          : 0
    const leftEdgeMaxLength = left.length - leftPullback - leftLegFarPullback - minLeftLegLength
    if ((leftMultiCorner || leftTwoEdgeCorner) && leftEdgeMaxLength < MIN_CORNER_TO_CORNER_DIST) {
      return null
    }

    const rightMultiCorner = multiCornerSections.find((c) => c.vertex.id === right.otherVertexId)
    const rightTwoEdgeCorner = twoEdgeCorners.find((c) => c.vertex.id === right.otherVertexId)
    const rightLegFarPullback =
      rightMultiCorner && rightMultiCorner.exteriorPolygon
        ? rightMultiCorner.edgePullback[right.edgeId]
        : rightTwoEdgeCorner
          ? getTwoEdgeCornerMinPullback(rightTwoEdgeCorner, right.edgeId, vertices)
          : 0
    const rightEdgeMaxLength = right.length - rightPullback - rightLegFarPullback - minRightLegLength
    if ((rightMultiCorner || rightTwoEdgeCorner) && rightEdgeMaxLength < MIN_CORNER_TO_CORNER_DIST) {
      return null
    }

    let leftLegLength =
      APT_WIDTH > left.length - (minLeftLegLength + leftPullback)
        ? left.length - leftPullback
        : leftEdgeMaxLength > MIN_TEMPLATE_LENGTH && leftEdgeMaxLength - APT_WIDTH < MIN_TEMPLATE_LENGTH
          ? minLeftLegLength
          : minLeftLegLength + APT_WIDTH
    if (leftTwoEdgeCorner) {
      leftLegLength =
        leftEdgeMaxLength < MIN_TEMPLATE_LENGTH
          ? minLeftLegLength + leftEdgeMaxLength / 2
          : leftEdgeMaxLength - 2 * APT_WIDTH < MIN_TEMPLATE_LENGTH
            ? minLeftLegLength
            : minLeftLegLength + APT_WIDTH
    }

    let rightLegLength =
      APT_WIDTH > right.length - (minRightLegLength + rightPullback)
        ? right.length - rightPullback
        : rightEdgeMaxLength > MIN_TEMPLATE_LENGTH && rightEdgeMaxLength - APT_WIDTH < MIN_TEMPLATE_LENGTH
          ? minRightLegLength
          : minRightLegLength + APT_WIDTH
    if (rightTwoEdgeCorner) {
      rightLegLength =
        rightEdgeMaxLength < MIN_TEMPLATE_LENGTH
          ? minRightLegLength + rightEdgeMaxLength / 2
          : rightEdgeMaxLength - 2 * APT_WIDTH < MIN_TEMPLATE_LENGTH
            ? minRightLegLength
            : minRightLegLength + APT_WIDTH
    }

    const rightSideLength = Math.min(Math.min(left.width, right.width), 2 * rightPullback) + rightLegLength
    const leftSideLength = Math.min(Math.min(left.width, right.width), 2 * leftPullback) + leftLegLength

    const rightLegMidPoint = movePointAlongVector(center, right.direction, rightPullback + rightLegLength)
    const rightOuterPoint = movePointAlongVector(rightLegMidPoint, right.normal, -right.width / 2)
    const rightInnerPoint = movePointAlongVector(rightLegMidPoint, right.normal, right.width / 2)
    const outerRightCorner = movePointAlongVector(rightOuterPoint, right.direction, -rightSideLength)
    const leftLegMidPoint = movePointAlongVector(center, left.direction, leftPullback + leftLegLength)
    const leftOuterPoint = movePointAlongVector(leftLegMidPoint, left.normal, left.width / 2)
    const leftInnerPoint = movePointAlongVector(leftLegMidPoint, left.normal, -left.width / 2)
    const outerLeftCorner = movePointAlongVector(leftOuterPoint, left.direction, -leftSideLength)
    const innerCorner = movePointAlongVector(
      movePointAlongVector(rightLegMidPoint, right.direction, -rightLegLength),
      right.normal,
      right.width / 2,
    )

    const envelope = [
      innerCorner,
      leftInnerPoint,
      leftOuterPoint,
      outerLeftCorner,
      outerRightCorner,
      rightOuterPoint,
      rightInnerPoint,
      innerCorner,
    ]

    const edgePullback = {}
    edgePullback[left.edgeId] = leftLegLength + leftPullback
    edgePullback[right.edgeId] = rightLegLength + rightPullback

    return {
      exteriorPolygon: envelope,
      vertex: corner.vertex,
      edgePullback,
      leftHanded,
    }
  })
  return twoCornerSections.concat(multiCornerSections).filter((s) => s && s.exteriorPolygon)
}

export function getOldEdgeSections(vertices, edges, cornerSections, minBuildingWith) {
  const res = Object.values(edges).map((edge) => {
    const { leftNeighbours, rightNeighbours } = getNeighbours(edge, vertices, edges)
    return {
      ...clip(
        edge,
        minBuildingWith || edge.minSubBuildingLength || 16,
        vertices,
        leftNeighbours,
        rightNeighbours,
        cornerSections,
      ),
      edge,
    }
  })
  return res.filter(({ sections }) => sections)
}
