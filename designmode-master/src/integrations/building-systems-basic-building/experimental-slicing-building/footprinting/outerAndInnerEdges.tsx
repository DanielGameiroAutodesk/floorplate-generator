import type { Floor } from "src/integrations/building-systems-basic-building/lib/types"

export type IsEdgeFaceInsideMap = Record<string, { left: boolean; right: boolean }>
export function getOuterAndInnerEdgeMap(floor: Floor): IsEdgeFaceInsideMap {
  const verticesToEdgeMap: Record<string, { edgeId: string; side: "left" | "right" }> = {}
  const edgeFacesInside: Record<string, { left: boolean; right: boolean }> = {}
  for (const edge of Object.values(floor.graph.edges)) {
    const keyOne = edge.start + "-" + edge.end
    const keyTwo = edge.end + "-" + edge.start
    verticesToEdgeMap[keyOne] = { edgeId: edge.id, side: "left" }
    verticesToEdgeMap[keyTwo] = { edgeId: edge.id, side: "right" }

    edgeFacesInside[edge.id] = { left: false, right: false }
  }
  for (const space of Object.values(floor.spaces)) {
    const polygon = space.polygon
    const n = polygon.length
    for (let i = 0; i < polygon.length; i++) {
      const vertexOneId = polygon[i]
      const vertexTwoId = polygon[(i + 1) % n]
      if (vertexOneId === vertexTwoId) continue
      const key = vertexOneId + "-" + vertexTwoId
      const wall = verticesToEdgeMap[key]
      if (wall.side === "left") {
        edgeFacesInside[wall.edgeId].left = true
      }
      if (wall.side === "right") {
        edgeFacesInside[wall.edgeId].right = true
      }
    }
  }
  return edgeFacesInside
}
