import { useCallback, useMemo } from "preact/hooks"
import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { getRoofHandlePosition } from "./ExtrudedPolygonHandles"
import PushPullPreview from "./PushPullPreview"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import type { Properties } from "@spacemakerai/element-types"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { ExtrudedPolygonFeature, Segment } from "src/lib/geometry/geometryTypes"

const up = new Vector3(0, 0, 1)

const getZDiff = ([v1, v2]: Segment) => {
  return v2[2] - v1[2]
}

export default function PushPullHeight({
  feature,
  worldTransform,
  onComplete,
  onCancel,
  stepSize,
  elementProperties,
  previewFunction,
}: {
  feature: ExtrudedPolygonFeature
  worldTransform: Matrix4
  onComplete: (feature: ExtrudedPolygonFeature) => void
  onCancel: () => void
  stepSize?: number
  elementProperties?: Properties
  previewFunction?: (zDiff: number) => void
}) {
  const originalHeight = feature.properties?.height

  const heightInitialShape = useMemo(() => {
    const labelPosition = getRoofHandlePosition(feature, worldTransform)
    return [labelPosition.toArray(), labelPosition.toArray()] as [[number, number, number], [number, number, number]]
  }, [feature, worldTransform])

  const commitHeight = useCallback(
    (l: Segment) => {
      const diff = getZDiff(l)
      const newHeight = originalHeight + diff
      if (newHeight <= 0) return
      const newGeoJson = {
        ...feature,
        properties: {
          ...feature.properties,
          height: newHeight,
        },
      }
      onComplete(newGeoJson)
    },
    [feature, onComplete, originalHeight],
  )

  const pushPullPreviewRenderer = useMemo(() => {
    return function Preview({ lineSegment }: { lineSegment?: Segment }) {
      if (!lineSegment) return null
      const diff = getZDiff(lineSegment)
      if (previewFunction) {
        previewFunction(diff)
        return null
      }
      return (
        <>
          <PushPullPreview
            feature={feature}
            transform={worldTransform}
            surface={"roof"}
            height={diff + originalHeight}
            elementProperties={elementProperties}
          />
          <DashedLineSegment lineSegment={lineSegment} />
        </>
      )
    }
  }, [previewFunction, feature, worldTransform, originalHeight, elementProperties])

  const guide = useMemo(() => {
    return {
      direction: up,
      stepSize,
    }
  }, [stepSize])

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
