import type { Graph, Id, Loop } from "src/integrations/composition-site-graph/graph/types"
import { Line3, Matrix4 } from "three"
import type { ParcelGraphParameters } from "./parameters"
import {
  calculateGlobalTransform,
  getCollisionPointsFromLines,
  getParcelBackLeft,
  getParcelBackRight,
  getParcelDeviation,
  getParcelFrontLeft,
  getParcelFrontRight,
  getRoadsideMatrix,
  getOffsetLine,
  coEdgeOffset,
} from "./packing"
import type { RowHouseGraph } from "src/integrations/composition-site-graph/state"
import {
  _getCoEdgeDirection,
  _getCoEdgeLength,
  _getCoEdgeVertices,
} from "src/integrations/composition-site-graph/graph/coEdge"
import type { Dimensions, Transform, With } from "src/integrations/composition-site-graph/graph-element/types"

function coEdgePriorityScore(graph: Graph, coEdgeId: Id): number {
  return _getCoEdgeLength(graph, coEdgeId)
}

function getCoEdgePriorityOrderForGraphLoop(graph: Graph, loop: Loop): number[] {
  const coEdgeIndices = loop.coEdgeIds.map((_, coEdgeIndex) => coEdgeIndex)
  // Sort in ascending order, so coedges with lower scores will be processed first
  return coEdgeIndices.toSorted(
    (a, b) => coEdgePriorityScore(graph, loop.coEdgeIds[a]) - coEdgePriorityScore(graph, loop.coEdgeIds[b]),
  )
}

function getInitialCollisionLinesForGraphLoop(graph: Graph, loop: Loop) {
  const collisionLinesForCoEdgeLHS: { [id: string]: Line3[] } = Object.fromEntries(loop.coEdgeIds.map((id) => [id, []]))
  const collisionLinesForCoEdgeRHS: { [id: string]: Line3[] } = Object.fromEntries(loop.coEdgeIds.map((id) => [id, []]))
  for (let i = 0; i < loop.coEdgeIds.length; i++) {
    const incomingCoEdgeId = loop.coEdgeIds[(i - 1 + loop.coEdgeIds.length) % loop.coEdgeIds.length]
    const currentCoEdgeId = loop.coEdgeIds[i]
    const outgoingCoEdgeId = loop.coEdgeIds[(i + 1) % loop.coEdgeIds.length]
    const collisionLine = getOffsetLine(graph, currentCoEdgeId)
    const currentEdgeId = graph._coEdges[currentCoEdgeId].edgeId
    if (graph._coEdges[incomingCoEdgeId].edgeId != currentEdgeId) {
      collisionLinesForCoEdgeLHS[incomingCoEdgeId].push(collisionLine)
    }
    if (graph._coEdges[outgoingCoEdgeId].edgeId != currentEdgeId) {
      collisionLinesForCoEdgeRHS[outgoingCoEdgeId].push(collisionLine)
    }
  }
  return { collisionLinesForCoEdgeLHS, collisionLinesForCoEdgeRHS }
}

