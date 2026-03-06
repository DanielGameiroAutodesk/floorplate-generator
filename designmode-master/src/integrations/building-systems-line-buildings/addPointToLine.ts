import { v4 as uuidv4 } from "uuid"
import { Vector3 } from "three"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import {
  getDistBetweenPoints,
  getDistFromPointToLine,
  getUnitVectorXY,
} from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"
import type { GraphZ } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"

const AddPointSnapDistPixelsSpace = 10

type Point = { x: number; y: number }
function findPointOnLine(startPoint: Point, endPoint: Point, point: Point) {
  const unit = getUnitVectorXY(startPoint, endPoint)

  const edgeLength = getDistBetweenPoints(startPoint, endPoint)

  const sUnCapped = (point.x - startPoint.x) * unit.x + (point.y - startPoint.y) * unit.y
  const s = Math.max(Math.min(sUnCapped, edgeLength), 0)
  const x = unit.x * s + startPoint.x
  const y = unit.y * s + startPoint.y
  return { x, y }
}

function getEdgeUnSectioned(transSideGraph: GraphZ, point: { x: number; y: number }) {
  const edges = Object.values(transSideGraph.edges)
  let minDistToEdge = Infinity
  let closestEdge
  for (let edge of edges) {
    const startVertex = transSideGraph.vertices[edge.start]
    const endVertex = transSideGraph.vertices[edge.end]
    const distToEdge = getDistFromPointToLine(startVertex, endVertex, point)
    if (distToEdge < minDistToEdge) {
      minDistToEdge = distToEdge
      closestEdge = edge
    }
  }
  return closestEdge
}

function getEdge(edgeVertexID: string, transSideGraph: GraphZ, point: { x: number; y: number }) {
  const edge = transSideGraph.edges[edgeVertexID]
  if (edge) return edge
  const vertex = transSideGraph.vertices[edgeVertexID]
  if (!vertex) return undefined
  const edges = Object.values(transSideGraph.edges).filter((edge) => edge.end === vertex.id || edge.start === vertex.id)
  let minDistToEdge = Infinity
  let closestEdge
  for (let edge of edges) {
    const startVertex = transSideGraph.vertices[edge.start]
    const endVertex = transSideGraph.vertices[edge.end]
    const distToEdge = getDistFromPointToLine(startVertex, endVertex, point)
    if (distToEdge < minDistToEdge) {
      minDistToEdge = distToEdge
      closestEdge = edge
    }
  }
  return closestEdge
}

export type AddPointData = {
  newVertex: { x: number; y: number; z: number; id: string }
  edgeID: string
  snappedToVertex?: string | undefined
}

function getAddPointToLinePointSectioned(
  hitTarget: any,
  transSideGraph: GraphZ,
  parameters: any,
): AddPointData | undefined {
  const sectionId = hitTarget[0]?.object?.name
  const hitPoint = hitTarget[0]?.point
  if (!sectionId || !hitPoint) return undefined
  const sectionProps = parameters.sectionProps[sectionId]
  const edgeVertexID = sectionId.split("::")[0]
  const edge = getEdge(edgeVertexID, transSideGraph, hitPoint)
  if (!edge) return undefined

  const startVertex = transSideGraph.vertices[edge.start]
  const endVertex = transSideGraph.vertices[edge.end]
  const roofZ = startVertex.z + parameters.floorHeight * sectionProps.numberOfFloors

  if (Math.abs(hitPoint.z - roofZ) > 1e-2) return undefined

  const pointOnLine = findPointOnLine(startVertex, endVertex, hitPoint)

  const SnapDist = pixelsToMetersAtPositionStatic(
    AddPointSnapDistPixelsSpace,
    new Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
  )
  const distToStart = getDistBetweenPoints(startVertex, pointOnLine)
  const distToEnd = getDistBetweenPoints(endVertex, pointOnLine)
  if (distToStart < SnapDist) {
    const newVertex = { x: startVertex.x, y: startVertex.y, z: roofZ, id: uuidv4() }
    return {
      edgeID: edge.id,
      newVertex,
      snappedToVertex: startVertex.id,
    }
  }
  if (distToEnd < SnapDist) {
    const newVertex = { x: endVertex.x, y: endVertex.y, z: roofZ, id: uuidv4() }
    return {
      edgeID: edge.id,
      newVertex,
      snappedToVertex: endVertex.id,
    }
  }

  const newVertex = { x: pointOnLine.x, y: pointOnLine.y, z: roofZ, id: uuidv4() }
  return { edgeID: edge.id, newVertex: newVertex }
}

