import type { BufferGeometry, Float32BufferAttribute } from "three"

export function determinant(vector1: number[], vector2: number[]) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}

export function polygonArea(poly: number[][]) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    area += determinant(p1, p2)
  }
  return 0.5 * Math.abs(area)
}

export function polygonPerimeter(poly: number[][]) {
  let perimeter = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    const distance = Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
    perimeter += distance
  }
  return perimeter
}

export function calculateGeometryVolume(geometry: BufferGeometry): number {
  const position = geometry.getAttribute("position") as Float32BufferAttribute
  const index = geometry.getIndex()

  if (!index) {
    throw new Error("Geometry must have an index to calculate volume.")
  }

  const indices = index.array as Uint32Array
  const vertices = position.array as Float32Array
  let volume = 0

  for (let i = 0; i < indices.length; i += 3) {
    const p1 = getVertex(vertices, indices[i])
    let p2 = getVertex(vertices, indices[i + 1])
    let p3 = getVertex(vertices, indices[i + 2])
    volume += calculateTetrahedronVolume(p1, p2, p3)
  }

  return volume
}

export function getVertex(vertices: Float32Array, index: number): [number, number, number] {
  return [vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2]]
}

export function calculateTetrahedronVolume(
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
): number {
  return (
    (p1[0] * (p2[1] * p3[2] - p2[2] * p3[1]) -
      p1[1] * (p2[0] * p3[2] - p2[2] * p3[0]) +
      p1[2] * (p2[0] * p3[1] - p2[1] * p3[0])) /
    6
  )
}
