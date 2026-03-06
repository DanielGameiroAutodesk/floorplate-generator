import { movePointAlongVector } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import { getNeighbourEdgeProps } from "./helpers.js"
import { deepCopy } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers.js"
import { getNormalizedVectorFromPointToPoint } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { findConnectedEdges } from "src/integrations/building-systems-site-study/generator/sketchStuff/sharedDivisionLinesV2/graphHelpers.js"

export const MIN_SECTION_DIST = 0.9
const NUMERICAL_PRECISION = 0.01

export function getUpdatedPropList(l, newLength, defaultValue) {
  const newList = l && l.length > 0 ? l : [defaultValue]
  if (newList.length < newLength) {
    return [...newList, ...Array(newLength - newList.length).fill(newList[newList.length - 1])]
  } else if (newList.length > newLength) {
    return newList.slice(0, Math.max(newLength, 1))
  }
  return newList
}

function reverseArray(array) {
  array = deepCopy(array)
  array.reverse()
  return array
}

function intersectionOfArrays(array1, array2) {
  return array1.filter((value) => array2.includes(value))
}

function antiIntersectionOfArrays(array1, array2) {
  const intersection = intersectionOfArrays(array1, array2)
  return [...array1, ...array2].filter((value) => !intersection.includes(value))
}

function pointPointDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

function getAngle(p0, p1, p2) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function getAngleBetweenEdges(edge1, edge2, vertices) {
  const vertices1 = [edge1.start, edge1.end]
  const vertices2 = [edge2.start, edge2.end]
  const p1 = intersectionOfArrays(vertices1, vertices2).map((id) => [vertices[id].x, vertices[id].y])[0]
  const [p0, p2] = antiIntersectionOfArrays(vertices1, vertices2).map((id) => [vertices[id].x, vertices[id].y])
  if (p0 === undefined) return Math.PI
  return getAngle(p0, p1, p2)
}

function getEdgeLength(edge, vertices) {
  const [p1, p2] = [edge.start, edge.end].map((vertexID) => [vertices[vertexID].x, vertices[vertexID].y])
  return pointPointDistance(p1, p2)
}

export function getEdgeLine(graph, edgeId) {
  const edge = graph.edges[edgeId]
  const startVertex = graph.vertices[edge.start]
  const endVertex = graph.vertices[edge.end]
  const p0 = [startVertex.x, startVertex.y]
  const p1 = [endVertex.x, endVertex.y]
  return [p0, p1]
}

export function addVectorsToPoint(point, ...rest) {
  let x = point[0]
  let y = point[1]
  for (let i = 0; i < rest.length - 1; i += 2) {
    const vector = rest[i]
    const scalar = rest[i + 1]
    x += scalar * vector[0]
    y += scalar * vector[1]
  }
  return [x, y]
}

export function getVertexEdgeMap(edges) {
  const vertexEdgeMap = {}
  Object.values(edges).forEach((edge) => {
    const startVertex = edge.start
    if (vertexEdgeMap[startVertex]) vertexEdgeMap[startVertex].push(edge.id)
    else vertexEdgeMap[startVertex] = [edge.id]

    const endVertex = edge.end
    if (vertexEdgeMap[endVertex]) vertexEdgeMap[endVertex].push(edge.id)
    else vertexEdgeMap[endVertex] = [edge.id]
  })

  return vertexEdgeMap
}

function getCurrentBlockDistance(width, hoodWidth, angle, splitVertex) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = (0.5 * hoodWidth) / Math.cos(absAngle - Math.PI / 2)
    const dist2 = (0.5 * width) / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (0.5 * hoodWidth - 0.5 * width * Math.cos(absAngle)) / Math.sin(absAngle)
  if (!splitVertex) {
    return Math.abs(shift)
  }
  if (splitVertex && width >= hoodWidth) {
    return hoodWidth < width * Math.cos(absAngle) ? 0 : Math.abs(shift)
  }
  if (splitVertex && width < hoodWidth) {
    if (width >= hoodWidth * Math.cos(absAngle)) return Math.abs(shift)
    return 0.5 * width * Math.tan(absAngle)
  }
}

function getCurrentBlockDistanceOneSided(width, hoodWidth, angle) {
  const absAngle = Math.abs(angle)
  if (absAngle === 0) return 0
  const shift = (0.5 * hoodWidth - 0.5 * width * Math.cos(absAngle)) / Math.sin(absAngle)
  return Math.max(shift, 0)
}

function getBlockDistancesInner(graph) {
  const { vertices, edges } = graph

  const vertexEdgeMap = getVertexEdgeMap(edges)
  const shouldVertexBeSplitMap = getShouldVertexBeSplitMap(graph)
  const blockDict = {}
  Object.keys(edges).forEach((edgeID) => (blockDict[edgeID] = {}))

  for (let vertexId in vertexEdgeMap) {
    if (vertexEdgeMap[vertexId].length === 1) continue
    const splitVertex = shouldVertexBeSplitMap[vertexId]
    if (vertexEdgeMap[vertexId].length === 2) {
      const [edgeOne, edgeTwo] = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId])
      const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
      const blockDistanceOne = getCurrentBlockDistance(edgeOne.width, edgeTwo.width, angle, splitVertex)
      const blockDistanceTwo = getCurrentBlockDistance(edgeTwo.width, edgeOne.width, angle, splitVertex)
      if (vertexId === edgeOne.start) blockDict[edgeOne.id].startBlock = blockDistanceOne
      else blockDict[edgeOne.id].endBlock = getEdgeLength(edgeOne, vertices) - blockDistanceOne
      if (vertexId === edgeTwo.start) blockDict[edgeTwo.id].startBlock = blockDistanceTwo
      else blockDict[edgeTwo.id].endBlock = getEdgeLength(edgeTwo, vertices) - blockDistanceTwo
    }
    if (vertexEdgeMap[vertexId].length > 2) {
      const neighbourEdges = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId])
      const baseEdge = neighbourEdges[0]
      neighbourEdges.sort((edgeOne, edgeTwo) => {
        const angleOne = getAngleBetweenEdges(baseEdge, edgeOne, graph.vertices)
        const angleTwo = getAngleBetweenEdges(baseEdge, edgeTwo, graph.vertices)
        return angleOne - angleTwo
      })
      neighbourEdges.forEach((edge, i) => {
        const leftEdge = neighbourEdges[mod(i - 1, neighbourEdges.length)]
        const rightEdge = neighbourEdges[mod(i + 1, neighbourEdges.length)]
        const leftAngle = getAngleBetweenEdges(leftEdge, edge, graph.vertices)
        const rightAngle = getAngleBetweenEdges(edge, rightEdge, graph.vertices)
        const leftBlockDistance = getCurrentBlockDistanceOneSided(edge.width, leftEdge.width, leftAngle)
        const rightBlockDistance = getCurrentBlockDistanceOneSided(edge.width, rightEdge.width, rightAngle)
        const blockDistance = Math.max(leftBlockDistance, rightBlockDistance)
        if (vertexId === edge.start) blockDict[edge.id].startBlock = blockDistance
        else blockDict[edge.id].endBlock = getEdgeLength(edge, vertices) - blockDistance
      })
    }
  }
  return blockDict
}

