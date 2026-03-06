import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { useMemo } from "preact/compat"
import { ShapeVisual } from "./ShapeVisual"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import type { Shape } from "src/lib/three/Shape/types"
import { raycast } from "src/core/terrain/2d-raytracer"
import { useIsImperial } from "src/lib/unitSettings"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const CircleDefinedByRadialLineSegment: LineSegmentRenderer<{ onTerrain?: boolean; height?: number }> = ({
  lineSegment,
  onTerrain = true,
}) => {
  const terrainSamplerData = terrainSignal.value.terrainSamplerData
  const useImperialUnits = useIsImperial()

  const preview: Shape | undefined = useMemo(() => {
    if (!lineSegment || !terrainSamplerData) return
    let circle = circleFrom2Points(lineSegment[0], lineSegment[1])
    if (onTerrain) circle.vertices.forEach((v) => v.setZ(raycast(v.x, v.y, terrainSamplerData)))
    return circle
  }, [lineSegment, onTerrain, terrainSamplerData])

  return <>{preview && <ShapeVisual shape={preview} useImperialUnits={useImperialUnits} onTerrain={onTerrain} />}</>
}
