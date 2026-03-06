import { mod } from "./numpy.js"
import { COLLAPSE_ANGLE_THRESHOLD, SPLIT_CORNER_THRESHOLD } from "./constants.js"
import { getEdgeLength, getVertexEdgeMap } from "./graphHelpers.js"
import { pointPointDistance } from "./helpers/geometry.js"
import type { LineBuildingParameters } from "../../lineBuildingParameters.js"
import type { GraphVertex } from "../../shapeHelpers.js"
import type { CornerSectionProp, EdgePlus, EdgeSectionProp, GraphPlus } from "./graphBuilding3000.js"

interface FloorStackProps {
  sectionDistances: Record<string, any>
  effectiveStartLeg: number
  effectiveEndLeg: number
}

export interface VertexWithFloorStackProps extends GraphVertex {
  floorStackProps: FloorStackProps[]
}
type EdgeFloorStackProp = {
  start: number
  end: number
}
export interface EdgesWithFloorStackProps extends EdgePlus {
  floorStackProps: EdgeFloorStackProp[]
}

type EdgeBlockData = {
  startBlock?: number
  endBlock?: number
}

export type GraphWithSections = {
  edges: Record<string, EdgesWithFloorStackProps>
  vertices: Record<string, VertexWithFloorStackProps>
}
export type SectionCuts = {
  edgeSectionCuts: Record<string, EdgeFloorStackProp[]>
  vertexSectionCuts: Record<string, FloorStackProps>
}

function getBlockValue(block: number | undefined, defaultValue: number = 0): number {
  return block !== undefined ? block : defaultValue
}

export const MIN_SECTION_DIST = 0.9
// const NUMERICAL_PRECISION = 0.01

// function reverseArray(array) {
//   array = deepCopy(array)
//   array.reverse()
//   return array
// }

function intersectionOfArrays(array1: string[], array2: string[]): string[] {
  return array1.filter((value) => array2.includes(value))
}

function antiIntersectionOfArrays(array1: string[], array2: string[]) {
  const intersection = intersectionOfArrays(array1, array2)
  return [...array1, ...array2].filter((value) => !intersection.includes(value))
}

function getAngle(p0: number[], p1: number[], p2: number[]) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function getAngleBetweenEdges(edge1: EdgePlus, edge2: EdgePlus, vertices: Record<string, GraphVertex>) {
  const vertices1 = [edge1.start, edge1.end]
  const vertices2 = [edge2.start, edge2.end]
  const p1 = intersectionOfArrays(vertices1, vertices2).map((id) => [vertices[id].x, vertices[id].y])[0]
  const [p0, p2] = antiIntersectionOfArrays(vertices1, vertices2).map((id) => [vertices[id].x, vertices[id].y])
  if (p0 === undefined) return Math.PI
  return getAngle(p0, p1, p2)
}

function getCurrentBlockDistance(width: number, hoodWidth: number, angle: number, splitVertex: boolean) {
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

function getCurrentBlockDistanceOneSided(width: number, hoodWidth: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle === 0) return 0
  const shift = (0.5 * hoodWidth - 0.5 * width * Math.cos(absAngle)) / Math.sin(absAngle)
  return Math.max(shift, 0)
}

