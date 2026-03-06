import { useMemo } from "preact/hooks"
import FloatingToolInputs, {
  type ControlContextValue,
} from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { Vector3, Vector2 } from "three"

export function lockPositionToDistance(
  position: Vector3 | null,
  previousPositions: Vector3[],
  distance: number | null,
  terrainElevationAt: (x: number, y: number) => number,
) {
  const previousPosition = previousPositions[previousPositions.length - 1]
  if (!previousPosition || !position || distance === null) return position

  const vec = new Vector2().copy(position).sub(new Vector2().copy(previousPosition))
  vec.setLength(distance)
  const newPos2d = new Vector2().copy(previousPosition).add(vec)
  const elevation = terrainElevationAt(newPos2d.x, newPos2d.y)
  return new Vector3(newPos2d.x, newPos2d.y, elevation)
}

export function lockPositionToAngle(
  position: Vector3 | null,
  previousPositions: Vector3[],
  angle: number | null,
  terrainElevationAt: (x: number, y: number) => number,
) {
  const previousPositions2d = previousPositions.slice(-2).map((p) => new Vector2(p.x, p.y))
  if (previousPositions2d.length < 2 || !position || angle === null) return position

  const vec1 = previousPositions2d[0].clone().sub(previousPositions2d[1]).normalize()
  const length = new Vector2().copy(position).distanceTo(previousPositions2d[1])
  const vec2 = vec1.clone().rotateAround(new Vector2(), angle).multiplyScalar(length)
  const newPos2d = previousPositions2d[1].clone().add(vec2)
  const elevation = terrainElevationAt(newPos2d.x, newPos2d.y)
  return new Vector3(newPos2d.x, newPos2d.y, elevation)
}

export function CurveFloatingInputs({
  points,
  currentPoint,
  specifiedDistance,
  specifiedAngle,
  setSpecifiedDistance,
  setSpecifiedAngle,
  exitCallback,
}: {
  points: Vector3[]
  currentPoint: Vector3 | null
  specifiedDistance: number | null
  specifiedAngle: number | null
  setSpecifiedDistance: (value: number | null) => void
  setSpecifiedAngle: (value: number | null) => void
  exitCallback: () => void
}) {
  const floatingDialogFields = useMemo(() => {
    const fields: ControlContextValue[] = []
    if (points.length > 0 && currentPoint) {
      const p1 = new Vector2().copy(currentPoint)
      const p2 = new Vector2().copy(points[points.length - 1])
      const distance = specifiedDistance ?? p1.distanceTo(p2)
      fields.push({
        type: "horizontal",
        value: distance,
        change: (value) => setSpecifiedDistance(value ?? null),
        submit: (value) => setSpecifiedDistance(value ?? null),
      })
      if (points.length > 1) {
        const p3 = new Vector2().copy(points[points.length - 2])
        let angle: number
        if (specifiedAngle) {
          angle = specifiedAngle * (180 / Math.PI)
        } else {
          const vec1 = p1.clone().sub(p2).normalize()
          const vec2 = p3.clone().sub(p2).normalize()
          angle = Math.atan2(vec2.cross(vec1), vec2.dot(vec1)) * (180 / Math.PI)
        }
        fields.push({
          type: "angle",
          value: angle,
          change: (value) => setSpecifiedAngle(value ? value * (Math.PI / 180) : null),
          submit: (value) => setSpecifiedAngle(value ? value * (Math.PI / 180) : null),
        })
      }
    }
    return fields
  }, [points, specifiedDistance, specifiedAngle, setSpecifiedDistance, setSpecifiedAngle, currentPoint])

  if (floatingDialogFields.length === 0) return null
  return <FloatingToolInputs cancel={exitCallback} fields={floatingDialogFields} />
}
