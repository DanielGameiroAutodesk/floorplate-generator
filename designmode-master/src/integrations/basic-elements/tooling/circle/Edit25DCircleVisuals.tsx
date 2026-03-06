import type { Segment } from "src/lib/geometry/geometryTypes"
import type { FormaElement } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { useMemo } from "react"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import { useHideRenderable } from "src/integrations/basic-elements/tooling/useHideRenderable"
import { useVolumeShapePreview } from "src/integrations/volumeShapePreview/useVolumeShapePreview"
import { ShapeVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/ShapeVisual"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import { DistanceOfLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DistanceOfLineSegment"

type Props = {
  element: FormaElement
  path: InternalPath
  height?: number
  segment?: Segment
}

export default function Edit25DCircleVisuals({ segment, element, path, height }: Props) {
  const circleShape = useMemo(() => {
    if (!segment) return
    const [center, radial] = segment
    return circleFrom2Points(center, radial)
  }, [segment])

  useHideRenderable(path, true)
  useVolumeShapePreview("edit25dCircle", { ...element.properties, height }, circleShape)

  return (
    <>
      {circleShape && <ShapeVisual shape={circleShape} useImperialUnits={false} onTerrain={false} />}
      <DashedLineSegment lineSegment={segment} />
      <DistanceOfLineSegment lineSegment={segment} />
    </>
  )
}