function getBlockDistancesForCorners(graph) {
  const { vertices, edges } = graph
  const blockDistances = getBlockDistancesInner(graph)
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  Object.values(edges).forEach((edge) => {
    if (collapsedVertices[edge.start]) blockDistances[edge.id].startBlock = undefined
    if (collapsedVertices[edge.end]) blockDistances[edge.id].endBlock = undefined
  })
  return blockDistances
}

function getBlockDistances(graph) {
  const { vertices, edges } = graph
  const blockDistancesCorners = getBlockDistancesForCorners(graph)

  const blockDistances = Object.values(edges).reduce((acc, edge) => {
    const blockFromCorners = blockDistancesCorners[edge.id]
    acc[edge.id] = {
      startBlock: blockFromCorners.startBlock || 0,
      endBlock: blockFromCorners.endBlock || getEdgeLength(edge, vertices),
    }
    return acc
  }, {})

  return blockDistances
}

export function getCollapsedVertices(vertices, edges) {
  const MAX_BLOCK_DIST = 25
  const MIN_DIST_BETWEEN_CORNER_BLOCKS = 6
  const ANGLE_THRESHOLD = (5 / 6) * Math.PI
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const splitCorners = getShouldVertexBeSplitMap({ edges, vertices })
  const blockDistances = getBlockDistancesInner({ vertices, edges })
  const collapsedVertices = {}

  for (let vertexId in vertexEdgeMap) {
    if (vertexEdgeMap[vertexId].length === 2) {
      const [edgeOne, edgeTwo] = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId])
      const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
      if (Math.abs(angle) > ANGLE_THRESHOLD) {
        collapsedVertices[vertexId] = vertexId
        continue
      }
      const splitCorner = splitCorners[vertexId]
      const blockDistanceOne = getCurrentBlockDistance(edgeOne.width, edgeTwo.width, angle, splitCorner)
      const blockDistanceTwo = getCurrentBlockDistance(edgeTwo.width, edgeOne.width, angle, splitCorner)
      const edgeLengthOne = getEdgeLength(edgeOne, vertices)
      const edgeLengthTwo = getEdgeLength(edgeTwo, vertices)
      if (blockDistanceOne >= edgeLengthOne || blockDistanceTwo >= edgeLengthTwo) collapsedVertices[vertexId] = vertexId
    } else if (vertexEdgeMap[vertexId].length > 2) {
      const neighbourEdges = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId])
      const baseEdge = neighbourEdges[0]
      neighbourEdges.sort((edgeOne, edgeTwo) => {
        const angleOne = getAngleBetweenEdges(baseEdge, edgeOne, vertices)
        const angleTwo = getAngleBetweenEdges(baseEdge, edgeTwo, vertices)
        return angleOne - angleTwo
      })
      neighbourEdges.forEach((edge, i) => {
        const leftEdge = neighbourEdges[mod(i - 1, neighbourEdges.length)]
        const rightEdge = neighbourEdges[mod(i + 1, neighbourEdges.length)]
        const leftAngle = getAngleBetweenEdges(leftEdge, edge, vertices)
        const rightAngle = getAngleBetweenEdges(edge, rightEdge, vertices)
        if (Math.abs(leftAngle) > ANGLE_THRESHOLD || Math.abs(rightAngle) > ANGLE_THRESHOLD)
          collapsedVertices[vertexId] = vertexId
        const leftBlockDistance = getCurrentBlockDistanceOneSided(edge.width, leftEdge.width, leftAngle)
        const rightBlockDistance = getCurrentBlockDistanceOneSided(edge.width, rightEdge.width, rightAngle)
        const edgeLength = getEdgeLength(edge, vertices)
        if (Math.max(leftBlockDistance, rightBlockDistance) > Math.min(edgeLength, MAX_BLOCK_DIST))
          collapsedVertices[vertexId] = vertexId
      })
    }
  }

  for (let edge of Object.values(edges)) {
    const { startBlock, endBlock } = blockDistances[edge.id]
    if (!startBlock || !endBlock) continue
    const effectiveStart = splitCorners[edge.start] ? 0 : startBlock
    const effectiveEnd = splitCorners[edge.end] ? getEdgeLength(edge, vertices) : endBlock
    if (effectiveEnd - effectiveStart < MIN_DIST_BETWEEN_CORNER_BLOCKS) {
      if (!splitCorners[edge.start]) collapsedVertices[edge.start] = true
      if (!splitCorners[edge.end]) collapsedVertices[edge.end] = true
    }
    const doubleSplit = splitCorners[edge.start] && splitCorners[edge.end]
    if (doubleSplit && endBlock <= startBlock) {
      const edge0 = vertexEdgeMap[edge.start]
        .map((edgeID) => edges[edgeID])
        .find((neighborEdge) => neighborEdge.id !== edge.id)
      const edge2 = vertexEdgeMap[edge.end]
        .map((edgeID) => edges[edgeID])
        .find((neighborEdge) => neighborEdge.id !== edge.id)
      const angle0 = getAngleBetweenEdges(edge0, edge, vertices)
      const angle1 = getAngleBetweenEdges(edge, edge2, vertices)
      if (angle0 * angle1 > 0) {
        collapsedVertices[edge.start] = true
        collapsedVertices[edge.end] = true
      }
    }
  }
  return collapsedVertices
}

