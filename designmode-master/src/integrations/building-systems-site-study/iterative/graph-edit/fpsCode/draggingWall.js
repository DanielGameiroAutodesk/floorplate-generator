import { v4 as uuidv4 } from "uuid"

import { getUnitAndNormalVectorsOfLine, normalizeAngle } from "./utils/geoUtils" // eslint-disable-line import/no-internal-modules
import {
  _removeDuplicatedEdges,
  _removeDuplicatedVertices,
  _removeEdgesWithSameStartAndEnd,
  _removeUnusedVertices,
  _snapCloseVertices,
  getLoopFromGraphStartingInEdge,
  getVertexEdgeMap,
} from "./utils/graphUtils" // eslint-disable-line import/no-internal-modules
import { _addCloseVerticesToEdges, findCrossingPoints } from "./draggingVertex"

const deepCopy = (data) => JSON.parse(JSON.stringify(data))

const getNormalDist = (wallGraph, edgeID, mouseDownPosition, mousePosition) => {
  const { vertices, edges } = wallGraph
  const edge = edges[edgeID]
  const vertexOne = vertices[edge.start]
  const vertexTwo = vertices[edge.end]
  const edgeLine = [vertexOne, vertexTwo]
  const { normal } = getUnitAndNormalVectorsOfLine(edgeLine)

  if (!mousePosition || !mouseDownPosition) {
    console.error("Fail:", wallGraph, edgeID, mouseDownPosition, mousePosition)
  }

  return normal[0] * (mousePosition.x - mouseDownPosition.x) + normal[1] * (mousePosition.y - mouseDownPosition.y)
}

const getMaxNormalDist = (wallGraph, edgeID, vertexIDLoop, unit, normal, unitRatioLeft, unitRatioRight) => {
  const npd = 1e-8
  const { vertices } = wallGraph
  const vertexLeft = vertices[vertexIDLoop[0]]
  const vertexRight = vertices[vertexIDLoop[1]]
  const sl = vertexLeft.x * unit[0] + vertexLeft.y * unit[1]
  const sr = vertexRight.x * unit[0] + vertexRight.y * unit[1]
  const tl = vertexLeft.x * normal[0] + vertexLeft.y * normal[1]

  let minDist = Infinity
  if (unitRatioRight < unitRatioLeft - npd) {
    const dist = (sr - sl) / (unitRatioLeft - unitRatioRight)
    minDist = Math.min(minDist, dist)
  }

  const sAndTs = vertexIDLoop.map((vertexID) => {
    const vertex = vertices[vertexID]
    const s = vertex.x * unit[0] + vertex.y * unit[1]
    const t = vertex.x * normal[0] + vertex.y * normal[1]
    return { s, t }
  })

  sAndTs.forEach(({ s, t }) => {
    const dist = t - tl
    const sLeftBoundary = sl + dist * unitRatioLeft
    const sRightBoundary = sr + dist * unitRatioRight
    if (dist > npd && s > sLeftBoundary + npd && s < sRightBoundary - npd) {
      minDist = Math.min(minDist, dist)
    }
  })

  const n = sAndTs.length
  for (let i = 1; i < n - 1; i++) {
    const { s: s0, t: t0 } = sAndTs[i]
    const { s: s1, t: t1 } = sAndTs[i + 1]
    const dist0 = t0 - tl
    const dist1 = t1 - tl

    if (dist0 < npd && dist1 < npd) continue

    const slb0 = sl + (t0 - tl) * unitRatioLeft
    const slb1 = sl + (t1 - tl) * unitRatioLeft
    if (s0 < slb0 + npd && s1 < slb1 + npd) continue

    const srb0 = sr + (t0 - tl) * unitRatioRight
    const srb1 = sr + (t1 - tl) * unitRatioRight
    if (s0 > srb0 - npd && s1 > srb1 - npd) continue
    if (s0 <= srb0 - npd && s0 >= slb0 + npd && s1 <= srb1 - npd && s1 >= slb1 + npd) {
      minDist = Math.max(Math.min(minDist, dist0, dist1), 0)
    }
    if (s0 < slb0 + npd) {
      const a = slb0 - s0
      const b = s1 - slb1
      const dist = (dist0 * b + dist1 * a) / (a + b)
      if (dist > 0) minDist = Math.min(minDist, dist)
    }
    if (s1 < slb1 + npd) {
      const a = slb1 - s1
      const b = s0 - slb0
      const dist = (dist1 * b + dist0 * a) / (a + b)
      if (dist > 0) minDist = Math.min(minDist, dist)
    }
    if (s0 > srb0 - npd) {
      const a = s0 - srb0
      const b = srb1 - s1
      const dist = (dist0 * b + dist1 * a) / (a + b)
      if (dist > 0) minDist = Math.min(minDist, dist)
    }
    if (s1 > srb1 - npd) {
      const a = s1 - srb1
      const b = srb0 - s0
      const dist = (dist1 * b + dist0 * a) / (a + b)
      if (dist > 0) minDist = Math.min(minDist, dist)
    }
  }
  return minDist
}

