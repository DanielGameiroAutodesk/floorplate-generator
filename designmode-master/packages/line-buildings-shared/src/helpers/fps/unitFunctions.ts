import { v4 as uuidv4 } from "uuid"
import { splitGraphInConnectedSubGraphs } from "./graphUtils.js"
import { getPolygonsFromGraph } from "./loopsInGraph.js"
import { areaOfPolygon, isPointInsidePolygon, makePolygonClockwise, makePolygonCounterClockwise } from "./geoUtils.js"
import type { Graph, GraphEdge, GraphVertex } from "../../shapeHelpers.js"
import type { Vec2 } from "../../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"

export type SubGraphUnitsAndGroup = {
  subGraph: {
    edges: Record<string, GraphEdge>
    vertices: Record<string, GraphVertex>
  }
  unitPolygons: Vec2[][]
  groupPolygon: Vec2[]
  groupID: string
}

function getSubGraphTree(subGraphUnitsAndGroup: SubGraphUnitsAndGroup[]) {
  const n = subGraphUnitsAndGroup.length
  const childGroups: Record<string, string[]> = {}
  const parentGroup: Record<string, string> = {}
  for (let i = 0; i < n; i++) {
    const groupID = subGraphUnitsAndGroup[i].groupID
    childGroups[groupID] = []
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
      const parentID = subGraphUnitsAndGroup[parentIndex].groupID
      const childID = subGraphUnitsAndGroup[i].groupID
      childGroups[parentID].push(childID)
      parentGroup[childID] = parentID
    }
  }
  return { childGroups, parentGroup }
}

function getRootGroup(parentGroup: Record<string, string>, groupID: string) {
  let rootGroupID = groupID
  while (parentGroup[rootGroupID]) {
    rootGroupID = parentGroup[rootGroupID]
  }
  return rootGroupID
}

// Temp function
export function getGroupPolygonWithHolesFromGraph(graph: Graph) {
  const polygonWithHoles = { holes: [], polygon: [] } as { holes: Vec2[][]; polygon: Vec2[] }

  const subGraphs = splitGraphInConnectedSubGraphs(graph)
  const subGraphUnitsAndGroup = subGraphs
    .map<SubGraphUnitsAndGroup>((subGraph) => {
      const { unitPolygons, unitGroupPolygons } = getPolygonsFromGraph(subGraph)
      const groupPolygon = unitGroupPolygons[0]
      const groupID = uuidv4()
      return { subGraph, unitPolygons, groupPolygon, groupID }
    })
    .filter(({ groupPolygon }) => groupPolygon)

  const { parentGroup } = getSubGraphTree(subGraphUnitsAndGroup)

  subGraphUnitsAndGroup.forEach(({ groupPolygon, groupID }) => {
    const rootGroupID = getRootGroup(parentGroup, groupID)
    if (rootGroupID === groupID) {
      polygonWithHoles.polygon = makePolygonCounterClockwise(groupPolygon)
    } else {
      polygonWithHoles.holes.push(makePolygonClockwise(groupPolygon))
    }
  })

  return polygonWithHoles
}
