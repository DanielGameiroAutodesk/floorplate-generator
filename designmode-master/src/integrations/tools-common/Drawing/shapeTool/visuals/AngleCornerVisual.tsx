import type { Vector3 } from "three"
import { CatmullRomCurve3, MathUtils } from "three"
import { useEffect, useMemo } from "preact/compat"
import { ACTIVE_SNAPPING_LINE_MATERIAL, BOLD_SNAPPING_LINE_MATERIAL } from "./snappingLineMaterials"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { round } from "src/lib/math/round"
import { pixelsToMetersAtPosition } from "src/integrations/tools-common/AffineTooling/utils"
import { ThreePolygonLine } from "src/integrations/tools-common/Drawing/shapeTool/common/visuals/ThreePolygonLine"
import { SNAPPING_DISTANCE } from "src/integrations/snapping/constants"
import { getAngleInRadians } from "src/lib/three/geometryUtils"
import { to360Degrees } from "src/lib/geometry/geometryUtils"
import {
  getPointAlongAngle,
  getPointAlongLine,
} from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/trigonometryUtils"

const curve = new CatmullRomCurve3([])

export function getCurvedAnglePolygonPositions({
  startPoint,
  pivotPoint,
  currentPoint,
  currentAngle,
  length,
}: {
  startPoint: Vector3
  pivotPoint: Vector3
  currentPoint: Vector3
  currentAngle: number
  length: number
}): Vector3[] {
  let vec3Positions: Vector3[] = []
  const startPos = getPointAlongLine(pivotPoint, startPoint, length)
  const endPos = getPointAlongLine(pivotPoint, currentPoint, length)

  const interval = 0.1
  let curInterval = interval
  while (curInterval < 1) {
    vec3Positions.push(getPointAlongAngle(pivotPoint, startPoint, currentAngle * curInterval, length))
    curInterval += interval
  }

  vec3Positions.unshift(startPos)
  vec3Positions.push(endPos)

  curve.points = vec3Positions

  const curvedPoints = curve.getPoints(25)
  curvedPoints.push(pivotPoint)

  return curvedPoints
}

export function getSquareAnglePolygonPositions({
  startPoint,
  pivotPoint,
  currentPoint,
  currentAngle,
  length,
}: {
  startPoint: Vector3
  pivotPoint: Vector3
  currentPoint: Vector3
  currentAngle: number
  length: number
}): Vector3[] {
  if (currentAngle === 90) {
    const startPos = getPointAlongLine(pivotPoint, startPoint, length)
    const endPos = getPointAlongLine(pivotPoint, currentPoint, length)
    const squarePoint = getPointAlongAngle(endPos, pivotPoint, 90, length)
    return [startPos, squarePoint, endPos, pivotPoint]
  }

  if (currentAngle === 270) {
    const startPos = getPointAlongLine(pivotPoint, currentPoint, length)
    const endPos = getPointAlongLine(pivotPoint, startPoint, length)
    const squarePoint = getPointAlongAngle(endPos, pivotPoint, 90, length)
    return [startPos, squarePoint, endPos, pivotPoint]
  }

  return []
}

export const AngleCornerVisual = ({
  currentPoint,
  startPoint,
  pivotPoint,
}: {
  currentPoint?: Vector3
  startPoint?: Vector3
  pivotPoint?: Vector3
}) => {
  const { camera } = sceneManager

  const currentAngle = useMemo(() => {
    if (currentPoint && startPoint && pivotPoint) {
      const angleInRadians = getAngleInRadians(pivotPoint, currentPoint, startPoint)
      return round(to360Degrees(MathUtils.radToDeg(angleInRadians)), 2)
    }
    return 0
  }, [currentPoint, pivotPoint, startPoint])

  const cornerLine = useMemo(() => {
    return new ThreePolygonLine([], true, ACTIVE_SNAPPING_LINE_MATERIAL, 3)
  }, [])

  useObjectLifecycle(cornerLine)

  useEffect(() => {
    if (currentPoint && startPoint && pivotPoint && currentPoint.distanceTo(pivotPoint) > SNAPPING_DISTANCE) {
      const length = pixelsToMetersAtPosition(20, camera, pivotPoint)
      let polygonPoints: Vector3[] = []

      if (currentAngle === 90 || currentAngle === 270) {
        cornerLine.setMaterial(BOLD_SNAPPING_LINE_MATERIAL)
        polygonPoints = getSquareAnglePolygonPositions({
          startPoint,
          pivotPoint,
          currentPoint,
          currentAngle,
          length,
        })
      } else if (currentAngle !== 0) {
        cornerLine.setMaterial(ACTIVE_SNAPPING_LINE_MATERIAL)
        polygonPoints = getCurvedAnglePolygonPositions({
          startPoint,
          pivotPoint,
          currentPoint,
          currentAngle,
          length,
        })
      }
      cornerLine.updatePolygon(polygonPoints)
    } else {
      cornerLine.updatePolygon([])
    }
  }, [camera, cornerLine, currentAngle, currentPoint, pivotPoint, startPoint])
  return null
}