const shouldVertexOneBeSplit = (vertexEdgeMap, edge, lt, ls, vertices, edges) => {
  const vertex = vertices[edge.start]
  const neighbourEdgeIDs = vertexEdgeMap[edge.start]
  if (neighbourEdgeIDs.length > 3) return true
  if (neighbourEdgeIDs.length === 3) {
    const [angleOne, angleTwo] = neighbourEdgeIDs
      .filter((id) => id !== edge.id)
      .map((edgeID) => {
        const neighbourEdge = edges[edgeID]
        const neighbourVertexID = neighbourEdge.start === edge.start ? neighbourEdge.end : neighbourEdge.start
        const neighbourVertex = vertices[neighbourVertexID]
        const dx = neighbourVertex.x - vertex.x
        const dy = neighbourVertex.y - vertex.y
        return Math.atan2(dy, dx)
      })
    const angleDiff = normalizeAngle(angleOne - angleTwo + Math.PI)
    return Math.abs(angleDiff) > 1e-4 || -ls > lt * 1.01
  }
  if (lt <= 0) {
    return Math.abs(ls) > 1e-8
  }
  return -ls > lt * 1.01
}

const shouldVertexTwoBeSplit = (vertexEdgeMap, edge, rt, rs, vertices, edges) => {
  const vertex = vertices[edge.end]
  const neighbourEdgeIDs = vertexEdgeMap[edge.end]
  if (neighbourEdgeIDs.length > 3) return true
  if (neighbourEdgeIDs.length === 3) {
    if (neighbourEdgeIDs.length === 3) {
      const [angleOne, angleTwo] = neighbourEdgeIDs
        .filter((id) => id !== edge.id)
        .map((edgeID) => {
          const neighbourEdge = edges[edgeID]
          const neighbourVertexID = neighbourEdge.start === edge.end ? neighbourEdge.end : neighbourEdge.start
          const neighbourVertex = vertices[neighbourVertexID]
          const dx = neighbourVertex.x - vertex.x
          const dy = neighbourVertex.y - vertex.y
          return Math.atan2(dy, dx)
        })
      const angleDiff = normalizeAngle(angleOne - angleTwo + Math.PI)
      return Math.abs(angleDiff) > 1e-4 || rs > rt * 1.01
    }
  }
  if (rt <= 0) {
    return Math.abs(rs) > 1e-8
  }
  return rs > rt * 1.01
}

const getCappedAndSnappedNormalDist = ({
  normalDist,
  wallGraph,
  edgeID,
  vertexIDLoop,
  unit,
  normal,
  unitRatioLeft,
  unitRatioRight,
  snappingDist,
  snappingRules,
}) => {
  const { vertices } = wallGraph
  const vertexLeft = vertices[vertexIDLoop[0]]
  const tBase = normal[0] * vertexLeft.x + normal[1] * vertexLeft.y
  const maxNormalDist = getMaxNormalDist(wallGraph, edgeID, vertexIDLoop, unit, normal, unitRatioLeft, unitRatioRight)

  if (snappingRules.object) {
    const snappingDistances = vertexIDLoop.map((vertexID) => {
      const vertex = vertices[vertexID]
      const t = vertex.x * normal[0] + vertex.y * normal[1]
      return t - tBase
    })

    let closestSnappingPoint
    let minDistToSnappingPoint = Infinity
    snappingDistances.forEach((dist) => {
      const distToSnappingPoint = Math.abs(dist - normalDist)
      if (Math.abs(dist - normalDist) < minDistToSnappingPoint) {
        closestSnappingPoint = dist
        minDistToSnappingPoint = distToSnappingPoint
      }
    })
    if (minDistToSnappingPoint < snappingDist) {
      return Math.min(closestSnappingPoint, maxNormalDist)
    }
  }
  return Math.min(normalDist, maxNormalDist)
}

