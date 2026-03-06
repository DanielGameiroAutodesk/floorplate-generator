import { type Matrix4, Vector3 } from "three"
import type { MultiRingPolygon } from "forma-elements"

export function transformMultiRingPolygon(polygon: MultiRingPolygon, transform: Matrix4): MultiRingPolygon {
  const reusableVector = new Vector3()
  const transformCoords = (coords: [number, number]): [number, number] => {
    const [x, y] = coords
    reusableVector.set(x, y, 0)
    reusableVector.applyMatrix4(transform)
    return [reusableVector.x, reusableVector.y]
  }
  return polygon.map((ring) => ring.map(transformCoords))
}
