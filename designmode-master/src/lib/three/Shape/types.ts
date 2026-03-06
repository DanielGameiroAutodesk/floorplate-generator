import type { Vector3 } from "three"

export type Edge = [number, number]
export type Loop = number[]
export type Shape = {
  vertices: Vector3[]
  edges: Edge[]
  loops: Loop[]
}
export type AdjustmentFunction = (currentPos: Vector3) => Vector3