export function getShouldVertexBeSplitMap(graph) {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(edges)

  const shouldVertexBeSplitMap = {}
  for (let vertexId in vertexEdgeMap) {
    const edges = vertexEdgeMap[vertexId].map((edgeId) => graph.edges[edgeId])
    if (edges.length !== 2) {
      shouldVertexBeSplitMap[vertexId] = false
      continue
    }
    const [edgeOne, edgeTwo] = edges
    const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
    shouldVertexBeSplitMap[vertexId] = Math.abs(angle) < (1 / 3) * Math.PI
  }
  return shouldVertexBeSplitMap
}

function getCutCornerWall(edgeId, vertexId, vertexEdgeMap, edges, vertices) {
  const [edgeOne, edgeTwo] = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId]).sort((a, b) => b.width - a.width)
  const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
  const [p0, p1] = [vertexId, edgeOne.start === vertexId ? edgeOne.end : edgeOne.start].map((id) => [
    vertices[id].x,
    vertices[id].y,
  ])
  const unitVec = getNormalizedVectorFromPointToPoint(p0, p1)
  const normVec = [-unitVec[1], unitVec[0]]

  let wall
  if (edgeOne.width === edgeTwo.width) {
    const shiftDistance = (0.5 * edgeOne.width) / Math.tan(0.5 * Math.PI - 0.5 * angle)
    const a = addVectorsToPoint(p0, unitVec, -shiftDistance, normVec, 0.5 * edgeOne.width)
    const b = addVectorsToPoint(p0, unitVec, shiftDistance, normVec, -0.5 * edgeOne.width)
    wall = [a, b]
  } else if (edgeId === edgeOne.id && edgeOne.width * Math.cos(angle) >= edgeTwo.width) {
    const a = addVectorsToPoint(p0, normVec, 0.5 * edgeOne.width)
    const b = addVectorsToPoint(p0, normVec, (0.5 * edgeTwo.width) / Math.cos(angle))
    const c = addVectorsToPoint(p0, normVec, (-0.5 * edgeTwo.width) / Math.cos(angle))
    const d = addVectorsToPoint(p0, normVec, -0.5 * edgeOne.width)
    wall = [a, b, c, d]
  } else if (edgeOne.width * Math.cos(angle) >= edgeTwo.width) {
    const a = addVectorsToPoint(p0, normVec, (0.5 * edgeTwo.width) / Math.cos(angle))
    const b = addVectorsToPoint(p0, normVec, (-0.5 * edgeTwo.width) / Math.cos(angle))
    wall = [a, b]
  } else {
    const shift = (0.5 * edgeTwo.width - 0.5 * edgeOne.width * Math.cos(angle)) / Math.sin(angle)
    const a = addVectorsToPoint(p0, unitVec, -shift, normVec, 0.5 * edgeOne.width)
    const b = addVectorsToPoint(p0, unitVec, shift, normVec, -0.5 * edgeOne.width)
    wall = [a, b]
  }
  const flip = ((edgeOne.id === edgeId) + (vertexId === edges[edgeId].start)) % 2 === 0
  return flip ? wall : reverseArray(wall)
}

function getEdgeSections2(vertices, edges) {
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  const splitCornerMap = Object.values(vertices).reduce((acc, vertex) => {
    if (
      !vertices[vertex.id].floorStackProps.length &&
      !collapsedVertices[vertex.id] &&
      vertexEdgeMap[vertex.id].length === 2
    )
      acc[vertex.id] = true
    return acc
  }, {})

  const edgeSections = Object.values(edges)
    .map((edge) => {
      const { floorStackProps } = edge
      if (floorStackProps.length === 0) return null
      const [p0, p1] = [edge.start, edge.end].map((vertexID) => [vertices[vertexID].x, vertices[vertexID].y])
      const { width } = edge
      const unitVec = getNormalizedVectorFromPointToPoint(p0, p1)
      const normVec = [-unitVec[1], unitVec[0]]

      const sectionDistances = [floorStackProps[0].start].concat(floorStackProps.flatMap((fsp) => fsp.end))
      const walls = sectionDistances.map((sectionDistance) => [
        addVectorsToPoint(p0, unitVec, sectionDistance, normVec, 0.5 * width),
        addVectorsToPoint(p0, unitVec, sectionDistance, normVec, -0.5 * width),
      ])
      if (splitCornerMap[edge.start]) walls[0] = getCutCornerWall(edge.id, edge.start, vertexEdgeMap, edges, vertices)
      if (splitCornerMap[edge.end])
        walls[walls.length - 1] = getCutCornerWall(edge.id, edge.end, vertexEdgeMap, edges, vertices)

      const sections = []
      for (let i = 0; i < walls.length - 1; i++) {
        const startWall = walls[i]
        const endWall = walls[i + 1]
        sections.push({ startWall, endWall })
      }
      const exteriorPolygon = [...walls[0], ...reverseArray(walls[walls.length - 1])]
      return { edge, sections, exteriorPolygon }
    })
    .filter((_) => _)
  return edgeSections
}

