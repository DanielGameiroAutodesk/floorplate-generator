import { Vector3 } from "three"
import type { ConnectToOtherBuildingPoint } from "./drawLineBuildingSnapping"
import { moveAlongVectorXY } from "src/integrations/building-systems-common/geometryHelpers"
import { getUnitNormalVectorXY, getUnitVectorXY } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"

function getRightAngleSnapLine({
  line,
  startSnap,
}: {
  line: Vector3[]
  startSnap: ConnectToOtherBuildingPoint
}): [Vector3, Vector3] | undefined {
  const n = line.length
  if (n > 1) {
    const p0 = line[n - 2]
    const p1 = line[n - 1]
    const normal = getUnitNormalVectorXY(p0, p1)
    const pStart = moveAlongVectorXY(p1, normal, -1000)
    const pEnd = moveAlongVectorXY(p1, normal, 1000)
    return [new Vector3(pStart.x, pStart.y, p1.z), new Vector3(pEnd.x, pEnd.y, p1.z)]
  } else if (n > 0 && startSnap) {
    const p0 = startSnap.prevPoint
    const p1 = line[n - 1]
    const normal = getUnitNormalVectorXY(p0, p1)
    const pStart = moveAlongVectorXY(p1, normal, -1000)
    const pEnd = moveAlongVectorXY(p1, normal, 1000)
    return [new Vector3(pStart.x, pStart.y, p1.z), new Vector3(pEnd.x, pEnd.y, p1.z)]
  }
}

function getDrawFromSnapLines({ line, drawFromLines }: { line: Vector3[]; drawFromLines: SnapFromLines }) {
  const snapLines: [Vector3, Vector3][] = []
  const n = line.length
  if (n === 0) return []
  for (let drawFromLine of drawFromLines) {
    const [p0, p1] = drawFromLine
    const p2 = line[n - 1]

    const normal = getUnitNormalVectorXY(p0, p1)
    const unit = getUnitVectorXY(p0, p1)
    {
      const pStart = moveAlongVectorXY(p2, normal, -1000)
      const pEnd = moveAlongVectorXY(p2, normal, 1000)
      const snapLine: [Vector3, Vector3] = [new Vector3(pStart.x, pStart.y, p2.z), new Vector3(pEnd.x, pEnd.y, p2.z)]
      snapLines.push(snapLine)
    }
    {
      const pStart = moveAlongVectorXY(p2, unit, -1000)
      const pEnd = moveAlongVectorXY(p2, unit, 1000)
      const snapLine: [Vector3, Vector3] = [new Vector3(pStart.x, pStart.y, p2.z), new Vector3(pEnd.x, pEnd.y, p2.z)]
      snapLines.push(snapLine)
    }
  }
  return snapLines
}

type SnapFromLines = [Vector3, Vector3][]
export function getDirectionalSnapLines({
  line,
  startSnap,
  drawFromLines,
}: {
  line: Vector3[]
  startSnap: ConnectToOtherBuildingPoint
  drawFromLines: SnapFromLines
}) {
  const directionLines: [Vector3, Vector3][] = []
  const rightAngleSnapLine = getRightAngleSnapLine({ line, startSnap })
  if (rightAngleSnapLine) directionLines.push(rightAngleSnapLine)

  const drawFromSnapLines = getDrawFromSnapLines({ line, drawFromLines })

  directionLines.push(...drawFromSnapLines)

  return directionLines
}
