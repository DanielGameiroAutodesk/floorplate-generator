declare module "offset-polygon" {
  import type { Vector2Like } from "three"
  export default function offsetPolygon(polygon: Vector2Like[], size: number, arcSegments: number): Vector2Like[]
}
