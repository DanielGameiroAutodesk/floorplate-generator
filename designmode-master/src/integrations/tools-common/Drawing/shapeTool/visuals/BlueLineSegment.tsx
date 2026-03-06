import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { useEffect, useMemo } from "preact/compat"
import { AlwaysDepth, Color, Group, Vector3 } from "three"
import { ThreeLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreeLine"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { dispose, useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import { subdivideLine } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import { projectPositionToTerrain } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import { colors } from "src/lib/colors"

const blueLineMaterial = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

export const BlueLineSegment: LineSegmentRenderer<{ onTerrain?: boolean }> = ({ onTerrain, lineSegment }) => {
  useEffect(() => {
    if (!lineSegment) return
    let vertices = lineSegment.map((c) => new Vector3().fromArray(c))
    if (onTerrain) {
      vertices = subdivideLine(vertices, pixelsToMetersAtPosition(10, sceneManager.camera, vertices[0])).map((p) =>
        projectPositionToTerrain(p, p),
      )
    }
    const line = new ThreeLine(vertices, blueLineMaterial)

    sceneManager.scene.add(line)

    return () => {
      dispose(line)
      sceneManager.scene.remove(line)
    }
  }, [lineSegment, onTerrain])
  return null
}

export const BlueLineSegmentWithHandles: LineSegmentRenderer<{ onTerrain?: boolean }> = ({
  onTerrain,
  lineSegment,
}) => {
  useObjectLifecycle(
    useMemo(() => {
      if (!lineSegment) return

      let start = new Vector3(...lineSegment[0])
      onTerrain && projectPositionToTerrain(start, start)
      const h1 = new VertexHandle(start)
      let end = new Vector3(...lineSegment[1])
      onTerrain && projectPositionToTerrain(end, end)
      const h2 = new VertexHandle(end)
      return new Group().add(h1, h2)
    }, [lineSegment, onTerrain]),
  )

  return <BlueLineSegment lineSegment={lineSegment} onTerrain={!!onTerrain} />
}
