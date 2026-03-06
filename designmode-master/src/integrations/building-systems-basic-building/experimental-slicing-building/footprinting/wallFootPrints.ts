import type {
  Edge,
  Graph,
  Vertex,
  VertexEdgeMap,
} from "src/integrations/building-systems-basic-building/lib/graph/graph"
import { getAngleXY } from "src/integrations/building-systems-common/geometryHelpers"

function getAngleShift(angle: number, wallThickness: number, otherWallThickness: number) {
  const absAngle = Math.abs(angle)
  if (absAngle < 1e-8) return 0
  if (angle >= Math.PI / 2) {
    const dist1 = otherWallThickness / Math.cos(absAngle - Math.PI / 2)
    const dist2 = wallThickness / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  if (angle <= -Math.PI / 2) {
    const dist1 = otherWallThickness / Math.cos(absAngle - Math.PI / 2)
    const dist2 = wallThickness / Math.tan(Math.PI - absAngle)
    return -(dist1 + dist2)
  }
  const shift = (otherWallThickness - wallThickness * Math.cos(absAngle)) / Math.sin(absAngle)

  if (Math.abs(angle) > (1 / 6) * Math.PI) {
    return angle > 0 ? shift : -shift
  }

  if (wallThickness >= otherWallThickness) {
    return otherWallThickness < wallThickness * Math.cos(absAngle) ? 0 : Math.abs(shift)
  } else {
    if (wallThickness >= otherWallThickness * Math.cos(absAngle)) return Math.abs(shift)
    return 0.5 * wallThickness * Math.tan(absAngle)
  }
}

type OtherEdgeData = {
  angle: number
  otherVertex: Vertex
  otherEdge: Edge
  otherSide: "left" | "right"
}

export type WallShifts = {
  v0LeftShift: number
  v0RightShift: number
  v1LeftShift: number
  v1RightShift: number
}
export function getWallShifts(
  edge: Edge,
  graph: Graph,
  vertexEdgeMap: VertexEdgeMap,
  wallThickness: { left: number; right: number },
  edgeThicknessMap: Record<string, { left: number; right: number }>,
): WallShifts {
  const v0 = graph.vertices[edge.start]
  const v1 = graph.vertices[edge.end]

  let v0Leftmost: OtherEdgeData | undefined = undefined
  let v0Rightmost: OtherEdgeData | undefined = undefined
  for (const otherEdgeId of vertexEdgeMap[v0.id]) {
    if (otherEdgeId === edge.id) continue
    const otherEdge = graph.edges[otherEdgeId]
    const otherVertexId = otherEdge.start === v0.id ? otherEdge.end : otherEdge.start
    const otherVertex = graph.vertices[otherVertexId]

    const angle = getAngleXY(otherVertex, v0, v1)

    if (v0Leftmost === undefined || v0Leftmost.angle < angle) {
      const otherSide = otherVertexId === otherEdge.start ? "left" : "right"
      v0Leftmost = { angle, otherVertex, otherEdge, otherSide }
    }
    if (v0Rightmost === undefined || v0Rightmost.angle > angle) {
      const otherSide = otherVertexId === otherEdge.start ? "right" : "left"
      v0Rightmost = { angle, otherVertex, otherEdge, otherSide }
    }
  }

  const v0LeftShift = v0Leftmost
    ? getAngleShift(
        v0Leftmost.angle,
        wallThickness.left,
        edgeThicknessMap[v0Leftmost.otherEdge.id][v0Leftmost.otherSide],
      )
    : 0
  const v0RightShift = v0Rightmost
    ? getAngleShift(
        -v0Rightmost.angle,
        wallThickness.right,
        edgeThicknessMap[v0Rightmost.otherEdge.id][v0Rightmost.otherSide],
      )
    : 0

  let v1Leftmost: OtherEdgeData | undefined = undefined
  let v1Rightmost: OtherEdgeData | undefined = undefined
  for (const otherEdgeId of vertexEdgeMap[v1.id]) {
    if (otherEdgeId === edge.id) continue
    const otherEdge = graph.edges[otherEdgeId]
    const otherVertexId = otherEdge.start === v1.id ? otherEdge.end : otherEdge.start
    const otherVertex = graph.vertices[otherVertexId]

    const angle = getAngleXY(otherVertex, v1, v0)

    if (v1Leftmost === undefined || v1Leftmost.angle > angle) {
      const otherSide = otherVertexId === otherEdge.end ? "left" : "right"
      v1Leftmost = { angle, otherVertex, otherEdge, otherSide }
    }
    if (v1Rightmost === undefined || v1Rightmost.angle < angle) {
      const otherSide = otherVertexId === otherEdge.end ? "right" : "left"
      v1Rightmost = { angle, otherVertex, otherEdge, otherSide }
    }
  }

  const v1LeftShift = v1Leftmost
    ? getAngleShift(
        v1Leftmost.angle,
        wallThickness.left,
        edgeThicknessMap[v1Leftmost.otherEdge.id][v1Leftmost.otherSide],
      )
    : 0
  const v1RightShift = v1Rightmost
    ? getAngleShift(
        -v1Rightmost.angle,
        wallThickness.right,
        edgeThicknessMap[v1Rightmost.otherEdge.id][v1Rightmost.otherSide],
      )
    : 0

  return { v0LeftShift, v0RightShift, v1LeftShift, v1RightShift }
}

export function getWallSideThicknessMap(
  outerAndInnerEdgeMap: any,
  outerWallThickness: number,
  innerWallThickness: number,
  graph: Graph,
) {
  const edgeThicknessMap: Record<string, { left: number; right: number }> = {}
  for (const edge of Object.values(graph.edges)) {
    const insideOutside = outerAndInnerEdgeMap[edge.id]
    if (insideOutside.right && insideOutside.left) {
      const thickness = innerWallThickness
      edgeThicknessMap[edge.id] = {
        left: 0.5 * thickness,
        right: 0.5 * thickness,
      }
    } else if (insideOutside.left) {
      edgeThicknessMap[edge.id] = {
        left: outerWallThickness,
        right: 0,
      }
    } else if (insideOutside.right) {
      edgeThicknessMap[edge.id] = {
        left: 0,
        right: outerWallThickness,
      }
    } else {
      const thickness = outerWallThickness
      edgeThicknessMap[edge.id] = {
        left: 0.5 * thickness,
        right: 0.5 * thickness,
      }
    }
  }
  return edgeThicknessMap
}