function getBlockDistancesInner(graph: GraphPlus) {
  const { vertices, edges } = graph

  const vertexEdgeMap = getVertexEdgeMap(edges)
  const shouldVertexBeSplitMap = getShouldVertexBeSplitMap(graph)
  const blockDict: Record<string, EdgeBlockData> = {}
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
      else blockDict[edgeOne.id].endBlock = getEdgeLength(edgeOne, vertices) - blockDistanceOne!
      if (vertexId === edgeTwo.start) blockDict[edgeTwo.id].startBlock = blockDistanceTwo
      else blockDict[edgeTwo.id].endBlock = getEdgeLength(edgeTwo, vertices) - blockDistanceTwo!
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

function getBlockDistancesForCorners(graph: GraphPlus) {
  const { vertices, edges } = graph
  const blockDistances = getBlockDistancesInner(graph)
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  Object.values(edges).forEach((edge) => {
    if (collapsedVertices[edge.start]) blockDistances[edge.id].startBlock = undefined
    if (collapsedVertices[edge.end]) blockDistances[edge.id].endBlock = undefined
  })
  return blockDistances
}

export function getBlockDistances(graph: GraphPlus): Record<string, EdgeBlockData> {
  const { vertices, edges } = graph
  const blockDistancesCorners = getBlockDistancesForCorners(graph)

  return Object.values(edges).reduce(
    (acc, edge) => {
      const blockFromCorners = blockDistancesCorners[edge.id]
      acc[edge.id] = {
        startBlock: blockFromCorners.startBlock || 0,
        endBlock: blockFromCorners.endBlock || getEdgeLength(edge, vertices),
      }
      return acc
    },
    {} as Record<string, EdgeBlockData>,
  )
}

export function getCollapsedVertices(vertices: Record<string, GraphVertex>, edges: Record<string, EdgePlus>) {
  const MAX_BLOCK_DIST = 25
  const MIN_DIST_BETWEEN_CORNER_BLOCKS = 0
  // const ANGLE_THRESHOLD = (5 / 6) * Math.PI
  const ANGLE_THRESHOLD = COLLAPSE_ANGLE_THRESHOLD
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const splitCorners = getShouldVertexBeSplitMap({ edges, vertices })
  const blockDistances = getBlockDistancesInner({ vertices, edges })
  const collapsedVertices: Record<string, string | boolean> = {}

  for (let vertexId in vertexEdgeMap) {
    if (vertexEdgeMap[vertexId].length === 2) {
      const [edgeOne, edgeTwo] = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId])
      const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
      if (Math.abs(angle) > ANGLE_THRESHOLD) {
        collapsedVertices[vertexId] = vertexId
        continue
      }
      const splitCorner = splitCorners[vertexId]
      const blockDistanceOne = getCurrentBlockDistance(edgeOne.width, edgeTwo.width, angle, splitCorner)!
      const blockDistanceTwo = getCurrentBlockDistance(edgeTwo.width, edgeOne.width, angle, splitCorner)!
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
      const angle0 = edge0 ? getAngleBetweenEdges(edge0, edge, vertices) : 0
      const angle1 = edge2 ? getAngleBetweenEdges(edge, edge2, vertices) : 0
      if (angle0 * angle1 > 0) {
        collapsedVertices[edge.start] = true
        collapsedVertices[edge.end] = true
      }
    }
  }
  return collapsedVertices
}

export function getShouldVertexBeSplitMap(graph: GraphPlus) {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(edges)

  const shouldVertexBeSplitMap: Record<string, boolean> = {}
  for (let vertexId in vertexEdgeMap) {
    const edges = vertexEdgeMap[vertexId].map((edgeId) => graph.edges[edgeId])
    if (edges.length !== 2) {
      shouldVertexBeSplitMap[vertexId] = false
      continue
    }
    const [edgeOne, edgeTwo] = edges
    const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
    // shouldVertexBeSplitMap[vertexId] = Math.abs(angle) < (1 / 3) * Math.PI
    shouldVertexBeSplitMap[vertexId] = Math.abs(angle) < SPLIT_CORNER_THRESHOLD
  }
  return shouldVertexBeSplitMap
}

