import { type Matrix4, Matrix3, Vector2 } from "three"

export function get2dTransform(transform: Matrix4): Matrix3 {
  const elements = transform.elements
  const m = new Matrix3(
    elements[0],
    elements[4],
    elements[12],
    elements[1],
    elements[5],
    elements[13],
    elements[3],
    elements[7],
    elements[15],
  )
  return m
}

export function computeCornerAngles(points: { x: number; y: number }[]): number[] {
  const vector2s = points.map((v) => new Vector2(v.x, v.y))
  const edgeVecs = vector2s.slice(1).map((v, i) => v.clone().sub(vector2s[i]))
  return edgeVecs.slice(1).map((v, i) => Math.PI - Math.abs(v.angleTo(edgeVecs[i])))
}
