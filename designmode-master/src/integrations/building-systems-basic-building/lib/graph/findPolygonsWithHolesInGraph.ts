import type { PolygonXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import {
  areaOfPolygon,
  isPointInsidePolygon,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { Graph, Vertex } from "./graph"
import { splitGraphInConnectedSubGraphs } from "./graph"
import { getVertexLoopsFromGraph } from "./findLoopsInGraph"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"

function getSubGraphTree(subGraphUnitsAndGroup: SubGraphUnitsAndGroup[]) {
  const n = subGraphUnitsAndGroup.length
  const childGroups: Record<string, string[]> = {}
  const parentGroup: Record<string, string> = {}
  for (let i = 0; i < n; i++) {
    const groupId = subGraphUnitsAndGroup[i].groupId
    childGroups[groupId] = []
  }
  const areas = subGraphUnitsAndGroup.map(({ groupPolygon }) => areaOfPolygon(groupPolygon))
  for (let i = 0; i < n; i++) {
    let minArea = Infinity
    let parentIndex = undefined
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const { groupPolygon: childPolygon } = subGraphUnitsAndGroup[i]
      const { groupPolygon: parentPolygon } = subGraphUnitsAndGroup[j]
      const pointInsidePolygon = isPointInsidePolygon(childPolygon[0], parentPolygon)
      if (pointInsidePolygon && areas[j] < minArea) {
        minArea = areas[j]
        parentIndex = j
      }
    }
    if (parentIndex !== undefined) {
      const parentId = subGraphUnitsAndGroup[parentIndex].groupId
      const childId = subGraphUnitsAndGroup[i].groupId
      childGroups[parentId].push(childId)
      parentGroup[childId] = parentId
    }
  }
  return { childGroups, parentGroup }
}

function findHolesInPolygon(
  groupId: string,
  polygon: PolygonXY,
  childGroups: Record<string, string[]>,
  subGraphUnitsAndGroup: SubGraphUnitsAndGroup[],
): VertexPolygon[] {
  if (childGroups[groupId].length === 0) return []
  const childPolys = subGraphUnitsAndGroup
    .filter(({ groupId: childGroupId }) => childGroups[groupId].includes(childGroupId))
    .map(({ groupPolygon }) => groupPolygon)
    .filter((groupPolygon) => {
      return isPointInsidePolygon(groupPolygon[0], polygon)
    })
  return childPolys.reverse()
}

function getRootGroup(parentGroup: Record<string, string>, groupId: string) {
  let rootGroupId = groupId
  while (parentGroup[rootGroupId]) {
    rootGroupId = parentGroup[rootGroupId]
  }
  return rootGroupId
}

type VertexPolygon = Vertex[]
type GroupedPolygonWithHoles = { polygon: VertexPolygon; holes: VertexPolygon[]; groupId: string }
type SubGraphUnitsAndGroup = {
  subGraph: Graph
  polygons: VertexPolygon[]
  groupPolygon: VertexPolygon
  groupId: string
}
export function findPolygonsWithHolesInGraph(graph: Graph) {
  const polygonsWithHoles: GroupedPolygonWithHoles[] = []
  const subGraphs = splitGraphInConnectedSubGraphs(graph)
  const subGraphUnitsAndGroup: SubGraphUnitsAndGroup[] = subGraphs
    .map((subGraph) => {
      const { innerLoops, outerLoops } = getVertexLoopsFromGraph(subGraph)
      const groupPolygon = outerLoops[0]
      const groupId = randomId()
      return { subGraph, polygons: innerLoops, groupPolygon, groupId }
    })
    .filter(({ groupPolygon }) => groupPolygon)

  const { childGroups, parentGroup } = getSubGraphTree(subGraphUnitsAndGroup)

  subGraphUnitsAndGroup.forEach(({ polygons, groupId }) => {
    const rootGroupId = getRootGroup(parentGroup, groupId)
    const subUnits = polygons.map((polygon): GroupedPolygonWithHoles => {
      const holes = findHolesInPolygon(groupId, polygon, childGroups, subGraphUnitsAndGroup)
      return {
        polygon,
        holes,
        groupId: rootGroupId,
      }
    })
    polygonsWithHoles.push(...subUnits)
  })

  return polygonsWithHoles
}

export function findOuterLoopsOfGraph(graph: Graph) {
  const outerLoopsOfGraph: VertexPolygon[] = []
  const subGraphs = splitGraphInConnectedSubGraphs(graph)
  const subGraphUnitsAndGroup: SubGraphUnitsAndGroup[] = subGraphs
    .map((subGraph) => {
      const { innerLoops, outerLoops } = getVertexLoopsFromGraph(subGraph)
      const groupPolygon = outerLoops[0]
      const groupId = randomId()
      return { subGraph, polygons: innerLoops, groupPolygon, groupId }
    })
    .filter(({ groupPolygon }) => groupPolygon)

  const { parentGroup } = getSubGraphTree(subGraphUnitsAndGroup)

  subGraphUnitsAndGroup.forEach(({ groupId, groupPolygon }) => {
    const rootGroupId = getRootGroup(parentGroup, groupId)
    if (rootGroupId === groupId) outerLoopsOfGraph.push(groupPolygon)
  })

  return outerLoopsOfGraph
}
