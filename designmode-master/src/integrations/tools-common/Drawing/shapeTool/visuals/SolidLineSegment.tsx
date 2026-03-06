import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { useMemo } from "preact/compat"
import { Color, Vector3 } from "three"
import { ThreeLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreeLine"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { colors } from "src/lib/colors"

const visualisationColors = [colors.gray20, colors.gray40] as const

const materials = Object.fromEntries(
  visualisationColors.map((color) => [
    color,
    new LineMaterial({ color: new Color(color).getHex(), resolution: screenResolutionVector }),
  ]),
)

export const SolidLineSegment: LineSegmentRenderer<{ color?: (typeof visualisationColors)[number] }> = ({
  lineSegment,
  color = visualisationColors[0],
}) => {
  const line = useMemo(() => {
    if (!lineSegment) return
    const radialLine = lineSegment.map((c) => new Vector3().fromArray(c)) as [Vector3, Vector3]
    return new ThreeLine(radialLine, materials[color])
  }, [color, lineSegment])

  useObjectLifecycle(line)

  return null
}