const _moveWallV3 = ({
  wallGraph,
  edgeID,
  mouseDownPositionSpace,
  mousePositionSpace,
  snappingDist,
  snappingRules,
}) => {
  const { edges, vertices } = wallGraph
  const vertexEdgeMap = getVertexEdgeMap(wallGraph)
  const edge = edges[edgeID]

  const signNormalDist = getNormalDist(wallGraph, edgeID, mouseDownPositionSpace, mousePositionSpace)
  if (signNormalDist < 0) {
    const { start, end } = edge
    edge.start = end
    edge.end = start
  }
  const normalDist = Math.abs(signNormalDist)
  const vertexOne = vertices[edge.start]
  const vertexTwo = vertices[edge.end]
  const edgeLine = [vertexOne, vertexTwo]
  const vertexIDLoop = getLoopFromGraphStartingInEdge(wallGraph, edge.start, edge.end)

  const { unit, normal } = getUnitAndNormalVectorsOfLine(edgeLine)
  const m = vertexIDLoop.length
  const leftNeighbourVertex = vertices[vertexIDLoop[m - 2]]
  const leftDirection = [leftNeighbourVertex.x - vertexOne.x, leftNeighbourVertex.y - vertexOne.y]
  const lt = leftDirection[0] * normal[0] + leftDirection[1] * normal[1]
  const ls = leftDirection[0] * unit[0] + leftDirection[1] * unit[1]

  const rightNeighbourVertex = vertices[vertexIDLoop[2]]
  const rightDirection = [rightNeighbourVertex.x - vertexTwo.x, rightNeighbourVertex.y - vertexTwo.y]
  const rt = rightDirection[0] * normal[0] + rightDirection[1] * normal[1]
  const rs = rightDirection[0] * unit[0] + rightDirection[1] * unit[1]

  const unitRatioLeft = lt > 0 && lt * 1.01 >= -ls ? ls / lt : 0
  const unitRatioRight = rt > 0 && rt * 1.01 >= rs ? rs / rt : 0

  const cappedAndSnappedNormalDist = getCappedAndSnappedNormalDist({
    normalDist,
    wallGraph,
    edgeID,
    vertexIDLoop,
    unit,
    normal,
    unitRatioLeft,
    unitRatioRight,
    snappingDist,
    snappingRules,
  })
  const unitDistOne = unitRatioLeft * cappedAndSnappedNormalDist
  const unitDistTwo = unitRatioRight * cappedAndSnappedNormalDist

  const dxOne = cappedAndSnappedNormalDist * normal[0] + unitDistOne * unit[0]
  const dyOne = cappedAndSnappedNormalDist * normal[1] + unitDistOne * unit[1]
  const dxTwo = cappedAndSnappedNormalDist * normal[0] + unitDistTwo * unit[0]
  const dyTwo = cappedAndSnappedNormalDist * normal[1] + unitDistTwo * unit[1]

  const touchedVertices = [vertexOne.id, vertexTwo.id]

  const splitVertexOne = shouldVertexOneBeSplit(vertexEdgeMap, edge, lt, ls, vertices, edges)

  if (splitVertexOne) {
    const newVertexOneID = uuidv4()
    const newVertexOne = {
      x: vertexOne.x + dxOne,
      y: vertexOne.y + dyOne,
      id: newVertexOneID,
    }
    const newEdgeOneID = uuidv4()
    const newEdgeOne = {
      start: vertexOne.id,
      end: newVertexOneID,
      id: newEdgeOneID,
    }
    vertices[newVertexOneID] = newVertexOne
    edges[newEdgeOneID] = newEdgeOne
    edge.start = newVertexOneID
    touchedVertices.push(newVertexOneID)
  } else {
    const vertex = vertices[vertexOne.id]
    vertex.x += dxOne
    vertex.y += dyOne
  }

  const splitVertexTwo = shouldVertexTwoBeSplit(vertexEdgeMap, edge, rt, rs, vertices, edges)

  if (splitVertexTwo) {
    const newVertexTwoID = uuidv4()
    const newVertexTwo = {
      x: vertexTwo.x + dxTwo,
      y: vertexTwo.y + dyTwo,
      id: newVertexTwoID,
    }
    const newEdgeTwoID = uuidv4()
    const newEdgeTwo = {
      start: vertexTwo.id,
      end: newVertexTwoID,
      id: newEdgeTwoID,
    }
    vertices[newVertexTwoID] = newVertexTwo
    edges[newEdgeTwoID] = newEdgeTwo
    edge.end = newVertexTwoID
    touchedVertices.push(newVertexTwoID)
  } else {
    const vertex = vertices[vertexTwo.id]
    vertex.x += dxTwo
    vertex.y += dyTwo
  }

  const crossingPoints = findCrossingPoints(wallGraph, touchedVertices)
  crossingPoints.forEach((point) => {
    const vertexID = uuidv4()
    vertices[vertexID] = { id: vertexID, x: point.x, y: point.y }
  })

  _snapCloseVertices(wallGraph)
  _addCloseVerticesToEdges(wallGraph)
  _removeDuplicatedVertices(wallGraph)
  _removeDuplicatedEdges(wallGraph)
  _removeEdgesWithSameStartAndEnd(wallGraph)
  _removeUnusedVertices(wallGraph)
}

export const dragWall = (
  _wallGraph,
  edgeID,
  mouseDownPositionSpace,
  mousePositionSpace,
  snappingDist,
  snappingRules,
) => {
  const wallGraph = deepCopy(_wallGraph)

  _moveWallV3({
    wallGraph,
    edgeID,
    mouseDownPositionSpace,
    mousePositionSpace,
    snappingDist: 0.9 * snappingDist,
    snappingRules,
  })

  return { wallGraph }
}
