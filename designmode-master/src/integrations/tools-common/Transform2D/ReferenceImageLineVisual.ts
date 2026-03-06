import { useEffect, useMemo } from "preact/hooks"
import { ThreeLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreeLine"
import { dashedMaterial, solidMaterial } from "./materials"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import sceneManager from "src/core/three/sceneManager"
import { Vector3 } from "three"
import type { Segment } from "src/lib/geometry/geometryTypes"

export const makeReferenceImageLineVisual = (isMovingReferencePoints: boolean) => {
  return function Prev({ lineSegment }: { lineSegment?: Segment }) {
    const lineVisual = useMemo(() => {
      return new ThreeLine([], isMovingReferencePoints ? solidMaterial : dashedMaterial)
    }, [])
    useObjectLifecycle(lineVisual, true, sceneManager.scene, false)

    useEffect(() => {
      if (!lineSegment) return
      lineVisual.updateLine(lineSegment.map(([x, y, z]) => new Vector3(x, y, z)))
    }, [lineSegment, lineVisual])

    return null
  }
}