function getParcelsFromGraphLoop<T>(
  graph: Graph,
  loop: Loop,
  getElevation: (x: number, y: number) => number,
  getDataWithDimensions: (coEdgeId: string, index: number) => With<T, Dimensions> | undefined,
): Record<Id, With<T, Transform & Dimensions>[]> {
  let parcels: Record<Id, With<T, Transform & Dimensions>[]> = {}
  // Create initial collision lines for all coedges according to road width (if any)
  const { collisionLinesForCoEdgeLHS, collisionLinesForCoEdgeRHS } = getInitialCollisionLinesForGraphLoop(graph, loop)
  // Sort the loop's coedges according to the scoring function
  const coEdgeOrder = getCoEdgePriorityOrderForGraphLoop(graph, loop)
  // Next, populate parcels around the loop, in order of priority
  for (const coEdgeIndex of coEdgeOrder) {
    const incomingCoEdgeId = loop.coEdgeIds[(coEdgeIndex - 1 + loop.coEdgeIds.length) % loop.coEdgeIds.length]
    const currentCoEdgeId = loop.coEdgeIds[coEdgeIndex % loop.coEdgeIds.length]
    const outgoingCoEdgeId = loop.coEdgeIds[(coEdgeIndex + 1) % loop.coEdgeIds.length]

    const collisionLinesLHS = collisionLinesForCoEdgeLHS[currentCoEdgeId]
    const collisionLinesRHS = collisionLinesForCoEdgeRHS[currentCoEdgeId]
    const localParcels: With<T, Dimensions & Transform>[] = getParcelsFromCoEdge(
      graph,
      currentCoEdgeId,
      collisionLinesLHS,
      collisionLinesRHS,
      getElevation,
      (rowhouseIndex: number) => getDataWithDimensions(currentCoEdgeId, rowhouseIndex),
    )

    parcels[currentCoEdgeId] = localParcels
    if (localParcels.length > 0) {
      const newCollisionLines: Line3[] = []

      const rightmostParcel = localParcels[0]
      const leftmostParcel = localParcels[localParcels.length - 1]
      // Connect around the leftmost parcel in a [ shape
      newCollisionLines.push(new Line3(getParcelFrontRight(leftmostParcel), getParcelFrontLeft(leftmostParcel)))
      newCollisionLines.push(new Line3(getParcelBackLeft(leftmostParcel), getParcelBackRight(leftmostParcel)))
      newCollisionLines.push(new Line3(getParcelFrontLeft(leftmostParcel), getParcelBackLeft(leftmostParcel)))
      // Connect the backside of the entire row
      newCollisionLines.push(new Line3(getParcelBackLeft(leftmostParcel), getParcelBackLeft(rightmostParcel)))
      newCollisionLines.push(new Line3(getParcelBackRight(leftmostParcel), getParcelBackRight(rightmostParcel)))
      // Connect around the rightmost parcel in a ] shape
      newCollisionLines.push(new Line3(getParcelFrontRight(rightmostParcel), getParcelFrontLeft(rightmostParcel)))
      newCollisionLines.push(new Line3(getParcelBackLeft(rightmostParcel), getParcelBackRight(rightmostParcel)))
      newCollisionLines.push(new Line3(getParcelFrontRight(rightmostParcel), getParcelBackRight(rightmostParcel)))
      // Push the new collision lines to our incoming and outgoing coedges
      collisionLinesForCoEdgeLHS[incomingCoEdgeId].push(...newCollisionLines)
      collisionLinesForCoEdgeRHS[outgoingCoEdgeId].push(...newCollisionLines)
    }
  }
  return parcels
}

export function getParcelsFromGraph<T>(
  graph: Graph,
  getElevation: (x: number, y: number) => number,
  getDataWithDimensions: (coEdgeId: string, index: number) => With<T, Dimensions> | undefined,
): Record<Id, With<T, Transform & Dimensions>[]> {
  return Object.values(graph._loops).reduce<Record<Id, With<T, Transform & Dimensions>[]>>((prev, loop) => {
    return {
      ...prev,
      ...getParcelsFromGraphLoop(graph, loop, getElevation, getDataWithDimensions),
    }
  }, {})
}

