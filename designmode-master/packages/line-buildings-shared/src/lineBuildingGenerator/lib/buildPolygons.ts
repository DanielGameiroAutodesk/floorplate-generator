import { reverseArray } from "./helpers/helpers.js"
import {
  addVectorsToPoint,
  getNormalizedVectorFromPointToPoint,
  getVectorFromPointToPoint,
  movePointAlongVector,
  pointPointDistance,
} from "./helpers/geometry.js"
import type { EdgePlus, GraphPlus } from "./graphBuilding3000.js"
import { getCollapsedVertices, type SectionCuts } from "./autoSections.js"
import type { GraphVertex } from "../../shapeHelpers.js"
import type { Vec2 } from "./lineBuilding9000/graphLineHelpers.js"
import type { Point } from "./lineBuilding9000/BuildingTypes.js"
import { getAngleBetweenEdges, getVertexEdgeMap } from "./graphHelpers.js"
import type { LineBuildingParameters } from "../../lineBuildingParameters.js"

export type Section = {
  startWall: Point[]
  endWall: Point[]
  type: "Rectangle" | "Split"
  width: number
  length?: number
}

export type EdgeSection = {
  edge: EdgePlus
  sections: Section[]
  exteriorPolygon: any[]
}

export type CornerSection = {
  exteriorPolygon: Point[]
  vertex: GraphVertex
  startLeg: number
  endLeg: number
  blockDist: number
  angle: number
  startLegUnitVec: Vec2
  endLegUnitVec: Vec2
  startLegLowerPoint: Vec2
  startLegUpperPoint: Vec2
  endLegLowerPoint: Vec2
  endLegUpperPoint: Vec2
}

function shiftSections(sections: Section[], normal: Point, shiftLength: number) {
  const shiftedSections = sections.map(({ startWall, endWall, type, width }, i) => {
    const shift = (i - (sections.length - 1) / 2) * shiftLength
    return {
      startWall: startWall.map((p) => movePointAlongVector(p, normal, shift)),
      endWall: endWall.map((p) => movePointAlongVector(p, normal, shift)),
      type,
      width,
    }
  })
  const bottomWall: number[][] = []
  const topWall: number[][] = []
  const connectedSections = shiftedSections.map(({ startWall, endWall, type, width }, i) => {
    bottomWall.push(startWall[0])
    bottomWall.push(endWall[0])
    topWall.push(startWall[1])
    topWall.push(endWall[1])

    const newStartWall =
      i > 0
        ? [
            startWall[0],
            shiftLength < 0 ? shiftedSections[i - 1].endWall[1] : shiftedSections[i - 1].endWall[0],
            startWall[1],
          ]
        : startWall
    const newEndWall =
      i < shiftedSections.length - 1
        ? [
            endWall[0],
            shiftLength < 0 ? shiftedSections[i + 1].startWall[0] : shiftedSections[i + 1].startWall[1],
            endWall[1],
          ]
        : endWall
    return {
      startWall: newStartWall,
      endWall: newEndWall,
      type,
      width,
    }
  })
  return {
    newExteriorPolygon: [...topWall, ...bottomWall.reverse()],
    newSections: connectedSections,
  }
}

function shiftEdgeSections(edgeSections: EdgeSection[], graph: GraphPlus): EdgeSection[] {
  const freeEdgeIds = Object.values(graph.edges)
    .filter(
      (e) =>
        !Object.values(graph.edges).some(
          (otherEdge) =>
            e.id !== otherEdge.id &&
            (e.start === otherEdge.start ||
              e.start === otherEdge.end ||
              e.end === otherEdge.start ||
              e.end === otherEdge.end),
        ),
    )
    .map((e) => e.id)

  return edgeSections.map((edgeSection) => {
    if (!edgeSection) return edgeSection
    const { edge, sections, exteriorPolygon } = edgeSection
    if (freeEdgeIds.includes(edge.id) && sections.length > 1) {
      const edgeDirection = getVectorFromPointToPoint(
        [graph.vertices[edge.start].x, graph.vertices[edge.start].y],
        [graph.vertices[edge.end].x, graph.vertices[edge.end].y],
      )
      const normal = [-edgeDirection[1], edgeDirection[0]] as Point
      // @ts-expect-error: Not sure why this is not part of type.
      const shiftLength = (edge.shiftFactor || 0) * edge.width
      const { newExteriorPolygon, newSections } =
        Math.abs(shiftLength) > 1e-1
          ? shiftSections(sections, normal, shiftLength)
          : { newSections: sections, newExteriorPolygon: exteriorPolygon }
      return {
        ...edgeSection,
        exteriorPolygon: newExteriorPolygon,
        sections: newSections,
      }
    } else return edgeSection
  })
}

