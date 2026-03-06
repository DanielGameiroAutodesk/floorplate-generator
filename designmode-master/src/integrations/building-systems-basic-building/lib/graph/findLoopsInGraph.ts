import {
  areaOfPolygon,
  isPolygonClockwise,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { Graph, Vertex } from "./graph"
import { getVertexEdgeMap } from "./graph"

type DirectedVertexMap = Record<string, Record<string, string>>
function getDirectedVertexMap(graph: Graph) {
  const { vertices, edges } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const directedVertexMap: DirectedVertexMap = {}
  Object.entries(vertexEdgeMap).forEach(([vertexID, neighbourEdgeIDs]) => {
    const vertex = vertices[vertexID]
    directedVertexMap[vertexID] = {}
    const angleList = neighbourEdgeIDs
      .map((neighbourEdgeID) => {
        const edge = edges[neighbourEdgeID]
        const otherVertexID = edge.start === vertexID ? edge.end : edge.start
        const otherVertex = vertices[otherVertexID]
        const dx = otherVertex.x - vertex.x
        const dy = otherVertex.y - vertex.y
        const angle = Math.atan2(dy, dx)
        return {
          angle,
          edgeID: neighbourEdgeID,
          otherVertexID,
        }
      })
      .sort((a, b) => a.angle - b.angle)
    const n = angleList.length
    for (let i = 0; i < n; i++) {
      const vertexOneID = angleList[i].otherVertexID
      const vertexTwoID = angleList[(i + 1) % n].otherVertexID
      directedVertexMap[vertexID][vertexTwoID] = vertexOneID
    }
  })

  return directedVertexMap
}

function traceLoopInGraph(vertexOneID: string, vertexTwoID: string, directedVertexMap: DirectedVertexMap) {
  const loop = [vertexOneID, vertexTwoID]
  let currentID = vertexTwoID
  let prevID = vertexOneID
  for (let i = 0; i < 100; i++) {
    const nextID = directedVertexMap[currentID][prevID]
    if (nextID === vertexTwoID && currentID === vertexOneID) break
    loop.push(nextID)
    prevID = currentID
    currentID = nextID
  }
  return loop
}

type VertexLoop = Vertex[]
export function getVertexLoopsFromGraph(graph: Graph) {
  const directedVertexMap = getDirectedVertexMap(graph)
  const vertexLoops: VertexLoop[] = []
  const usedEdges: Record<string, boolean> = {}
  Object.keys(graph.vertices).forEach((vertexOneID) => {
    const neighbours = Object.values(directedVertexMap[vertexOneID])
    neighbours.forEach((vertexTwoID) => {
      const edgeName = vertexOneID + "-" + vertexTwoID
      if (!usedEdges[edgeName]) {
        const loop = traceLoopInGraph(vertexOneID, vertexTwoID, directedVertexMap)
        const polygon: VertexLoop = loop.map((vertexID) => {
          const vertex = graph.vertices[vertexID]
          return { x: vertex.x, y: vertex.y, id: vertex.id }
        })
        vertexLoops.push(polygon)
        const n = loop.length
        for (let i = 0; i < n; i++) {
          const edgeName = loop[i] + "-" + loop[(i + 1) % n]
          usedEdges[edgeName] = true
        }
      }
    })
  })
  const innerLoops: VertexLoop[] = vertexLoops.filter((polygon) => {
    return !isPolygonClockwise(polygon) && areaOfPolygon(polygon) > 0
  })

  const outerLoops: VertexLoop[] = vertexLoops
    .filter((polygon) => {
      return isPolygonClockwise(polygon) || areaOfPolygon(polygon) === 0
    })
    .map((polygon) => polygon.reverse())

  return { innerLoops, outerLoops }
}