function getCornerSectionOfTwoEdges(graph, vertex, blockDict) {
  const {
    left: leftEdgeProps,
    right: rightEdgeProps,
    angle,
  } = getNeighbourEdgeProps(graph.edges, graph.vertices, vertex.id)
  const { sectionDistances } = vertex.floorStackProps[0]
  const leftBlockDist = leftEdgeProps.flipped
    ? leftEdgeProps.length - blockDict[leftEdgeProps.edgeId].endBlock
    : blockDict[leftEdgeProps.edgeId].startBlock
  const rightBlockDist = rightEdgeProps.flipped
    ? rightEdgeProps.length - blockDict[rightEdgeProps.edgeId].endBlock
    : blockDict[rightEdgeProps.edgeId].startBlock

  const leftShift = (0.5 * rightEdgeProps.width + 0.5 * leftEdgeProps.width * Math.cos(angle)) / Math.sin(angle)
  const rightShift = (0.5 * leftEdgeProps.width + 0.5 * rightEdgeProps.width * Math.cos(angle)) / Math.sin(angle)
  const NPD = 1e-2
  const leftPointOutside =
    angle <= 0.5 * Math.PI ||
    -NPD > (leftEdgeProps.width - rightEdgeProps.width / Math.cos(Math.PI - angle)) * Math.sin(Math.PI - angle)
  const leftPointInside = NPD + leftShift < leftBlockDist
  const rightPointOutside =
    angle <= 0.5 * Math.PI ||
    -NPD > (rightEdgeProps.width - leftEdgeProps.width / Math.cos(Math.PI - angle)) * Math.sin(Math.PI - angle)
  const rightPointInside = NPD + rightShift < rightBlockDist

  const vertexPoint = [vertex.x, vertex.y]
  const midInnerPoint = movePointAlongVector(
    movePointAlongVector(vertexPoint, rightEdgeProps.normal, 0.5 * rightEdgeProps.width),
    rightEdgeProps.direction,
    rightShift,
  )
  const midOuterPoint = movePointAlongVector(
    movePointAlongVector(vertexPoint, rightEdgeProps.normal, -0.5 * rightEdgeProps.width),
    rightEdgeProps.direction,
    -rightShift,
  )

  const leftOuterPoint = movePointAlongVector(midInnerPoint, leftEdgeProps.normal, leftEdgeProps.width)
  const leftInnerPoint = movePointAlongVector(
    movePointAlongVector(vertexPoint, leftEdgeProps.normal, -0.5 * leftEdgeProps.width),
    leftEdgeProps.direction,
    leftBlockDist,
  )
  const rightOuterPoint = movePointAlongVector(midInnerPoint, rightEdgeProps.normal, -rightEdgeProps.width)
  const rightInnerPoint = movePointAlongVector(
    movePointAlongVector(vertexPoint, rightEdgeProps.normal, 0.5 * rightEdgeProps.width),
    rightEdgeProps.direction,
    rightBlockDist,
  )

  const minimalCornerPolygon = [
    midInnerPoint,
    leftPointOutside || leftPointInside ? (leftPointInside ? leftInnerPoint : leftOuterPoint) : null,
    midOuterPoint,
    rightPointOutside || rightPointInside ? (rightPointInside ? rightInnerPoint : rightOuterPoint) : null,
  ].filter((_) => _)

  if (angle <= 0.5 * Math.PI) {
    const minWidth = Math.min(leftEdgeProps.width, rightEdgeProps.width)
    const leftExtraCornerPoint = movePointAlongVector(leftOuterPoint, leftEdgeProps.direction, -minWidth)
    const rightExtraCornerPoint = movePointAlongVector(rightOuterPoint, rightEdgeProps.direction, -minWidth)
    if (pointPointDistance(leftExtraCornerPoint, rightExtraCornerPoint) > NPD) {
      minimalCornerPolygon.splice(2, 1, leftExtraCornerPoint, rightExtraCornerPoint)
    }
  }
  const cornerPolygon = [...minimalCornerPolygon]

  const leftEndPoint = leftEdgeProps.flipped
    ? movePointAlongVector(leftEdgeProps.point, leftEdgeProps.direction, -sectionDistances[leftEdgeProps.edgeId])
    : movePointAlongVector(vertexPoint, leftEdgeProps.direction, sectionDistances[leftEdgeProps.edgeId])
  const leftEndInnerPoint = movePointAlongVector(leftEndPoint, leftEdgeProps.normal, -0.5 * leftEdgeProps.width)
  const leftEndOuterPoint = movePointAlongVector(leftEndPoint, leftEdgeProps.normal, 0.5 * leftEdgeProps.width)

  const leftLegLength = leftPointInside
    ? pointPointDistance(leftEndOuterPoint, midOuterPoint)
    : pointPointDistance(leftEndInnerPoint, midInnerPoint)
  // IF COLLAPSED LEG: Overwrite cornerPoly with numerically safe points
  if (leftLegLength < NPD && leftPointInside) {
    cornerPolygon[1] = leftEndInnerPoint
    cornerPolygon[2] = leftEndOuterPoint
  }
  if (leftLegLength < NPD && !leftPointInside) {
    cornerPolygon[0] = leftEndInnerPoint
    cornerPolygon[1] = leftEndOuterPoint
  }
  const leftLegAddition =
    leftLegLength < NPD
      ? { points: [], index: 0, legLength: 0 }
      : {
          points: [leftEndInnerPoint, leftEndOuterPoint],
          index: 1,
          legLength: leftLegLength,
        }
  const deleteCountLeft = ((leftPointOutside || leftPointInside) && leftLegAddition.points.length > 0) * 1
  cornerPolygon.splice(leftLegAddition.index, deleteCountLeft, ...leftLegAddition.points)

  const rightEndPoint = rightEdgeProps.flipped
    ? movePointAlongVector(rightEdgeProps.point, rightEdgeProps.direction, -sectionDistances[rightEdgeProps.edgeId])
    : movePointAlongVector(vertexPoint, rightEdgeProps.direction, sectionDistances[rightEdgeProps.edgeId])
  const rightEndInnerPoint = movePointAlongVector(rightEndPoint, rightEdgeProps.normal, 0.5 * rightEdgeProps.width)
  const rightEndOuterPoint = movePointAlongVector(rightEndPoint, rightEdgeProps.normal, -0.5 * rightEdgeProps.width)

  const rightLegLength = rightPointInside
    ? pointPointDistance(rightEndOuterPoint, midOuterPoint)
    : pointPointDistance(rightEndInnerPoint, midInnerPoint)
  // IF COLLAPSED LEG: Overwrite cornerPoly with numerically safe points
  if (rightLegLength < NPD && rightPointInside) {
    cornerPolygon[cornerPolygon.length - 1] = rightEndInnerPoint
    cornerPolygon[cornerPolygon.length - 2] = rightEndOuterPoint
  }
  if (rightLegLength < NPD && !rightPointInside) {
    cornerPolygon[0] = rightEndInnerPoint
    cornerPolygon[cornerPolygon.length - 1] = rightEndOuterPoint
  }
  const rightLegAddition =
    rightLegLength < NPD
      ? { points: [], index: 0, legLength: 0 }
      : {
          points: [rightEndOuterPoint, rightEndInnerPoint],
          index: cornerPolygon.length - 1,
          legLength: rightLegLength,
        }
  const deleteCountRight = ((rightPointOutside || rightPointInside) && rightLegAddition.points.length > 0) * 1
  cornerPolygon.splice(rightLegAddition.index, deleteCountRight, ...rightLegAddition.points)

  return {
    vertex,
    exteriorPolygon: cornerPolygon,
    minimalCornerPolygon,
    leftLegAddition,
    rightLegAddition,
    edgePullback: { [leftEdgeProps.edgeId]: leftBlockDist, [rightEdgeProps.edgeId]: rightBlockDist },
  }
}