function getLegLengthsOfOldCorners(
  edges: Record<string, EdgePlus>,
  vertices: Record<string, VertexWithFloorStackProps>,
  vertexEdgeMap: Record<string, string[]>,
  blockDict: Record<string, EdgeBlockData>,
  collapsedVertices: Record<string, string | boolean>,
  vertexShouldBeSplit: Record<string, boolean>,
  settings: LineBuildingParameters,
) {
  const sectionProps = settings.sectionProps

  const legDistances: Record<string, Record<string, number>> = {}
  for (let vertex of Object.values(vertices)) {
    legDistances[vertex.id] = {}
    vertexEdgeMap[vertex.id].forEach((edgeID) => {
      legDistances[vertex.id][edgeID] = 0
    })
  }

  for (let vertexID in vertexEdgeMap) {
    if (collapsedVertices[vertexID]) continue
    if (vertexShouldBeSplit[vertexID]) continue
    if (vertexEdgeMap[vertexID].length !== 2) continue

    const sectionId = vertexID + "::" + 0

    let startLeg: number = (sectionProps[sectionId] as CornerSectionProp)?.startLeg
    if (startLeg === undefined) startLeg = 0
    let endLeg = (sectionProps[sectionId] as CornerSectionProp)?.endLeg
    if (endLeg === undefined) endLeg = 0

    const [edge1, edge2] = vertexEdgeMap[vertexID].map((edgeID) => edges[edgeID])

    const startEdge = edge1.end === vertexID ? edge1 : edge2
    const endEdge = edge1.start === vertexID ? edge1 : edge2

    const edgeLengthOne = getEdgeLength(startEdge, vertices)
    const edgeLengthTwo = getEdgeLength(endEdge, vertices)

    legDistances[vertexID][startEdge.id] = startLeg
    legDistances[vertexID][endEdge.id] = endLeg
    const blockOne =
      startEdge.start === vertexID
        ? getBlockValue(blockDict[startEdge.id].startBlock)
        : edgeLengthOne - getBlockValue(blockDict[startEdge.id].endBlock)

    legDistances[vertexID][startEdge.id] = Math.min(legDistances[vertexID][startEdge.id], edgeLengthOne - blockOne)
    legDistances[vertexID][endEdge.id] = Math.min(legDistances[vertexID][endEdge.id], edgeLengthTwo)
  }
  return { legDistances }
}

function getCustomSectionDistanceDict(
  graph: GraphPlus,
  settings: LineBuildingParameters,
  minSubBuildingLength: number,
) {
  const sectionDistanceDict: Record<string, number[]> = {}
  if (!settings.sectionProps) return sectionDistanceDict
  const sectionIDs = Object.keys(settings.sectionProps)
  const edgeIDs = Object.keys(graph.edges)

  for (let edgeID of edgeIDs) {
    const sectionIDsOnEdge = sectionIDs.filter((sectionID) => {
      const sectionEdgeID = sectionID.split("::")[0]
      return edgeID === sectionEdgeID
    })
    let maxIndex = -1
    sectionIDsOnEdge.forEach((sectionID) => {
      const index = parseInt(sectionID.split("::")[1])
      maxIndex = Math.max(index, maxIndex)
    })
    const sectionDistances: number[] = []
    let prevValue
    for (let i = 0; i <= maxIndex; i++) {
      const sectionID = edgeID + "::" + i
      const sectionDistance: number =
        (settings.sectionProps[sectionID] as EdgeSectionProp)?.minSubBuildingLength || prevValue || minSubBuildingLength
      sectionDistances.push(sectionDistance)
      prevValue = sectionDistance
    }
    sectionDistanceDict[edgeID] = sectionDistances
  }

  return sectionDistanceDict
}

