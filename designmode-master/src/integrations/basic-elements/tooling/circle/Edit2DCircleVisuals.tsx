import type { Segment } from "src/lib/geometry/geometryTypes"
import type { FormaElement } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { useMemo } from "react"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import { useHideRenderable } from "src/integrations/basic-elements/tooling/useHideRenderable"
import use2DPolygonVisual from "src/integrations/tools-common/Drawing/shapeTool/visuals/use2DPolygonVisual"
import { ShapeVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/ShapeVisual"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import { DistanceOfLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DistanceOfLineSegment"

type Props = {
  element: FormaElement
  path: InternalPath
  elevationAt: (x: number, y: number) => number
  segment?: Segment
}

export default function Edit2DCircleVisuals({ segment, element, path, elevationAt }: Props) {
  const circleShape = useMemo(() => {
    if (!segment) return
    const [center, radial] = segment
    const circle = circleFrom2Points(center, radial)
    circle.vertices.forEach((v) => v.setZ(elevationAt(v.x, v.y)))
    return circle
  }, [elevationAt, segment])

  useHideRenderable(path, true)
  use2DPolygonVisual(circleShape, element.properties)

  return (
    <>
      {circleShape && <ShapeVisual shape={circleShape} useImperialUnits={false} onTerrain={true} />}
      <DashedLineSegment lineSegment={segment} />
      <DistanceOfLineSegment lineSegment={segment} />
    </>
  )
}