function getEdgeWallAtSectionDist(graph, edgeId, sectionDistance, flip) {
  const [p0, p1] = getEdgeLine(graph, edgeId)
  const unitVector = getNormalizedVectorFromPointToPoint(p0, p1)
  const normalVector = [-unitVector[1], unitVector[0]]
  const width = graph.edges[edgeId].width
  const start = addVectorsToPoint(p0, unitVector, sectionDistance, normalVector, 0.5 * width)
  const end = addVectorsToPoint(p0, unitVector, sectionDistance, normalVector, -0.5 * width)
  return flip ? [start, end] : [end, start]
}

function getCornerSectionOfMultiEdges(graph, vertex, vertexEdgeMap, blockDict) {
  const edges = vertexEdgeMap[vertex.id].map((edgeId) => graph.edges[edgeId])
  const baseEdge = edges[0]

  edges.sort((edgeOne, edgeTwo) => {
    const angleOne = getAngleBetweenEdges(baseEdge, edgeOne, graph.vertices)
    const angleTwo = getAngleBetweenEdges(baseEdge, edgeTwo, graph.vertices)
    return angleOne - angleTwo
  })
  const blockDistances = getBlockDistances(graph)
  const sectionDistances = vertex.floorStackProps[0].sectionDistances
  const exteriorPolygon = []
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i]
    const { startBlock, endBlock } = blockDistances[edge.id]
    const blockDistance = edge.start === vertex.id ? startBlock : endBlock
    const sectionDistance = sectionDistances[edge.id]
    let wall = getEdgeWallAtSectionDist(graph, edge.id, sectionDistance)
    if (Math.abs(blockDistance - sectionDistance) > NUMERICAL_PRECISION) {
      const minimalCornerWall = getEdgeWallAtSectionDist(graph, edge.id, blockDistance)
      wall.splice(0, 0, minimalCornerWall[0])
      wall.push(minimalCornerWall[1])
    }
    const counterClockWiseWall = edge.start === vertex.id ? wall : reverseArray(wall)
    if (exteriorPolygon.length) {
      if (
        pointPointDistance(counterClockWiseWall[0], exteriorPolygon[exteriorPolygon.length - 1]) < NUMERICAL_PRECISION
      )
        counterClockWiseWall.shift()
      if (
        pointPointDistance(counterClockWiseWall[counterClockWiseWall.length - 1], exteriorPolygon[0]) <
        NUMERICAL_PRECISION
      )
        counterClockWiseWall.pop()
    }
    exteriorPolygon.push(...counterClockWiseWall)
  }

  const edgePullback = Object.values(edges).reduce((acc, edge) => {
    acc[edge.id] =
      edge.start === vertex.id
        ? blockDict[edge.id].startBlock
        : getEdgeLength(edge, graph.vertices) - blockDict[edge.id].endBlock
    return acc
  }, {})
  return { vertex, exteriorPolygon, edgePullback }
}

function getCornerSections2(edges, vertices) {
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const blockDict = getBlockDistances({ vertices, edges })
  const graph = { edges, vertices }

  const cornerSections = []
  for (const vertexId in vertexEdgeMap) {
    if (vertices[vertexId].floorStackProps.length === 0) continue
    const neighbourEdges = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId])
    if (neighbourEdges.length === 2)
      cornerSections.push(getCornerSectionOfTwoEdges(graph, vertices[vertexId], blockDict))
    else if (neighbourEdges.length > 2)
      cornerSections.push(getCornerSectionOfMultiEdges(graph, vertices[vertexId], vertexEdgeMap, blockDict))
  }

  return cornerSections.filter((section) => section)
}

export function getSectionsForGraphV2(graph) {
  const { edges, vertices } = graph
  const cornerSections = getCornerSections2(edges, vertices)
  const edgeSections = getEdgeSections2(vertices, edges)
  return { cornerSections, edgeSections }
}

export function graphHasNewSectionFormat(graph) {
  const edgeProps = Object.values(graph.edges)
    .flatMap((edge) => edge.floorStackProps)
    .filter((_) => _)
  const vertexProps = Object.values(graph.vertices)
    .flatMap((vertex) => vertex.floorStackProps)
    .filter((_) => _)

  if (edgeProps.concat(vertexProps).length === 0) return false
  return edgeProps.some((props) => props.start || props.end) || vertexProps.some((props) => props.sectionDistances)
}

export function splitGraphInOldAndNewSectionFormat(graph) {
  const newGraph = { edges: {}, vertices: {} }
  const oldGraph = { edges: {}, vertices: {} }
  const graphComponents = findConnectedEdges(graph)
  graphComponents.forEach((subGraph) => {
    if (graphHasNewSectionFormat(subGraph)) {
      Object.values(subGraph.edges).forEach((edge) => (newGraph.edges[edge.id] = edge))
      Object.values(subGraph.vertices).forEach((vertex) => (newGraph.vertices[vertex.id] = vertex))
    } else {
      Object.values(subGraph.vertices).forEach((vertex) => (oldGraph.vertices[vertex.id] = vertex))
      Object.values(subGraph.edges).forEach((edge) => (oldGraph.edges[edge.id] = edge))
    }
  })
  return { newGraph, oldGraph }
}

