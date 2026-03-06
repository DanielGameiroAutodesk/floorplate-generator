import type { Graph } from "src/integrations/composition-site-graph/graph/types"
import { useCallback, useState } from "preact/hooks"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import graph from "src/integrations/composition-site-graph/graph/graph"
import sceneManager from "src/core/three/sceneManager"
import { useGetPosition } from "./mousePosition"
import type { GraphMesh } from "./GraphMesh"
import { useMemo } from "preact/compat"
import { Matrix4 } from "three"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"

export function DrawEdges({
  state,
  onPreview,
  onCommit,
  onPreviewGraphVisuals,
}: {
  state: Graph
  onCommit: (graph: Graph) => void
  onPreview: (graph: Graph) => void
  onPreviewGraphVisuals?: GraphMesh["update"]
}) {
  const [prevVertexId, setPrevVertexId] = useState<string | undefined>()

  const transform = useMemo(() => new Matrix4(), [])

  const getPosition = useGetPosition(state, transform, prevVertexId)

  const mousemove = useCallback(() => {
    const snappedPosition = getPosition()
    if (!snappedPosition) return Propagate.YES

    const [g1, nextVertexId] = graph.addVertex(state, snappedPosition.x, snappedPosition.y)
    if (prevVertexId) {
      if (prevVertexId !== nextVertexId) {
        const [g2] = graph.addEdge(g1, prevVertexId, nextVertexId)
        onPreview(g2)
        onPreviewGraphVisuals && onPreviewGraphVisuals(g2)
      } else {
        onPreview(g1)
        onPreviewGraphVisuals && onPreviewGraphVisuals(g1)
      }
    } else {
      onPreview(g1)
      onPreviewGraphVisuals && onPreviewGraphVisuals(g1)
    }

    return Propagate.NO
  }, [getPosition, onPreview, onPreviewGraphVisuals, prevVertexId, state])

  const mouseup = useCallback(() => {
    const snappedPosition = getPosition()
    if (!snappedPosition) return Propagate.YES

    const [g1, nextVertexId] = graph.addVertex(state, snappedPosition.x, snappedPosition.y)

    setPrevVertexId(nextVertexId)

    if (prevVertexId) {
      if (prevVertexId !== nextVertexId) {
        const [g2] = graph.addEdge(g1, prevVertexId, nextVertexId)
        onCommit(g2)
      } else {
        //User clicked on the same vertex twice. Graph is unchanged, so we commit the previous graph. This can let the consumer of this component do stuff like finish the tool when that happens
        onCommit(state)
      }
    } else {
      onCommit(g1)
    }

    return Propagate.NO
  }, [getPosition, onCommit, prevVertexId, state])

  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.renderer.domElement)

  return (
    <>
      {snappingAPIStateful.visualsComponent()}
      {snappingAPIStateful.snappingPicker()}
    </>
  )
}
