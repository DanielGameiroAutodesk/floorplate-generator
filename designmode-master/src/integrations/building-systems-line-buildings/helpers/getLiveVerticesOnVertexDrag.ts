import { getVertexElevation } from "./getVertexElevation"

type VertexZ = { x: number; y: number; z: number; id: string }

export function getLiveVerticesOnVertexDrag({ initVertices, dragVertexData, dragVertex, parameters, lowestZ }: any) {
  if (!dragVertexData || !dragVertex) return initVertices
  const snappedPosition = dragVertexData.snappedPosition
  return initVertices
    .map((vertex: VertexZ) => {
      const z = getVertexElevation(parameters, vertex) + lowestZ

      if (vertex.id !== dragVertex?.id) return { ...vertex, z }

      return { ...vertex, x: snappedPosition.x, y: snappedPosition.y, z }
    })
    .filter((vertex: VertexZ) => {
      return dragVertexData.snappedToVertexId !== vertex.id
    })
}
