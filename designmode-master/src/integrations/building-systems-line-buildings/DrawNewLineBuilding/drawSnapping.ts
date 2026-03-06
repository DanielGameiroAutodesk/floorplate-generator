import { Vector3 } from "three"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"
import { getUnitNormalVectorXY } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"

const AngleSnappingDist = 10

export function snapPointToDirection({
  position,
  directionalSnapLines,
}: {
  position: Vector3
  directionalSnapLines: [Vector3, Vector3][]
}) {
  const WeightedSappingDist = pixelsToMetersAtPositionStatic(AngleSnappingDist, position)

  let minDist = Infinity
  let closestLine
  let snappedPosition = position

  for (let line of directionalSnapLines) {
    const [pStart, pEnd] = line
    const normal = getUnitNormalVectorXY(pStart, pEnd)

    const normalDist = (position.x - pStart.x) * normal.x + (position.y - pStart.y) * normal.y
    if (Math.abs(normalDist) < Math.min(WeightedSappingDist, minDist)) {
      minDist = Math.abs(normalDist)
      closestLine = line
      snappedPosition = new Vector3(position.x - normalDist * normal.x, position.y - normalDist * normal.y, position.z)
    }
  }

  if (closestLine) {
    return { snappedPosition, snapped: true }
  }

  return { snappedPosition, snapped: false }
}
