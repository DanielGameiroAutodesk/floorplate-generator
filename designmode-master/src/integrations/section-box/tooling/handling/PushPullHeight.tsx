import { useCallback, useEffect, useMemo } from "preact/hooks"
import { Matrix4 } from "three"
import { Vector3 } from "three"
import PushPullPreview from "./PushPullPreview"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Segment } from "src/lib/geometry/geometryTypes"
import { getTopHandlePosition } from "./Handles"
import type { SectionBox } from "src/integrations/section-box/tooling/sectionBox"
import { setEnableSnappingSignalValue } from "src/integrations/snapping/snappingPicker.state"

const up = new Vector3(0, 0, 1)

const getZDiff = ([v1, v2]: Segment) => {
  return v2[2] - v1[2]
}

export default function PushPullHeight({
  sectionBox,
  onComplete,
  onCancel,
  previewSectionBox,
}: {
  sectionBox: SectionBox
  onComplete: (sectionBox: SectionBox) => void
  onCancel: () => void
  previewSectionBox: (sectionBox: SectionBox) => void
}) {
  useEffect(() => {
    setEnableSnappingSignalValue(false)
    return () => {
      setEnableSnappingSignalValue(true)
    }
  }, [])
  const originalHeight = sectionBox.properties?.height

  const heightInitialShape = useMemo(() => {
    const labelPosition = getTopHandlePosition(sectionBox, new Matrix4())
    return [labelPosition.toArray(), labelPosition.toArray()] as [[number, number, number], [number, number, number]]
  }, [sectionBox])

  const commitHeight = useCallback(
    (l: Segment) => {
      const diff = getZDiff(l)
      const newHeight = originalHeight + diff
      if (newHeight <= 0) return
      const newSectionBox = {
        ...sectionBox,
        properties: {
          ...sectionBox.properties,
          height: newHeight,
        },
      }
      onComplete(newSectionBox)
    },
    [sectionBox, onComplete, originalHeight],
  )

  const pushPullPreviewRenderer = useMemo(() => {
    return function Preview({ lineSegment }: { lineSegment?: Segment }) {
      if (!lineSegment) return null
      const diff = getZDiff(lineSegment)
      return (
        <>
          <PushPullPreview
            sectionBox={sectionBox}
            surface={"roof"}
            height={diff + originalHeight}
            previewSectionBox={previewSectionBox}
          />
          <DashedLineSegment lineSegment={lineSegment} />
        </>
      )
    }
  }, [previewSectionBox, sectionBox, originalHeight])

  const guide = useMemo(() => {
    return {
      direction: up,
    }
  }, [])

  return (
    <LineSegmentTool
      onCancel={onCancel}
      onComplete={commitHeight}
      previewRenderers={pushPullPreviewRenderer}
      initialDefinition={heightInitialShape}
      guide={guide}
      ignoreTerrainSnappingLines={true}
      moveMode={ShapeToolMoveMode.VERTICAL}
    />
  )
}
