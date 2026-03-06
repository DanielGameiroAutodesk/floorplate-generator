import { Matrix4, Vector3 } from "three"
import ArrayUtils from "src/lib/array"
import type { Edge, Loop, Shape } from "./types"

const center = new Vector3()
const radialPoint = new Vector3()

export function circleFrom2Points(
  centerPos: [number, number, number],
  radialPointPos: [number, number, number],
): Shape {
  center.fromArray(centerPos)
  radialPoint.fromArray(radialPointPos)

  const radius = center.distanceTo(radialPoint)
  const sections = Math.min(200, Math.max(12, Math.ceil((2 * Math.PI * radius) / 4)))

  const currentPoint = new Vector3().subVectors(radialPoint, center)
  const rotation = new Matrix4().makeRotationZ((Math.PI * 2) / sections)

  const vertices = []
  for (let v = 0; v < sections; v++) {
    vertices.push(currentPoint.clone().add(center))
    currentPoint.applyMatrix4(rotation)
  }

  const vertexIndices = vertices.map((_, idx) => idx)
  vertexIndices.push(0)
  const edges: Edge[] = ArrayUtils.sliding2(vertexIndices)
  const loops: Loop[] = []
  return {
    vertices,
    edges,
    loops,
  }
}