function getParcelsFromCoEdge<T>(
  graph: RowHouseGraph,
  coEdgeId: Id,
  collisionLinesLHS: Line3[],
  collisionLinesRHS: Line3[],
  getElevation: (x: number, y: number) => number,
  getParcelDimensions: (houseIndex: number) => With<T, Dimensions> | undefined,
): With<T, Dimensions & Transform>[] {
  const currentCoEdge = graph._coEdges[coEdgeId]
  if (!currentCoEdge?.properties?.parcelParameters) {
    return []
  }

  const currentDirection = _getCoEdgeDirection(graph, coEdgeId)
  const orientationDeviation = getParcelDeviation(currentCoEdge.properties.parcelParameters, currentDirection)

  const { start } = _getCoEdgeVertices(graph, coEdgeId)
  const vertexStart = graph._vertices[start]

  const rowHouseWidth = currentCoEdge.properties.parcelParameters.width
  const yOffset = orientationDeviation < 0 ? rowHouseWidth * Math.sin(-orientationDeviation) : 0
  const offset = coEdgeOffset(graph, coEdgeId) + yOffset

  const convertToLocal = getRoadsideMatrix(
    vertexStart.x,
    vertexStart.y,
    currentDirection,
    offset,
    0,
    orientationDeviation,
    true,
  ).invert()

  const rowHouseDepth = currentCoEdge.properties.parcelParameters.depth
  const collisionPointsRHS = getCollisionPointsFromLines(
    collisionLinesRHS.map((line) => line.clone().applyMatrix4(convertToLocal)),
    rowHouseDepth * Math.cos(orientationDeviation),
  )
  const collisionPointsLHS = getCollisionPointsFromLines(
    collisionLinesLHS.map((line) => line.clone().applyMatrix4(convertToLocal)),
    rowHouseDepth * Math.cos(orientationDeviation),
  )

  const edgeLength = _getCoEdgeLength(graph, coEdgeId)
  const constraintRHS = Math.max(0, ...collisionPointsRHS.map((p) => p.x))
  const constraintLHS = Math.max(0, ...collisionPointsLHS.map((p) => edgeLength - p.x))
  const lengthToPlaceIn = edgeLength - constraintLHS - constraintRHS

  const roadsideAreaMatrix = getRoadsideMatrix(
    vertexStart.x,
    vertexStart.y,
    currentDirection,
    offset,
    constraintRHS,
    orientationDeviation,
    false,
  )

  const getYShiftForX = (x: number): number => Math.tan(orientationDeviation) * x

  const localParcels = generateParcelRow(
    currentCoEdge.properties.parcelParameters,
    lengthToPlaceIn,
    orientationDeviation,
    getParcelDimensions,
    getYShiftForX,
  )

  return localParcels.map((p) => ({
    ...p,
    transform: calculateGlobalTransform(getElevation, roadsideAreaMatrix, p.transform),
  }))
}

function generateParcelRow<T>(
  parameters: ParcelGraphParameters,
  roadLength: number,
  orientationOffset: number,
  getParcelDimensions: (houseIndex: number) => With<T, Dimensions> | undefined,
  getParcelDepthShift: (x: number) => number,
): With<T, Dimensions & Transform>[] {
  const parcelDimensions: With<T, Dimensions>[] = []
  const parcelPositions: number[] = []
  let currentPosition = 0
  // As a failsafe instead of using while (true) here, cap max number of houses to 100
  while (parcelPositions.length < 100) {
    const currentParcelDimensions = getParcelDimensions(parcelPositions.length)
    if (!currentParcelDimensions) break
    const nextPosition = currentPosition + currentParcelDimensions.width
    const nextPositionAlongRoad = nextPosition / Math.cos(orientationOffset)
    if (nextPositionAlongRoad >= roadLength) {
      break
    }
    parcelPositions.push(currentPosition)
    parcelDimensions.push(currentParcelDimensions)
    currentPosition = nextPosition
  }
  // TODO: Make an extra pass to take into account parameters.extraHouses

  const consumedRoadLength = currentPosition / Math.cos(orientationOffset)
  const remainingLength = roadLength - consumedRoadLength
  let startOffset = 0
  if (parameters.alignment == "left") startOffset = remainingLength
  if (parameters.alignment == "center") startOffset = remainingLength / 2

  const parcelTransforms: With<T, Dimensions & Transform>[] = []

  for (let i = 0; i < parcelPositions.length; i++) {
    const position = startOffset + parcelPositions[i]
    const tWithDimensions = parcelDimensions[i]
    const placeMatrix = new Matrix4().makeTranslation(position, getParcelDepthShift(position), 0)
    const offsetMatrix = new Matrix4().makeTranslation(tWithDimensions.width / 2, -tWithDimensions.depth / 2, 0)
    const rotationMatrix = new Matrix4().makeRotationZ(Math.PI)
    const matrix = placeMatrix.multiply(offsetMatrix).multiply(rotationMatrix)

    parcelTransforms.push({ ...tWithDimensions, transform: matrix })
  }
  return parcelTransforms
}