export function getEdgePropsFromNeighbours(edge, vertices) {
  //assumes at least one neighbour vertex has floorStackProps
  const neighbourVertexProps = [edge.start, edge.end]
    .map((id) => vertices[id])
    .map((vertex) => vertex.floorStackProps)
    .filter((_) => _)
    .flat()
  const { floorProps, joinVertically } = deepCopy(neighbourVertexProps[0])
  return { floorProps, elevation: null, joinVertically }
}

export function getVertexPropsFromNeighbours(vertex, edges, vertices) {
  //assumes at least one neighbour edge has floorStackProps
  const vertexId = vertex.id
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const neighbourEdgeProps = vertexEdgeMap[vertexId]
    .map((edgeId) => edges[edgeId])
    .map((edge) => {
      const { floorStackProps } = edge
      if (floorStackProps.length) {
        if (vertexId === edge.start) return floorStackProps[0]
        return floorStackProps[floorStackProps.length - 1]
      }
      return null
    })
    .filter((_) => _)
  let floorProps
  let joinVertically
  if (neighbourEdgeProps.length > 0) {
    floorProps = deepCopy(neighbourEdgeProps[0]).floorProps
    joinVertically = neighbourEdgeProps[0].joinVertically
  } else {
    const neighbourVertexProps = vertexEdgeMap[vertexId].flatMap((edgeID) => {
      const edge = edges[edgeID]
      const neighborVertexID = edge.start === vertexId ? edge.end : edge.start
      const neighborVertex = vertices[neighborVertexID]
      return neighborVertex.floorStackProps
    })
    floorProps = deepCopy(neighbourVertexProps[0]).floorProps
    joinVertically = neighbourVertexProps[0].joinVertically
  }
  const vertexFloorProps = floorProps.map((fp) => {
    const plan = ["SLAB", "bestFit", "bestFit2"].includes(fp.plan) ? fp.plan : "bestFit2"
    return { ...fp, plan }
  })

  return { floorProps: vertexFloorProps, elevation: null, sectionDistances: {}, joinVertically }
}

function isOldCornerLeftHanded(vertices, edge1, edge2) {
  const angle = getAngleBetweenEdges(edge1, edge2, vertices)
  return angle >= 0 ? edge1.width <= edge2.width : edge2.width <= edge1.width
}

function getLegLengthsOfOldCorners(edges, vertices, vertexEdgeMap, blockDict, collapsedVertices, vertexShouldBeSplit) {
  const APT_WIDTH = 6
  const CORE_LONG_SIDE = 6
  const notMinSectionLength = 16

  const legDistances = {}
  const coreExtensions = {}
  for (let vertex of Object.values(vertices)) {
    legDistances[vertex.id] = {}
    vertexEdgeMap[vertex.id].forEach((edgeID) => {
      legDistances[vertex.id][edgeID] = 0
    })
    coreExtensions[vertex.id] = {}
    vertexEdgeMap[vertex.id].forEach((edgeID) => {
      coreExtensions[vertex.id][edgeID] = 0
    })
  }

  for (let vertexID in vertexEdgeMap) {
    if (collapsedVertices[vertexID]) continue
    if (vertexShouldBeSplit[vertexID]) continue
    if (vertexEdgeMap[vertexID].length !== 2) continue
    const [edge1, edge2] = vertexEdgeMap[vertexID].map((edgeID) => edges[edgeID])
    const edgeLengthOne = getEdgeLength(edge1, vertices)
    const edgeLengthTwo = getEdgeLength(edge2, vertices)
    const angle = getAngleBetweenEdges(edge1, edge2, vertices)
    const leftHanded = isOldCornerLeftHanded(vertices, edge1, edge2)
    const coreExtensionIntoLeg = CORE_LONG_SIDE * Math.max(Math.cos(angle), 0)
    if ((angle < 0) * leftHanded) {
      legDistances[vertexID][edge1.id] += coreExtensionIntoLeg
      coreExtensions[vertexID][edge1.id] = coreExtensionIntoLeg
    } else {
      legDistances[vertexID][edge2.id] += coreExtensionIntoLeg
      coreExtensions[vertexID][edge2.id] = coreExtensionIntoLeg
    }

    const blockOne =
      edge1.start === vertexID ? blockDict[edge1.id].startBlock : edgeLengthOne - blockDict[edge1.id].endBlock
    const remainingEdgeLengthOne = edgeLengthOne - legDistances[vertexID][edge1.id]
    if (
      remainingEdgeLengthOne >= blockOne + APT_WIDTH + notMinSectionLength ||
      remainingEdgeLengthOne < blockOne + notMinSectionLength
    )
      legDistances[vertexID][edge1.id] += APT_WIDTH

    const blockTwo =
      edge2.start === vertexID ? blockDict[edge2.id].startBlock : edgeLengthTwo - blockDict[edge2.id].endBlock
    const remainingEdgeLengthTwo = edgeLengthTwo - legDistances[vertexID][edge2.id]
    if (
      remainingEdgeLengthTwo >= blockTwo + APT_WIDTH + notMinSectionLength ||
      remainingEdgeLengthTwo < blockTwo + notMinSectionLength
    )
      legDistances[vertexID][edge2.id] += APT_WIDTH

    legDistances[vertexID][edge1.id] = Math.min(legDistances[vertexID][edge1.id], edgeLengthOne - blockOne)
    legDistances[vertexID][edge2.id] = Math.min(legDistances[vertexID][edge2.id], edgeLengthTwo)
  }
  return { legDistances, coreExtensions }
}

export function updateAutoSections(_graph) {
  const graph = JSON.parse(JSON.stringify(_graph))
  const subGraphs = findConnectedEdges(graph)
  const autoSectionGraphs = subGraphs.filter((subGraph) =>
    Object.values(subGraph.edges).every((edge) => !edge.sectionMode || edge.sectionMode === "auto"),
  )
  if (autoSectionGraphs.length === 0) return graph
  autoSectionGraphs.forEach((subGraph) => {
    const updatedSubGraph = addAutoSections(subGraph)
    Object.values(updatedSubGraph.edges).forEach((edge) => (graph.edges[edge.id] = edge))
    Object.values(updatedSubGraph.vertices).forEach((vertex) => (graph.vertices[vertex.id] = vertex))
  })

  return graph
}