function getAddPointToLinePointUnSectioned(
  hitTarget: any,
  transSideGraph: GraphZ,
  parameters: any,
): AddPointData | undefined {
  const { floorHeight, numberOfFloors } = parameters
  const hitBoxName = hitTarget[0]?.object?.name
  const hitPoint = hitTarget[0]?.point
  if (!hitBoxName || !hitPoint) return undefined
  const edge = getEdgeUnSectioned(transSideGraph, hitPoint)
  if (!edge) return undefined

  const startVertex = transSideGraph.vertices[edge.start]
  const endVertex = transSideGraph.vertices[edge.end]
  const roofZ = startVertex.z + floorHeight * numberOfFloors
  if (Math.abs(hitPoint.z - roofZ) > 1e-2) return undefined

  const pointOnLine = findPointOnLine(startVertex, endVertex, hitPoint)
  const newVertex = { x: pointOnLine.x, y: pointOnLine.y, z: roofZ, id: uuidv4() }

  const SnapDist = pixelsToMetersAtPositionStatic(
    AddPointSnapDistPixelsSpace,
    new Vector3(hitPoint.x, hitPoint.y, hitPoint.z),
  )
  const distToStart = getDistBetweenPoints(startVertex, pointOnLine)
  const distToEnd = getDistBetweenPoints(endVertex, pointOnLine)
  if (distToStart < SnapDist) {
    const newVertex = { x: startVertex.x, y: startVertex.y, z: roofZ, id: uuidv4() }
    return {
      edgeID: edge.id,
      newVertex,
      snappedToVertex: startVertex.id,
    }
  }
  if (distToEnd < SnapDist) {
    const newVertex = { x: endVertex.x, y: endVertex.y, z: roofZ, id: uuidv4() }
    return {
      edgeID: edge.id,
      newVertex,
      snappedToVertex: endVertex.id,
    }
  }

  return { edgeID: edge.id, newVertex: newVertex }
}

export function getAddPointToLinePoint(
  hitTarget: any,
  transSideGraph: GraphZ,
  parameters: any,
): AddPointData | undefined {
  if (parameters.sectionToggle) return getAddPointToLinePointSectioned(hitTarget, transSideGraph, parameters)
  return getAddPointToLinePointUnSectioned(hitTarget, transSideGraph, parameters)
}

////
//
///

export function getUpdatedGraphOnAddingPoint(
  graph: GraphZ,
  pointToAdd: { edgeID: string; newVertex: { x: number; y: number } },
) {
  const { edgeID, newVertex } = pointToAdd
  const newVertexID = uuidv4()
  const edge = graph.edges[edgeID]

  const vertices: Record<string, GraphVertex> = { ...graph.vertices }
  vertices[newVertexID] = { id: newVertexID, x: newVertex.x, y: newVertex.y }

  const edges: Record<string, GraphEdge> = {}
  for (let edge of Object.values(graph.edges)) {
    if (edge.id === edgeID) continue
    edges[edge.id] = edge
  }
  const newEdgeOneID = edge.id
  const newEdgeTwoID = uuidv4()
  edges[newEdgeOneID] = { id: newEdgeOneID, start: edge.start, end: newVertexID }
  edges[newEdgeTwoID] = { id: newEdgeTwoID, start: newVertexID, end: edge.end }

  return { edges, vertices }
}
