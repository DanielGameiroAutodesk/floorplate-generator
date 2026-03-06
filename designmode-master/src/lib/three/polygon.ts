import type { Vector3 } from "three"

/**
 * Removes the last vertex of a polygon if it is in exactly the same position as the first
 * NOTE: Modifies the input array
 */
export function openPolygon(vertices: Vector3[]): Vector3[] {
  if (vertices[0].manhattanDistanceTo(vertices[vertices.length - 1]) === 0) {
    vertices.pop()
  }
  return vertices
}

/**
 * Adds a vertex at the end of the polygon, equal to the first, if they are not already equal (in the same position)
 * NOTE: Modifies the input array
 */

export function closePolygon(vertices: Vector3[]): Vector3[] {
  if (vertices.length === 0) return []
  if (vertices[0].manhattanDistanceTo(vertices[vertices.length - 1]) > 0) {
    vertices.push(vertices[0].clone())
  }
  return vertices
}