function addAutoSectionsOldStyle(graph) {
  //writes sections that are similar to the old ones - on new format.
  const NPD = 1e-8
  const APT_WIDTH = 6
  const notMinSectionLength = 16 // notMinSectionLength

  const oldGraph = deepCopy(graph)
  const { edges, vertices } = deepCopy(graph)
  const blockDict = getBlockDistances(graph)
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const vertexShouldBeSplit = getShouldVertexBeSplitMap({ vertices, edges })
  const vertexHasSection = Object.values(vertices).reduce((acc, vertex) => {
    if (!vertexShouldBeSplit[vertex.id] && vertexEdgeMap[vertex.id].length >= 2 && !collapsedVertices[vertex.id])
      acc[vertex.id] = true
    return acc
  }, {})
  const vertexHasSplitSection = Object.values(vertices).reduce((acc, vertex) => {
    if (vertexShouldBeSplit[vertex.id] && vertexEdgeMap[vertex.id].length >= 2 && !collapsedVertices[vertex.id])
      acc[vertex.id] = true
    return acc
  }, {})
  const vertexIsFree = Object.values(vertices).reduce((acc, vertex) => {
    if (vertexEdgeMap[vertex.id].length === 1 || collapsedVertices[vertex.id]) acc[vertex.id] = true
    return acc
  }, {})

  Object.values(vertices).forEach((vertex) => {
    if (vertexHasSection[vertex.id]) {
      const oneFloorStackProps =
        vertex.floorStackProps[0] || getVertexPropsFromNeighbours(vertex, oldGraph.edges, oldGraph.vertices)
      vertex.floorStackProps = [{ ...oneFloorStackProps, sectionDistances: {} }]
    } else {
      vertex.floorStackProps = []
    }
  })

  const { legDistances, coreExtensions } = getLegLengthsOfOldCorners(
    edges,
    vertices,
    vertexEdgeMap,
    blockDict,
    collapsedVertices,
    vertexShouldBeSplit,
  )

  for (let edgeID of Object.keys(edges)) {
    const edge = edges[edgeID]
    const startVertex = vertices[edge.start]
    const endVertex = vertices[edge.end]

    const { x: x0, y: y0 } = vertices[edge.start]
    const { x: x1, y: y1 } = vertices[edge.end]
    const { startBlock, endBlock } = blockDict[edge.id]
    const edgeLength = pointPointDistance([x0, y0], [x1, y1])
    const blockToBlockDistance = (endBlock ? endBlock : edgeLength) - (startBlock ? startBlock : 0)
    const doubledCornedEdge = vertexHasSection[startVertex.id] && vertexHasSection[endVertex.id]
    const startCornerEndSplit = vertexHasSection[startVertex.id] && vertexHasSplitSection[endVertex.id]
    const endCornerStartSplit = vertexHasSplitSection[startVertex.id] && vertexHasSection[endVertex.id]
    const startCornerEndFree = vertexHasSection[startVertex.id] && vertexIsFree[endVertex.id]
    const endCornerStartFree = vertexHasSection[endVertex.id] && vertexIsFree[startVertex.id]
    const minSectionLength = edge.minSubBuildingLength || 16

    const sumLegDistance = legDistances[startVertex.id][edge.id] + legDistances[endVertex.id][edge.id]
    const sumCoreExtension = coreExtensions[startVertex.id][edge.id] + coreExtensions[endVertex.id][edge.id]
    if (
      doubledCornedEdge &&
      (sumLegDistance > blockToBlockDistance - NPD ||
        blockToBlockDistance < notMinSectionLength + sumCoreExtension + NPD)
    ) {
      const cutPoint =
        startBlock + coreExtensions[startVertex.id][edge.id] + (blockToBlockDistance - sumCoreExtension) / 2
      startVertex.floorStackProps[0].sectionDistances[edge.id] = cutPoint
      endVertex.floorStackProps[0].sectionDistances[edge.id] = cutPoint
      edge.floorStackProps = []
      continue
    } else if (startCornerEndFree && legDistances[startVertex.id][edge.id] > blockToBlockDistance - NPD) {
      startVertex.floorStackProps[0].sectionDistances[edge.id] = edgeLength
      edge.floorStackProps = []
      continue
    } else if (endCornerStartFree && legDistances[endVertex.id][edge.id] > blockToBlockDistance - NPD) {
      endVertex.floorStackProps[0].sectionDistances[edge.id] = 0
      edge.floorStackProps = []
      continue
    }
    let edgeStart = 0
    let edgeEnd = edgeLength
    if (doubledCornedEdge && blockToBlockDistance < notMinSectionLength + sumCoreExtension + 2 * APT_WIDTH) {
      edgeStart = startBlock + coreExtensions[edge.start][edge.id]
      edgeEnd = endBlock - coreExtensions[edge.end][edge.id]
      startVertex.floorStackProps[0].sectionDistances[edge.id] = edgeStart
      endVertex.floorStackProps[0].sectionDistances[edge.id] = edgeEnd
    } else if (startCornerEndSplit) {
      const restLength = edgeLength - startBlock - coreExtensions[startVertex.id][edge.id]
      if (notMinSectionLength > restLength)
        edgeStart = (startBlock + coreExtensions[startVertex.id][edge.id] + edgeLength) / 2
      else if (notMinSectionLength + 2 * APT_WIDTH < restLength)
        edgeStart = startBlock + coreExtensions[startVertex.id][edge.id] + APT_WIDTH
      else edgeStart = startBlock + coreExtensions[startVertex.id][edge.id]
      edgeStart = Math.max(Math.min(edgeStart, endBlock - MIN_SECTION_DIST), startBlock)
      startVertex.floorStackProps[0].sectionDistances[edge.id] = edgeStart
      edgeEnd = edgeLength
    } else if (endCornerStartSplit) {
      const restLength = endBlock - coreExtensions[endVertex.id][edge.id]
      if (notMinSectionLength > restLength) edgeEnd = restLength / 2
      else if (notMinSectionLength + 2 * APT_WIDTH < restLength)
        edgeEnd = endBlock - coreExtensions[endVertex.id][edge.id] - APT_WIDTH
      else edgeEnd = endBlock - coreExtensions[endVertex.id][edge.id]
      edgeEnd = Math.min(Math.max(edgeEnd, startBlock + MIN_SECTION_DIST), endBlock)
      edgeStart = 0
      endVertex.floorStackProps[0].sectionDistances[edge.id] = edgeEnd
    } else {
      if (vertexHasSection[startVertex.id]) {
        const oneFloorStackProps = startVertex.floorStackProps[0]
        const sectionDistances = oneFloorStackProps.sectionDistances
        sectionDistances[edge.id] = startBlock + legDistances[startVertex.id][edge.id]
        startVertex.floorStackProps = [{ ...oneFloorStackProps, sectionDistances }]
        edgeStart = startBlock + legDistances[startVertex.id][edge.id]
      }

      if (vertexHasSection[endVertex.id]) {
        const oneFloorStackProps = endVertex.floorStackProps[0]
        const sectionDistances = oneFloorStackProps.sectionDistances
        sectionDistances[edge.id] = endBlock - legDistances[endVertex.id][edge.id]
        endVertex.floorStackProps = [{ ...oneFloorStackProps, sectionDistances }]
        edgeEnd = endBlock - legDistances[endVertex.id][edge.id]
      }
    }

    const effectiveLength = edgeEnd - edgeStart
    const noSections = Math.max(1, Math.floor(effectiveLength / minSectionLength))
    const sectionDistance = effectiveLength / noSections

    const interiorSectionDistances =
      noSections > 1
        ? Array(noSections - 1)
            .fill(0)
            .map((_, i) => edgeStart + (i + 1) * sectionDistance)
        : []

    const sectionDistances = [edgeStart, ...interiorSectionDistances, edgeEnd]
    const defaultEdgeProps = edge.floorStackProps.length === 0 ? getEdgePropsFromNeighbours(edge, graph.vertices) : null
    const _floorStackProps =
      noSections === 0 ? [] : getUpdatedPropList(edge.floorStackProps, noSections, defaultEdgeProps)
    const floorStackProps = _floorStackProps.map((fsp, i) => ({
      ...fsp,
      start: sectionDistances[i],
      end: sectionDistances[i + 1],
    }))

    edge.floorStackProps = floorStackProps
    edge.sectionMode = "auto"
  }
  return { edges, vertices }
}

