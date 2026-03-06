import { Vector3 } from "three"
import type { ConnectToOtherBuildingPoint } from "./drawLineBuildingSnapping"
import { pixelsToMetersAtPositionStatic } from "src/integrations/camera/CameraAPI"

function pointPointDistanceXY(pointOne: { x: number; y: number }, pointTwo: { x: number; y: number }) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

type PointXY = { x: number; y: number }
function getAngle(p0: PointXY, p1: PointXY, p2: PointXY) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

function getCornerBuffer(width: number, angle: number) {
  const absAngle = Math.abs(angle)
  if (absAngle >= Math.PI / 2) {
    const dist1 = width / Math.cos(absAngle - Math.PI / 2)
    const dist2 = width / Math.tan(Math.PI - absAngle)
    return dist1 + dist2
  }
  const shift = (width * (1 - Math.cos(absAngle))) / Math.sin(absAngle)
  return Math.abs(shift)
}

function getSnapToSectionLength({
  position,
  prevPoint,
  prevPrevPoint,
  sectionLength,
  width,
  lineAlignment,
  WeightedSectionSappingDist,
}: {
  position: Vector3
  prevPoint: Vector3
  prevPrevPoint: Vector3 | undefined
  sectionLength: number
  width: number
  lineAlignment: "right" | "left" | "center"
  WeightedSectionSappingDist: number
}) {
  const lineLength = ((position.x - prevPoint.x) ** 2 + (position.y - prevPoint.y) ** 2) ** 0.5
  if (lineLength === 0) return { snappedPosition: position, snapped: false }
  const unitVec = [(position.x - prevPoint.x) / lineLength, (position.y - prevPoint.y) / lineLength]
  let cornerBuffer = 0
  if (prevPrevPoint) {
    const cornerAngle = getAngle(position, prevPoint, prevPrevPoint)
    if (lineAlignment === "center") cornerBuffer = getCornerBuffer(0.5 * width, cornerAngle)
    if (lineAlignment === "left" && cornerAngle > 0) cornerBuffer = getCornerBuffer(width, cornerAngle)
    if (lineAlignment === "right" && cornerAngle < 0) cornerBuffer = getCornerBuffer(width, cornerAngle)
  }

  let distToClosestSection = cornerBuffer

  for (let i = 0; i < 100; i++) {
    if (lineLength < distToClosestSection + 0.5 * sectionLength) {
      break
    }
    distToClosestSection += sectionLength
  }

  const pointOnSection = new Vector3(
    prevPoint.x + distToClosestSection * unitVec[0],
    prevPoint.y + distToClosestSection * unitVec[1],
    position.z,
  )

  const distToSection = Math.abs(distToClosestSection - lineLength)

  if (distToSection < WeightedSectionSappingDist) return { snappedPosition: pointOnSection, snapped: true }

  return { snappedPosition: position, snapped: false }
}

const SectionSnappingDist = 10
export function snapPointToSection({
  position,
  line,
  parameters,
  startSnap,
}: {
  position: Vector3
  line: Vector3[]
  parameters: { minSubBuildingLength: number; width: number; lineAlignment: "right" | "center" | "left" }
  startSnap: ConnectToOtherBuildingPoint
}) {
  const { width, minSubBuildingLength: sectionLength, lineAlignment } = parameters
  const WeightedSectionSappingDist = pixelsToMetersAtPositionStatic(SectionSnappingDist, position)

  if (line.length < 1) return { snappedPosition: position, snapped: false }

  const n = line.length
  const prevPoint = line[n - 1]

  const distToPrevPoint = pointPointDistanceXY(prevPoint, position)
  if (distToPrevPoint < 1e-4) return { snappedPosition: position, snapped: false }

  let prevPrevPoint
  if (n >= 2) prevPrevPoint = line[n - 2]
  if (n === 1 && startSnap) prevPrevPoint = startSnap.prevPoint

  return getSnapToSectionLength({
    position: position,
    prevPoint,
    prevPrevPoint,
    sectionLength,
    width,
    lineAlignment,
    WeightedSectionSappingDist,
  })
}