function addAutoSectionsOldStyle(
  graph: GraphPlus,
  settings: LineBuildingParameters,
): { graphWithSections: GraphWithSections } {
  const { minSubBuildingLength } = settings
  const customSectionDistanceDict = getCustomSectionDistanceDict(graph, settings, minSubBuildingLength)
  //writes sections that are similar to the old ones - on new format.
  const NPD = 1e-8

  const { edges, vertices } = structuredClone(graph)
  const blockDict = getBlockDistances(graph)
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  const vertexEdgeMap = getVertexEdgeMap(edges)
  const vertexShouldBeSplit = getShouldVertexBeSplitMap({ vertices, edges })
  const vertexHasSection = Object.values(vertices).reduce(
    (acc, vertex) => {
      if (!vertexShouldBeSplit[vertex.id] && vertexEdgeMap[vertex.id].length >= 2 && !collapsedVertices[vertex.id])
        acc[vertex.id] = true
      return acc
    },
    {} as Record<string, boolean>,
  )
  const vertexHasSplitSection = Object.values(vertices).reduce(
    (acc, vertex) => {
      if (vertexShouldBeSplit[vertex.id] && vertexEdgeMap[vertex.id].length >= 2 && !collapsedVertices[vertex.id])
        acc[vertex.id] = true
      return acc
    },
    {} as Record<string, boolean>,
  )
  const vertexIsFree = Object.values(vertices).reduce(
    (acc, vertex) => {
      if (vertexEdgeMap[vertex.id].length === 1 || collapsedVertices[vertex.id]) acc[vertex.id] = true
      return acc
    },
    {} as Record<string, boolean>,
  )

  const updatedVertices: Record<string, VertexWithFloorStackProps> = {}
  Object.entries(vertices).forEach(([key, vertex]) => {
    const vertextWithFloorStackProps = vertex as VertexWithFloorStackProps
    if (vertexHasSection[vertex.id]) {
      vertextWithFloorStackProps.floorStackProps = [{ sectionDistances: {}, effectiveStartLeg: 0, effectiveEndLeg: 0 }]
    } else {
      vertextWithFloorStackProps.floorStackProps = []
    }
    updatedVertices[key] = vertextWithFloorStackProps
  })

  const { legDistances } = getLegLengthsOfOldCorners(
    edges,
    updatedVertices,
    vertexEdgeMap,
    blockDict,
    collapsedVertices,
    vertexShouldBeSplit,
    settings,
  )

  for (let edgeID of Object.keys(edges)) {
    const edge = edges[edgeID] as EdgesWithFloorStackProps
    const startVertex = updatedVertices[edge.start]
    const endVertex = updatedVertices[edge.end]

    const { x: x0, y: y0 } = updatedVertices[edge.start]
    const { x: x1, y: y1 } = updatedVertices[edge.end]
    const { startBlock: rawStartBlock, endBlock: rawEndBlock } = blockDict[edge.id]
    const startBlock = getBlockValue(rawStartBlock)
    const edgeLength = pointPointDistance([x0, y0], [x1, y1])
    const endBlock = getBlockValue(rawEndBlock, edgeLength)

    const blockToBlockDistance = endBlock - startBlock

    const doubledCornedEdge = vertexHasSection[startVertex.id] && vertexHasSection[endVertex.id]
    const startCornerEndSplit = vertexHasSection[startVertex.id] && vertexHasSplitSection[endVertex.id]
    const endCornerStartSplit = vertexHasSplitSection[startVertex.id] && vertexHasSection[endVertex.id]
    const startCornerEndFree = vertexHasSection[startVertex.id] && vertexIsFree[endVertex.id]
    const endCornerStartFree = vertexHasSection[endVertex.id] && vertexIsFree[startVertex.id]

    const startCornerLeg = legDistances[startVertex.id][edge.id]
    const endCornerLeg = legDistances[endVertex.id][edge.id]
    const sumLegDistance = legDistances[startVertex.id][edge.id] + legDistances[endVertex.id][edge.id]

    if (doubledCornedEdge && blockToBlockDistance < sumLegDistance + NPD) {
      const cutPoint = startBlock + blockToBlockDistance * (startCornerLeg / sumLegDistance)
      startVertex.floorStackProps[0].sectionDistances[edge.id] = cutPoint
      endVertex.floorStackProps[0].sectionDistances[edge.id] = cutPoint

      startVertex.floorStackProps[0].effectiveEndLeg = cutPoint - startBlock
      endVertex.floorStackProps[0].effectiveStartLeg = endBlock - cutPoint

      edge.floorStackProps = []
      continue
    } else if (startCornerEndFree && startCornerLeg > blockToBlockDistance - NPD) {
      startVertex.floorStackProps[0].sectionDistances[edge.id] = edgeLength
      startVertex.floorStackProps[0].effectiveEndLeg = edgeLength - startBlock
      edge.floorStackProps = []
      continue
    } else if (endCornerStartFree && endCornerLeg > blockToBlockDistance - NPD) {
      endVertex.floorStackProps[0].sectionDistances[edge.id] = 0
      endVertex.floorStackProps[0].effectiveStartLeg = endBlock
      edge.floorStackProps = []
      continue
    }
    let edgeStart = 0
    let edgeEnd = edgeLength
    if (startCornerEndSplit) {
      edgeStart = Math.max(Math.min(startBlock + startCornerLeg, endBlock), startBlock)
      startVertex.floorStackProps[0].sectionDistances[edge.id] = edgeStart
      startVertex.floorStackProps[0].effectiveEndLeg = edgeStart - startBlock
      edgeEnd = edgeLength
    } else if (endCornerStartSplit) {
      edgeEnd = Math.min(Math.max(endBlock - endCornerLeg, startBlock), endBlock)
      edgeStart = 0
      endVertex.floorStackProps[0].sectionDistances[edge.id] = edgeEnd
      endVertex.floorStackProps[0].effectiveStartLeg = endBlock - edgeEnd
    } else {
      if (vertexHasSection[startVertex.id]) {
        const oneFloorStackProps = startVertex.floorStackProps[0]
        const sectionDistances = oneFloorStackProps.sectionDistances
        sectionDistances[edge.id] = startBlock + startCornerLeg
        startVertex.floorStackProps = [{ ...oneFloorStackProps, sectionDistances, effectiveEndLeg: startCornerLeg }]
        edgeStart = startBlock + startCornerLeg
      }

      if (vertexHasSection[endVertex.id]) {
        const oneFloorStackProps = endVertex.floorStackProps[0]
        const sectionDistances = oneFloorStackProps.sectionDistances
        sectionDistances[edge.id] = endBlock - endCornerLeg
        endVertex.floorStackProps = [{ ...oneFloorStackProps, sectionDistances, effectiveStartLeg: endCornerLeg }]
        edgeEnd = endBlock - endCornerLeg
      }
    }

    const startIsSplit = vertexHasSplitSection[startVertex.id]
    const endIsSplit = vertexHasSplitSection[endVertex.id]

    const interiorSectionDistances = []

    const customSectionDistances = customSectionDistanceDict[edgeID] || []
    let dist = startIsSplit ? startBlock : edgeStart
    let noSections = 1
    let prevSectionDistance
    for (let i = 0; i < 100; i++) {
      const sectionDistance: number = customSectionDistances[i] || prevSectionDistance || minSubBuildingLength
      dist = dist + sectionDistance
      if ((endIsSplit && dist >= endBlock - NPD) || dist >= edgeEnd - NPD) break
      noSections += 1
      interiorSectionDistances.push(dist)
      prevSectionDistance = sectionDistance
    }

    const sectionDistances = [edgeStart, ...interiorSectionDistances, edgeEnd]

    const floorStackProps = []
    for (let i = 0; i < noSections; i++) {
      floorStackProps.push({
        start: sectionDistances[i],
        end: sectionDistances[i + 1],
      })
    }
    edge.floorStackProps = floorStackProps
  }
  const graphWithSections = {
    edges: edges as Record<string, EdgesWithFloorStackProps>,
    vertices: updatedVertices,
  } as GraphWithSections

  return { graphWithSections }
}