export function addAutoSections(oldGraph) {
  const graph = addAutoSectionsOldStyle(oldGraph)
  return snapCloseSections(graph)
}

function getVertexTypes(vertices, edges) {
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const vertexShouldBeSplit = getShouldVertexBeSplitMap({ vertices, edges })

  const vertexType = {}
  Object.values(vertices).forEach((vertex) => {
    if (vertexShouldBeSplit[vertex.id] && vertexEdgeMap[vertex.id].length >= 2 && !collapsedVertices[vertex.id])
      vertexType[vertex.id] = "split"
    else if (vertexEdgeMap[vertex.id].length >= 2 && !collapsedVertices[vertex.id])
      vertexType[vertex.id] = "cornerSection"
    else vertexType[vertex.id] = "free"
  })
  return vertexType
}

export function snapCloseSections(oldGraph, snappingDistance = MIN_SECTION_DIST) {
  const graph = deepCopy(oldGraph)
  const vertexTypes = getVertexTypes(graph.vertices, graph.edges)
  const blockDistances = getBlockDistances(graph)
  for (let edge of Object.values(graph.edges)) {
    const startVertex = graph.vertices[edge.start]
    const endVertex = graph.vertices[edge.end]
    if (vertexTypes[edge.start] === "cornerSection" && vertexTypes[edge.end] === "cornerSection") {
      const firstCut = startVertex.floorStackProps[0].sectionDistances[edge.id]
      const lastCut = endVertex.floorStackProps[0].sectionDistances[edge.id]
      if (lastCut - firstCut < snappingDistance) {
        startVertex.floorStackProps[0].sectionDistances[edge.id] = (lastCut + firstCut) / 2
        endVertex.floorStackProps[0].sectionDistances[edge.id] = (lastCut + firstCut) / 2
        edge.floorStackProps = []
        continue
      }
    }
    if (vertexTypes[edge.start] === "cornerSection" && vertexTypes[edge.end] === "free") {
      const firstCut = startVertex.floorStackProps[0].sectionDistances[edge.id]
      const edgeLength = getEdgeLength(edge, graph.vertices)
      if (edgeLength - firstCut < snappingDistance) {
        startVertex.floorStackProps[0].sectionDistances[edge.id] = edgeLength
        edge.floorStackProps = []
        continue
      }
    }
    if (vertexTypes[edge.start] === "free" && vertexTypes[edge.end] === "cornerSection") {
      const lastCut = endVertex.floorStackProps[0].sectionDistances[edge.id]
      if (lastCut < snappingDistance) {
        endVertex.floorStackProps[0].sectionDistances[edge.id] = 0
        edge.floorStackProps = []
        continue
      }
    }
    let start = 0
    if (vertexTypes[edge.start] === "cornerSection") start = startVertex.floorStackProps[0].sectionDistances[edge.id]
    const newFloorStackProps = []
    const oldNumberOfStacks = edge.floorStackProps.length
    const { startBlock, endBlock } = blockDistances[edge.id]
    for (let i = 0; i < oldNumberOfStacks; i++) {
      const floorStackProp = edge.floorStackProps[i]
      if (Math.min(floorStackProp.end, endBlock) - Math.max(start, startBlock) >= snappingDistance) {
        floorStackProp.start = start
        newFloorStackProps.push(floorStackProp)
        start = floorStackProp.end
      }
    }
    const newNumberOfStacks = newFloorStackProps.length
    if (newNumberOfStacks > 0) {
      newFloorStackProps[newNumberOfStacks - 1].end = edge.floorStackProps[oldNumberOfStacks - 1].end
    } else if (oldNumberOfStacks > 0) {
      newFloorStackProps.push(edge.floorStackProps[oldNumberOfStacks - 1])
      newFloorStackProps[0].start = start
    }
    edge.floorStackProps = newFloorStackProps
  }
  return graph
}
