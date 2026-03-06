import { getLinesFromGraph, isLineClosed } from "./helpers/lineAlignment"
import { Matrix4, Vector3 } from "three"
import { addVectorToPoint, getUnitNormalVectorXY } from "@spacemakerai/line-buildings-shared/helpers/fps/geoUtils"
import type { Graph } from "@spacemakerai/line-buildings-shared/shapeHelpers"

function getSnappingPointsOnBuilding(building: { width: number; graph: Graph }) {
  const { graph, width } = building
  const line = getLinesFromGraph(graph)[0]

  const closedLine = isLineClosed(line)
  if (closedLine) return undefined

  const p0 = line[0]
  const p1 = line[1]

  const unitNormalStart = getUnitNormalVectorXY(p0, p1)

  const startLeft = addVectorToPoint(p0, unitNormalStart, 0.5 * width)
  const startCenter = { ...p0 }
  const startRight = addVectorToPoint(p0, unitNormalStart, -0.5 * width)

  const nextStartLeft = addVectorToPoint(p1, unitNormalStart, 0.5 * width)
  const nextStartCenter = { ...p1 }
  const nextStartRight = addVectorToPoint(p1, unitNormalStart, -0.5 * width)

  const n = line.length
  const p2 = line[n - 2]
  const p3 = line[n - 1]

  const unitNormalEnd = getUnitNormalVectorXY(p2, p3)
  const endLeft = addVectorToPoint(p3, unitNormalEnd, 0.5 * width)
  const endCenter = { ...p3 }
  const endRight = addVectorToPoint(p3, unitNormalEnd, -0.5 * width)

  const preEndLeft = addVectorToPoint(p2, unitNormalEnd, 0.5 * width)
  const preEndCenter = { ...p2 }
  const preEndRight = addVectorToPoint(p2, unitNormalEnd, -0.5 * width)

  return {
    startLeft,
    startCenter,
    startRight,
    endLeft,
    endCenter,
    endRight,
    preEndLeft,
    preEndCenter,
    preEndRight,
    nextStartLeft,
    nextStartCenter,
    nextStartRight,
  }
}

export function getSnappingPointsToOtherBuilding(
  otherBuilding: { width: number; graph: Graph },
  otherBuildingWorldTransformation: Matrix4 | undefined,
  lineAlignment: "center" | "right" | "left",
  startOfDrawing: boolean = false,
) {
  const allSnappingPoints = getSnappingPointsOnBuilding(otherBuilding)
  if (!allSnappingPoints) return undefined
  const transform = otherBuildingWorldTransformation ? otherBuildingWorldTransformation : new Matrix4()
  if (lineAlignment === "center") {
    const { startCenter, endCenter, nextStartCenter, preEndCenter } = allSnappingPoints
    const startVec = new Vector3(startCenter.x, startCenter.y).applyMatrix4(transform)
    const endVec = new Vector3(endCenter.x, endCenter.y).applyMatrix4(transform)
    const nextStartVec = new Vector3(nextStartCenter.x, nextStartCenter.y).applyMatrix4(transform)
    const preEndVec = new Vector3(preEndCenter.x, preEndCenter.y).applyMatrix4(transform)
    return { start: startVec, end: endVec, nextStartVec, preEndVec }
  }
  if ((lineAlignment === "left" && startOfDrawing) || (lineAlignment === "right" && !startOfDrawing)) {
    const { startRight, endLeft, nextStartLeft, preEndLeft } = allSnappingPoints
    const startVec = new Vector3(startRight.x, startRight.y).applyMatrix4(transform)
    const endVec = new Vector3(endLeft.x, endLeft.y).applyMatrix4(transform)
    const nextStartVec = new Vector3(nextStartLeft.x, nextStartLeft.y).applyMatrix4(transform)
    const preEndVec = new Vector3(preEndLeft.x, preEndLeft.y).applyMatrix4(transform)
    return { start: startVec, end: endVec, nextStartVec, preEndVec }
  }
  if ((lineAlignment === "left" && !startOfDrawing) || (lineAlignment === "right" && startOfDrawing)) {
    const { startLeft, endRight, nextStartRight, preEndRight } = allSnappingPoints
    const startVec = new Vector3(startLeft.x, startLeft.y).applyMatrix4(transform)
    const endVec = new Vector3(endRight.x, endRight.y).applyMatrix4(transform)
    const nextStartVec = new Vector3(nextStartRight.x, nextStartRight.y).applyMatrix4(transform)
    const preEndVec = new Vector3(preEndRight.x, preEndRight.y).applyMatrix4(transform)
    return { start: startVec, end: endVec, nextStartVec, preEndVec }
  }
}