function getCutCornerWall(
  edgeId: string,
  vertexId: string,
  vertexEdgeMap: Record<string, string[]>,
  edges: Record<string, EdgePlus>,
  vertices: Record<string, GraphVertex>,
) {
  const [edgeOne, edgeTwo] = vertexEdgeMap[vertexId].map((edgeId) => edges[edgeId]).sort((a, b) => b.width - a.width)
  const angle = getAngleBetweenEdges(edgeOne, edgeTwo, vertices)
  const [p0, p1] = [vertexId, edgeOne.start === vertexId ? edgeOne.end : edgeOne.start].map<Point>((id) => [
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

  const flip = (edgeOne.id === edgeId) === (vertexId === edges[edgeId].start)
  return flip ? wall : reverseArray(wall)
}

function getEdgeSections(graph: GraphPlus, sectionCuts: SectionCuts, settings: LineBuildingParameters): EdgeSection[] {
  const { edges, vertices } = graph
  const { width } = settings

  const vertexEdgeMap = getVertexEdgeMap(edges)
  const collapsedVertices = getCollapsedVertices(vertices, edges)
  const splitCornerMap = Object.values(vertices).reduce(
    (acc, vertex) => {
      const vertexHasSection = sectionCuts.vertexSectionCuts[vertex.id] !== undefined
      if (!vertexHasSection && !collapsedVertices[vertex.id] && vertexEdgeMap[vertex.id].length === 2)
        acc[vertex.id] = true
      return acc
    },
    {} as Record<string, boolean>,
  )

  return Object.values(edges)
    .map((edge) => {
      const sectionIntervals = sectionCuts.edgeSectionCuts[edge.id]
      if (sectionIntervals.length === 0) return null
      const [p0, p1] = [edge.start, edge.end].map((vertexID) => [vertices[vertexID].x, vertices[vertexID].y]) as [
        Point,
        Point,
      ]
      const unitVec = getNormalizedVectorFromPointToPoint(p0, p1)
      const normVec = [-unitVec[1], unitVec[0]]

      const sectionDistances = [sectionIntervals[0].start].concat(sectionIntervals.flatMap((fsp) => fsp.end))
      const walls = sectionDistances.map((sectionDistance) => [
        addVectorsToPoint(p0, unitVec, sectionDistance, normVec, 0.5 * width),
        addVectorsToPoint(p0, unitVec, sectionDistance, normVec, -0.5 * width),
      ])
      const startSplit = splitCornerMap[edge.start]
      const endSplit = splitCornerMap[edge.end]
      if (startSplit) walls[0] = getCutCornerWall(edge.id, edge.start, vertexEdgeMap, edges, vertices)
      if (endSplit) walls[walls.length - 1] = getCutCornerWall(edge.id, edge.end, vertexEdgeMap, edges, vertices)

      const sections: Section[] = []
      for (let i = 0; i < walls.length - 1; i++) {
        const startWall = walls[i]
        const endWall = walls[i + 1]
        const splitSection = (startSplit && i === 0) || (endSplit && i === walls.length - 2)
        if (splitSection) {
          sections.push({ startWall, endWall, type: "Split", width })
        } else {
          const length = sectionDistances[i + 1] - sectionDistances[i]
          sections.push({ startWall, endWall, type: "Rectangle", width, length })
        }
      }
      const exteriorPolygon = [...walls[0], ...reverseArray(walls[walls.length - 1])]
      return { edge, sections, exteriorPolygon } satisfies EdgeSection
    })
    .filter((it) => it != null)
}

function getAngle(p1: any, p2: any, p3: any) {
  const vec1 = [p1[0] - p2[0], p1[1] - p2[1]]
  const vec2 = [p3[0] - p2[0], p3[1] - p2[1]]
  const dot = vec1[0] * vec2[0] + vec1[1] * vec2[1]
  const length1 = Math.sqrt(Math.pow(vec2[0], 2) + Math.pow(vec2[1], 2))
  const length2 = Math.sqrt(Math.pow(vec1[0], 2) + Math.pow(vec1[1], 2))
  const productLength = length2 * length1
  const cosAngle = Math.max(Math.min(productLength > 0 ? dot / productLength : 1, 1), -1)
  const orth = [-vec2[1], vec2[0]]
  const dotOrth = vec1[0] * orth[0] + vec1[1] * orth[1]
  const sign = dotOrth < 0 ? 1 : -1
  return sign * Math.acos(cosAngle)
}

export function getNormVector(p1: any, p2: any) {
  const vec = [p2[0] - p1[0], p2[1] - p1[1]]
  const len = Math.sqrt(Math.pow(vec[0], 2) + Math.pow(vec[1], 2))
  return len < 1e-8 ? vec : [vec[0] / len, vec[1] / len]
}

function getRelativeEdgeProps(edge: any, vertices: any, vertexId: any, width: any) {
  const flipped = edge.end === vertexId
  const start: Point = flipped
    ? [vertices[edge.end].x, vertices[edge.end].y]
    : [vertices[edge.start].x, vertices[edge.start].y]
  const end: Point = flipped
    ? [vertices[edge.start].x, vertices[edge.start].y]
    : [vertices[edge.end].x, vertices[edge.end].y]

  const direction = getNormVector(start, end)
  const normal = [-direction[1], direction[0]]
  return {
    direction,
    normal,
    point: end,
    width,
    length: pointPointDistance(start, end),
    edgeId: edge.id,
    otherVertexId: flipped ? edge.start : edge.end,
    flipped,
  }
}

export function getNeighbourEdgeProps(edges: any, vertices: any, vertexId: any, width: any) {
  const neighbourEdges = Object.values(edges).filter((edge: any) => edge.start === vertexId || edge.end === vertexId)
  if (neighbourEdges.length !== 2) return null

  const center = [vertices[vertexId].x, vertices[vertexId].y]
  const first = getRelativeEdgeProps(neighbourEdges[0], vertices, vertexId, width)
  const second = getRelativeEdgeProps(neighbourEdges[1], vertices, vertexId, width)

  const signedAngle = getAngle(first.point, center, second.point)
  const right = signedAngle > 0 ? first : second
  const left = signedAngle > 0 ? second : first

  const angle = Math.abs(signedAngle)
  return { center, right, left, angle }
}

//////
//
///

function getBlockDistanceForSimpleCorner(width: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = (0.5 * width) / Math.cos(absAngle - Math.PI / 2)
    const dist2 = (0.5 * width) / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (0.5 * width - 0.5 * width * Math.cos(absAngle)) / Math.sin(absAngle)
  return Math.abs(shift)
}

function movePointAlongDirectionXY(point: Vec2, unitVec: Vec2, distance: number): Vec2 {
  const x = point.x + distance * unitVec.x
  const y = point.y + distance * unitVec.y
  return { x, y }
}

function getUnitVectorXY(pointOne: GraphVertex, pointTwo: GraphVertex): Vec2 {
  const length = ((pointTwo.x - pointOne.x) ** 2 + (pointTwo.y - pointOne.y) ** 2) ** 0.5
  const x = (pointTwo.x - pointOne.x) / length
  const y = (pointTwo.y - pointOne.y) / length
  return { x, y }
}

function getAngleXY(p0: GraphVertex, p1: GraphVertex, p2: GraphVertex): number {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function getCornerSectionWithLegs({
  cornerVertex,
  prevVertex,
  nextVertex,
  width,
  startLeg,
  endLeg,
}: {
  cornerVertex: GraphVertex
  prevVertex: GraphVertex
  nextVertex: GraphVertex
  width: number
  startLeg: number
  endLeg: number
}): CornerSection {
  const angle = getAngleXY(prevVertex, cornerVertex, nextVertex)
  const blockDist = getBlockDistanceForSimpleCorner(width, angle)

  const unitVecOne = getUnitVectorXY(prevVertex, cornerVertex)
  const normalVecOne = { x: -unitVecOne.y, y: unitVecOne.x } as Vec2
  const unitVecTwo = getUnitVectorXY(cornerVertex, nextVertex)
  const normalVecTwo = { x: -unitVecTwo.y, y: unitVecTwo.x } as Vec2

  const c0 = movePointAlongDirectionXY(cornerVertex, unitVecOne, -(blockDist + startLeg))

  const startLegCenterPoint = movePointAlongDirectionXY(cornerVertex, unitVecOne, -(blockDist + startLeg))
  const startLegUpperPoint = movePointAlongDirectionXY(startLegCenterPoint, normalVecOne, 0.5 * width)
  const startLegLowerPoint = movePointAlongDirectionXY(startLegCenterPoint, normalVecOne, -0.5 * width)

  const endLegCenterPoint = movePointAlongDirectionXY(cornerVertex, unitVecTwo, blockDist + endLeg)
  const endLegUpperPoint = movePointAlongDirectionXY(endLegCenterPoint, normalVecTwo, 0.5 * width)
  const endLegLowerPoint = movePointAlongDirectionXY(endLegCenterPoint, normalVecTwo, -0.5 * width)

  if (angle < 0) {
    const footPrintXY = []
    const p0 = movePointAlongDirectionXY(c0, normalVecOne, 0.5 * width)
    let p = movePointAlongDirectionXY(c0, normalVecOne, -0.5 * width)
    footPrintXY.push(p0, p)
    if (startLeg > 0) {
      p = movePointAlongDirectionXY(p, unitVecOne, startLeg)
      footPrintXY.push(p)
    }
    if (endLeg > 0) {
      p = movePointAlongDirectionXY(p, unitVecTwo, endLeg)
      footPrintXY.push(p)
    }
    p = movePointAlongDirectionXY(p, normalVecTwo, width)
    footPrintXY.push(p)
    p = movePointAlongDirectionXY(p, unitVecTwo, -2 * blockDist - endLeg)
    footPrintXY.push(p)

    const footPrint = footPrintXY.map<Point>((point) => {
      return [point.x, point.y]
    })
    return {
      exteriorPolygon: footPrint,
      vertex: cornerVertex,
      startLeg,
      endLeg,
      blockDist,
      angle,
      startLegUnitVec: unitVecOne,
      endLegUnitVec: unitVecTwo,
      startLegLowerPoint,
      startLegUpperPoint,
      endLegLowerPoint,
      endLegUpperPoint,
    }
  } else {
    const footPrintXY = []
    let p = movePointAlongDirectionXY(c0, normalVecOne, -0.5 * width)
    footPrintXY.push(p)
    p = movePointAlongDirectionXY(p, unitVecOne, 2 * blockDist + startLeg)
    footPrintXY.push(p)

    p = movePointAlongDirectionXY(p, unitVecTwo, 2 * blockDist + endLeg)
    footPrintXY.push(p)

    p = movePointAlongDirectionXY(p, normalVecTwo, width)
    footPrintXY.push(p)
    if (endLeg > 0) {
      p = movePointAlongDirectionXY(p, unitVecTwo, -endLeg)
      footPrintXY.push(p)
    }
    if (startLeg > 0) {
      p = movePointAlongDirectionXY(p, unitVecOne, -startLeg)
      footPrintXY.push(p)
    }

    const footPrint = footPrintXY.map<Point>((point) => {
      return [point.x, point.y]
    })
    return {
      exteriorPolygon: footPrint,
      vertex: cornerVertex,
      startLeg,
      endLeg,
      blockDist,
      angle,
      startLegUnitVec: unitVecOne,
      endLegUnitVec: unitVecTwo,
      startLegLowerPoint,
      startLegUpperPoint,
      endLegLowerPoint,
      endLegUpperPoint,
    }
  }
}

function getCornerSections(
  graph: GraphPlus,
  sectionCuts: SectionCuts,
  settings: LineBuildingParameters,
): CornerSection[] {
  const { edges, vertices } = graph
  const { width } = settings

  const cornerSections = []
  for (const vertexId in vertices) {
    const hasCornerSection = !!sectionCuts.vertexSectionCuts[vertexId]
    if (!hasCornerSection) continue
    const vertexSectionCut = sectionCuts.vertexSectionCuts[vertexId]
    const prevEdge = Object.values(edges).find((edge) => edge.end === vertexId)
    const nextEdge = Object.values(edges).find((edge) => edge.start === vertexId)
    if (prevEdge && nextEdge) {
      const prevVertex = vertices[prevEdge.start]
      const nextVertex = vertices[nextEdge.end]
      const cornerVertex = vertices[vertexId]
      const cornerSection = getCornerSectionWithLegs({
        cornerVertex,
        prevVertex,
        nextVertex,
        width,
        startLeg: vertexSectionCut.effectiveStartLeg,
        endLeg: vertexSectionCut.effectiveEndLeg,
      })
      cornerSections.push(cornerSection)
    }
  }

  return cornerSections.filter((section) => section)
}

export function getSectionsForGraph(graph: GraphPlus, sectionCuts: SectionCuts, settings: LineBuildingParameters) {
  const edgeSections: EdgeSection[] = getEdgeSections(graph, sectionCuts, settings)
  const cornerSections = getCornerSections(graph, sectionCuts, settings)

  const shiftedSections = shiftEdgeSections(edgeSections, graph)
  return { cornerSections: cornerSections, edgeSections: shiftedSections }
}

export function getBuildingSectionFromGraph(
  graph: GraphPlus,
  sectionCuts: SectionCuts,
  settings: LineBuildingParameters,
) {
  if (!graph?.vertices || !graph?.edges) {
    return { cornerSections: [], edgeSections: [] }
  }
  const { cornerSections, edgeSections } = getSectionsForGraph(graph, sectionCuts, settings)

  return { cornerSections, edgeSections }
}