function graphWithSectionsToSectionCuts(graphWithSections: GraphWithSections) {
  const edgeSectionCuts: Record<string, EdgeFloorStackProp[]> = {}
  Object.values(graphWithSections.edges).forEach((edge) => {
    const { id, floorStackProps } = edge
    edgeSectionCuts[id] = floorStackProps
  })

  const vertexSectionCuts: Record<string, FloorStackProps> = {}
  Object.values(graphWithSections.vertices).forEach((vertex) => {
    const { id, floorStackProps } = vertex
    if (floorStackProps.length > 0) vertexSectionCuts[id] = floorStackProps[0]
  })
  return { edgeSectionCuts, vertexSectionCuts }
}

function mergeShortEndSectionsIntoCorners(graph: GraphPlus, sectionCuts: SectionCuts) {
  for (let edge of Object.values(graph.edges)) {
    const endCornerCuts = sectionCuts.vertexSectionCuts[edge.end]
    if (!endCornerCuts) continue

    const edgeCuts = sectionCuts.edgeSectionCuts[edge.id]
    const n = edgeCuts.length

    if (n === 0) continue
    const lastSection = edgeCuts[n - 1]
    const dist = lastSection.end - lastSection.start
    if (dist >= 3) continue

    sectionCuts.edgeSectionCuts[edge.id] = edgeCuts.slice(0, n - 1)
    sectionCuts.vertexSectionCuts[edge.end].effectiveStartLeg = endCornerCuts.effectiveStartLeg + dist
  }
  return sectionCuts
}

export function getAutoSections(graph: GraphPlus, settings: LineBuildingParameters) {
  const { graphWithSections } = addAutoSectionsOldStyle(graph, settings)

  let sectionCuts = graphWithSectionsToSectionCuts(graphWithSections)

  return mergeShortEndSectionsIntoCorners(graph, sectionCuts)
}
