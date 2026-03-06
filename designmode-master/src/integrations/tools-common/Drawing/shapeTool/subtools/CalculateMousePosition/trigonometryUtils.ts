/*
  startVector ---- <lengthInMeters> ---- x ------ endVector
                                         |
                                  PointAlongLine
 */
import { MathUtils, Vector2, Vector3 } from "three"
import { isDefined } from "src/lib/array"
import { round } from "src/lib/math/round"
import { getAngleInRadians } from "src/lib/three/geometryUtils"
import { to360Degrees } from "src/lib/geometry/geometryUtils"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { raycast } from "src/core/terrain/2d-raytracer"

export const getPointAlongLine = (startVector: Vector3, endVector: Vector3, lengthInMeters: number): Vector3 =>
  endVector.clone().sub(startVector).setLength(lengthInMeters).add(startVector)
const tempStart = new Vector2()
const tempEnd = new Vector2()
let tempEnd3 = new Vector3()

export function getPointAlongAngle(startVec: Vector3, endVec: Vector3, angleInDegrees: number, segmentLength: number) {
  const position = startVec.clone().sub(endVec)
  position.setLength(segmentLength)

  tempEnd3 = startVec.clone().add(position)
  tempEnd.set(tempEnd3.x, tempEnd3.y)
  tempStart.set(startVec.x, startVec.y)
  tempEnd.rotateAround(tempStart, MathUtils.degToRad(angleInDegrees + 180))
  position.set(tempEnd.x, tempEnd.y, startVec.z)
  return position
}

function getPointAlongAngleOnTerrain(
  startVec: Vector3,
  endVec: Vector3,
  angleInDegrees: number,
  segmentLength: number,
  terrainSamplerData: TerrainSamplerData,
) {
  const position = startVec.clone().sub(endVec)
  position.setLength(segmentLength)

  tempEnd3 = startVec.clone().add(position)
  tempEnd.set(tempEnd3.x, tempEnd3.y)
  tempStart.set(startVec.x, startVec.y)
  tempEnd.rotateAround(tempStart, MathUtils.degToRad(angleInDegrees + 180))

  let elevation = raycast(tempEnd.x, tempEnd.y, terrainSamplerData)

  position.set(tempEnd.x, tempEnd.y, elevation)

  return position
}

/*
  Repositions current point (point by cursor) based on parameters given by user.
  - Moves the point by lengthInMeters when defined
  - Rotates the point by angleInDegrees when defined

   -- [points] ---- <lengthInMeters> ---- x ------ currentPoint
                                           \
                                      <angleInDegrees>
                                             \
                                              \
                                    repositionedCurrentPoint
 */
export function getRepositionedCurrentPoint(
  points: Vector3[],
  angleInDegrees: number | undefined,
  lengthInMeters: number | undefined,
  currentPoint?: Vector3,
  terrainSamplerData?: TerrainSamplerData,
): Vector3 | undefined {
  if (!currentPoint) return undefined
  const lastPoint = points[points.length - 1]

  if (isDefined(angleInDegrees) && points.length >= 2) {
    const startVec = lastPoint
    const endVec = points[points.length - 2]
    const segLength = lengthInMeters || currentPoint.distanceTo(lastPoint)

    return terrainSamplerData
      ? getPointAlongAngleOnTerrain(startVec, endVec, angleInDegrees, segLength, terrainSamplerData)
      : getPointAlongAngle(startVec, endVec, angleInDegrees, segLength)
  }

  if (isDefined(lengthInMeters) && points.length >= 1) {
    return getPointAlongLine(lastPoint, currentPoint, lengthInMeters)
  }

  return currentPoint
}

function lastThreeVerticesToAngleInDegrees(vertices: Vector3[]) {
  if (vertices.length < 3) return 0

  const pivotVec = vertices[vertices.length - 2]
  const startVec = vertices[vertices.length - 1]
  const endVec = vertices[vertices.length - 3]

  const angleInRadians = getAngleInRadians(pivotVec, startVec, endVec)

  return round(to360Degrees(MathUtils.radToDeg(angleInRadians)), 2)
}

export function getCurrentDrawAngle(userDefinedAngle: number | undefined, vertices: Vector3[]): number {
  if (isDefined(userDefinedAngle) && !isNaN(userDefinedAngle)) {
    return userDefinedAngle
  }

  if (vertices.length >= 3) {
    return lastThreeVerticesToAngleInDegrees(vertices)
  }

  return 0
}
