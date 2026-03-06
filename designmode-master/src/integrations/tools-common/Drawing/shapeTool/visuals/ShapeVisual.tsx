import { Edges } from "./Edges"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import type { Shape } from "src/lib/three/Shape/types"

type Props = {
  shape: Shape
  hoveredEdge?: number
  hoveredVertex?: number
  hideVertices?: boolean
  hideEdges?: boolean
  valid?: boolean
  onTerrain?: boolean
  closed?: boolean
  useImperialUnits: boolean
}
export const ShapeVisual = ({
  shape,
  hoveredEdge = -1,
  hoveredVertex = -1,
  hideVertices = false,
  hideEdges = false,
  valid = true,
  onTerrain = false,
  closed = false,
  useImperialUnits,
}: Props) => {
  return (
    <>
      {!hideEdges && (
        <Edges
          shape={shape}
          hoveredEdgeIndex={hoveredEdge}
          hoveredVertices={hoveredVertex ? [hoveredVertex] : []}
          valid={valid}
          onTerrain={onTerrain}
          closed={closed}
          useImperialUnits={useImperialUnits}
        />
      )}
      {!hideVertices &&
        shape.vertices.map((v, i) => <Handle key={`vertex-${i}`} position={v} hovered={hoveredVertex === i} />)}
    </>
  )
}
