import type { Graph } from "src/integrations/composition-site-graph/graph/types"
import ThreeText from "src/integrations/composition-site-graph/graph/debug/3dText"
import { _getCoEdgeVertices } from "src/integrations/composition-site-graph/graph/coEdge"
import math from "src/integrations/composition-site-graph/graph/utils/math"
import { graphGlobalParameters } from "src/integrations/composition-site-graph/state"
import { useRecoilValue } from "recoil"
import { objectKeys } from "src/lib/record"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export function DebugUI({ graph }: { graph: Graph }) {
  const terrain = terrainSignal.value
  const params = useRecoilValue(graphGlobalParameters)
  const vertices = Object.entries(graph._vertices).map(([id, v]) => {
    return (
      <ThreeText
        key={id}
        point={{ x: v.x, y: v.y, z: terrain.elevationAt(v.x, v.y) }}
        text={`V: ${id}`}
        color={"khaki"}
      />
    )
  })
  const edges = Object.entries(graph._edges).map(([id, e]) => {
    const startVertex = graph._vertices[e.start]
    const endVertex = graph._vertices[e.end]

    const midPoint = {
      x: (startVertex.x + endVertex.x) / 2,
      y: (startVertex.y + endVertex.y) / 2,
    }
    return (
      <ThreeText
        key={id}
        point={{ x: midPoint.x, y: midPoint.y, z: terrain.elevationAt(midPoint.x, midPoint.y) }}
        text={`E: ${id}`}
        color={"darkseagreen"}
      />
    )
  })

  const coEdges = objectKeys(graph._coEdges).map((id) => {
    const { start, end } = _getCoEdgeVertices(graph, id)
    const startVertex = graph._vertices[start]
    const endVertex = graph._vertices[end]
    const midPoint = {
      x: (startVertex.x + endVertex.x) / 2,
      y: (startVertex.y + endVertex.y) / 2,
    }
    const vector = {
      x: endVertex.x - startVertex.x,
      y: endVertex.y - startVertex.y,
    }
    const normal = math.normalizeVector({
      x: vector.y,
      y: -vector.x,
    })
    const offset = 15
    const offsetPoint = {
      x: midPoint.x + normal.y * offset,
      y: midPoint.y + normal.y * offset,
    }
    return (
      <ThreeText
        key={id}
        point={{ x: offsetPoint.x, y: offsetPoint.y, z: terrain.elevationAt(offsetPoint.x, offsetPoint.y) }}
        text={`CoE: ${id}`}
        color={"darksalmon"}
      />
    )
  })

  return (
    <>
      {params.debug.vertices && vertices}
      {params.debug.edges && edges}
      {params.debug.coEdges && coEdges}
    </>
  )
}
