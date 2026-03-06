import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import { Vector3 } from "three"
import moize from "moize"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { BlueLineSegmentWithHandles } from "src/integrations/tools-common/Drawing/shapeTool/visuals/BlueLineSegment"
import { defaultCursor, drawCursor } from "src/integrations/cursors/setCursor"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Edge, Shape } from "src/lib/three/Shape/types"
import type { Segment } from "src/lib/geometry/geometryTypes"

export enum Step {
  DrawEdge = 0,
  DrawRectangle = 1,
}

const up = new Vector3(0, 0, 1)

// memoize separately for stable identity as long as v1 and v2 keep their identity.
const getGuide = moize((v1: Vector3, v2: Vector3) => {
  const v1v2 = v2.clone().sub(v1).setZ(0)
  return v1v2.cross(up).normalize()
})

const segmentsToRectangle = (l1: Segment, l2: Segment) => {
  const [v1, v2] = l1
  const [, v3] = l2

  const v4 = [v1[0] + v3[0] - v2[0], v1[1] + v3[1] - v2[1], v1[2] + v3[2] - v2[2]]

  return [v1, v2, v3, v4]
}

const segmentsToRectangleShape = (l1: Segment, l2: Segment): Shape => {
  const coords = segmentsToRectangle(l1, l2)

  const vertices = coords.map(([x, y]) => new Vector3(x, y, l1[0][2]))
  const edges = vertices.map((_, i) => [i, (i + 1) % vertices.length] as Edge)
  return {
    vertices,
    edges,
    loops: [],
  }
}

export function DrawRectangle({
  onComplete,
  onTerrain = false,
  onPreviewChange,
}: {
  onPreviewChange?: (shape: Shape) => any
  onComplete: (shape?: Shape) => void
  onTerrain?: boolean
}) {
  const [step, setStep] = useState(Step.DrawEdge)
  const [firstEdge, setFirstEdge] = useState<Segment>()

  const onCancel = useCallback(() => {
    return onComplete()
  }, [onComplete])

  useEffect(() => {
    drawCursor()
    return () => defaultCursor()
  }, [])

  const commit = useCallback(
    (secondEdge: Segment) => {
      const points = segmentsToRectangle(firstEdge!, secondEdge)
      const [v1, v2, v3, v4] = points.map((v) => new Vector3(...v))
      const vertices = [v3, v4, v1, v2]
      const shape: Shape = {
        vertices,
        edges: [
          [0, 1],
          [1, 2],
          [2, 3],
          [3, 0],
        ],
        loops: [[0, 1, 2, 3]],
      }
      onComplete(shape)
    },
    [firstEdge, onComplete],
  )

  const guide = useMemo(() => {
    if (!firstEdge) return
    const [v1, v2] = firstEdge.map((v) => new Vector3(...v))
    return { direction: getGuide(v1, v2) }
  }, [firstEdge])

  const Preview = useMemo(() => {
    if (!firstEdge) return
    return function Prev({ lineSegment }: { lineSegment?: Segment }) {
      useEffect(() => {
        if (!lineSegment || !onPreviewChange) return
        const shape = segmentsToRectangleShape(firstEdge, lineSegment)
        onPreviewChange(shape)
      }, [lineSegment])
      return (
        <>
          <BlueLineSegmentWithHandles lineSegment={lineSegment} onTerrain={onTerrain} />
          <BlueLineSegmentWithHandles lineSegment={firstEdge} onTerrain={onTerrain} />
        </>
      )
    }
  }, [firstEdge, onTerrain, onPreviewChange])

  const FirstEdgePreview = useMemo(() => {
    return function Prev({ lineSegment }: { lineSegment?: Segment }) {
      return <BlueLineSegmentWithHandles lineSegment={lineSegment} onTerrain={onTerrain} />
    }
  }, [onTerrain])

  const secondEdgeInitialDefinition = useMemo<Segment | undefined>(() => {
    if (firstEdge) return [firstEdge[1], firstEdge[1]]
  }, [firstEdge])

  return step === Step.DrawEdge ? (
    <LineSegmentTool
      key="drawEdge"
      onComplete={(l) => {
        setFirstEdge(l)
        setStep(Step.DrawRectangle)
      }}
      onCancel={onCancel}
      previewRenderers={FirstEdgePreview}
      moveMode={onTerrain ? ShapeToolMoveMode.TERRAIN : ShapeToolMoveMode.HORIZONTAL}
      enterToComplete={false}
    />
  ) : (
    <LineSegmentTool
      key="drawRectangle"
      onComplete={commit}
      onCancel={onCancel}
      previewRenderers={Preview!}
      guide={guide}
      initialDefinition={secondEdgeInitialDefinition}
      moveMode={onTerrain ? ShapeToolMoveMode.TERRAIN : ShapeToolMoveMode.HORIZONTAL}
      enterToComplete={false}
    />
  )
}
