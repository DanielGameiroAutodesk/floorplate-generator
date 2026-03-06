import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { useMemo } from "preact/compat"
import { AlwaysDepth, Color, Vector3 } from "three"
import { ThreeLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreeLine"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { DashedLineMaterial } from "src/lib/three/materials/DashedLineMaterial"

import { colors } from "src/lib/colors"

const visualisationColors = [colors.gray20, colors.gray40] as const
type VisualisationColor = (typeof visualisationColors)[number]

const makeDashedLineMaterial = (color: VisualisationColor) =>
  new DashedLineMaterial({
    color: new Color(color).getHex(),
    resolution: screenResolutionVector,
    depthFunc: AlwaysDepth,
  })

const materials = Object.fromEntries(visualisationColors.map((color) => [color, makeDashedLineMaterial(color)]))

export const DashedLineSegment: LineSegmentRenderer<{ color?: VisualisationColor }> = ({
  lineSegment,
  color = colors.gray20,
}) => {
  const line = useMemo(() => {
    if (!lineSegment) return
    const radialLine = lineSegment.map((c) => new Vector3().fromArray(c)) as [Vector3, Vector3]
    return new ThreeLine(radialLine, materials[color])
  }, [color, lineSegment])

  useObjectLifecycle(line)

  return null
}
