import type { MultiRingPolygon } from "forma-elements"
import { assertNever } from "src/lib/assertNever"
import { type Matrix4, Vector3 } from "three"

export type Surface = {
  polygon: MultiRingPolygon
  functions: SurfaceFunction[]
  horizontalProjection: HorizontalProjection
}

export type SurfaceFunction = { id: string }

export type HorizontalProjection =
  | {
      type: "onGround"
    }
  | { type: "atElevation"; elevation: number }

export enum BuiltInSurfaceFunctions {
  Building = "building",
  Vegetation = "vegetation",
  Road = "road",
  RailRoad = "railRoad",
  Parking = "parking",
}

export function applyTransformToHorizontalProjection(
  value: HorizontalProjection,
  transform: Matrix4,
): HorizontalProjection {
  switch (value.type) {
    case "onGround":
      return value
    case "atElevation":
      return {
        type: "atElevation",
        elevation: value.elevation + new Vector3().setFromMatrixPosition(transform).z,
      }
    default:
      assertNever(value)
  }
}
