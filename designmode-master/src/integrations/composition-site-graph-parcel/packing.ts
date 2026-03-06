import { Line3, Matrix4, Vector3 } from "three"
import { lineIntersect } from "src/integrations/composition-site-graph/graph/utils/lineIntersection"
import type { Graph, Loop } from "src/integrations/composition-site-graph/graph/types"
import { _getCoEdgeDirection, _getCoEdgeVertices } from "src/integrations/composition-site-graph/graph/coEdge"
import type { ParcelGraphParameters } from "./parameters"
import type { Dimensions, Transform } from "src/integrations/composition-site-graph/graph-element/types"

export type PackingParcel = {
  length: number
  depth: number
  transform: Matrix4
}

export function getCollisionPointsFromLines(segments: Line3[], depth: number): Vector3[] {
  const points: Vector3[] = []
  for (const segment of segments) {
    const a = segment.start
    const b = segment.end
    if (a.y > -depth && a.y < 0) points.push(a)
    if (b.y > -depth && b.y < 0) points.push(b)
    const intersection1 = lineIntersect(a.x, a.y, b.x, b.y, 0, 0, 1, 0)
    const intersection2 = lineIntersect(a.x, a.y, b.x, b.y, 0, -depth, 1, -depth)
    if (intersection1?.seg1) points.push(new Vector3(intersection1.x, intersection1.y))
    if (intersection2?.seg1) points.push(new Vector3(intersection2.x, intersection2.y))
  }
  return points
}
export function getParcelFrontRight<T extends Dimensions & Transform>(parcel: T): Vector3 {
  return new Vector3(parcel.width / 2, -parcel.depth / 2).applyMatrix4(parcel.transform)
}

export function getParcelFrontLeft<T extends Dimensions & Transform>(parcel: T): Vector3 {
  return new Vector3(-parcel.width / 2, -parcel.depth / 2).applyMatrix4(parcel.transform)
}

export function getParcelBackRight<T extends Dimensions & Transform>(parcel: T): Vector3 {
  return new Vector3(parcel.width / 2, parcel.depth / 2).applyMatrix4(parcel.transform)
}

export function getParcelBackLeft<T extends Dimensions & Transform>(parcel: T): Vector3 {
  return new Vector3(-parcel.width / 2, parcel.depth / 2).applyMatrix4(parcel.transform)
}

function normalizedAngleDeviation(fromAngle: number, toAngle: number, maxDeviation: number): number {
  const deviation = Math.atan2(Math.sin(toAngle - fromAngle), Math.cos(toAngle - fromAngle))
  return Math.max(-maxDeviation, Math.min(maxDeviation, deviation))
}

export function getParcelDeviation(parameters: ParcelGraphParameters, coEdgeDirection: number): number {
  const orientationParameter = (parameters.orientation * Math.PI) / 180
  const rowHouseOrientation = orientationParameter + (parameters.relativeOrientation ? coEdgeDirection : 0)
  return normalizedAngleDeviation(rowHouseOrientation, coEdgeDirection, Math.PI - Math.PI / 6)
}

export function coEdgeOffset(graph: Graph, coEdgeId: string): number {
  const coEdge = graph._coEdges[coEdgeId]
  const roadWidth = (graph._edges[coEdge.edgeId].properties?.road?.width ?? 0) / 2
  const buffer = coEdge.properties?.parcelParameters?.buffer ?? 0
  const offset = buffer ?? roadWidth ?? 0
  return offset
}

export function getOffsetLine(graph: Graph, coEdgeId: string): Line3 {
  const offset = coEdgeOffset(graph, coEdgeId)
  const roadDirection = _getCoEdgeDirection(graph, coEdgeId)
  const centerToRoadsideVector = new Vector3(
    offset * Math.cos(roadDirection - Math.PI / 2),
    offset * Math.sin(roadDirection - Math.PI / 2),
  )
  const { start, end } = _getCoEdgeVertices(graph, coEdgeId)
  const vertexStart = graph._vertices[start]
  const vertexEnd = graph._vertices[end]
  return new Line3(
    new Vector3(vertexStart.x, vertexStart.y, 0).add(centerToRoadsideVector),
    new Vector3(vertexEnd.x, vertexEnd.y, 0).add(centerToRoadsideVector),
  )
}

export function getRoadsideMatrix(
  startX: number,
  startY: number,
  direction: number,
  roadOffset: number,
  trimBefore: number,
  orientationDeviation: number,
  shearInsteadOfRotating: boolean = false,
): Matrix4 {
  const step1 = new Matrix4().makeTranslation(startX, startY, 0)
  const step2 = new Matrix4().makeRotationZ(direction)
  const step3 = new Matrix4().makeTranslation(trimBefore, -roadOffset, 0)
  const step4 = shearInsteadOfRotating
    ? new Matrix4().makeShear(0, 0, Math.tan(orientationDeviation), 0, 0, 0)
    : new Matrix4().makeRotationZ(-orientationDeviation)
  return new Matrix4().multiply(step1).multiply(step2).multiply(step3).multiply(step4)
}

export function getLoopStartIndex(graph: Graph, loop: Loop): number {
  // To find the starting point for parcel placement around the loop, we pick the coedge
  // with the lowest id where we flip from _not_ having rowhouses to _having_ rowhouses.
  // If all/no coedges have rowhouses, pick the lowest id
  const idsToIndices = Object.fromEntries(loop.coEdgeIds.map((id, index) => [id, index]))
  const sortedIds = Array.from(loop.coEdgeIds)
  sortedIds.sort()
  let startIndex = -1
  for (const currentCoEdgeId of sortedIds) {
    const i = idsToIndices[currentCoEdgeId]
    const incomingCoEdgeId = loop.coEdgeIds[(i - 1 + loop.coEdgeIds.length) % loop.coEdgeIds.length]
    const incomingRowHouse = !!graph._coEdges[incomingCoEdgeId]?.properties?.parcelParameters
    const currentRowHouse = !!graph._coEdges[currentCoEdgeId]?.properties?.parcelParameters
    if (!incomingRowHouse && currentRowHouse && (startIndex === -1 || currentCoEdgeId < loop.coEdgeIds[startIndex])) {
      startIndex = i
    }
  }
  if (startIndex === -1 && sortedIds.length > 0) {
    startIndex = idsToIndices[sortedIds[0]]
  }
  return startIndex
}

export function calculateGlobalTransform(
  getElevation: (x: number, y: number) => number,
  areaTransform: Matrix4,
  localTransform: Matrix4,
): Matrix4 {
  const globalTransform = new Matrix4().multiply(areaTransform).multiply(localTransform)

  const v = new Vector3().applyMatrix4(globalTransform)
  const elevation = getElevation(v.x, v.y)

  const elevationTranslation = new Matrix4().makeTranslation(0, 0, elevation)
  globalTransform.multiply(elevationTranslation)

  return globalTransform
}
