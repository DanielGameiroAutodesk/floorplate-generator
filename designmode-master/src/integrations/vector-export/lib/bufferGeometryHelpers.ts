import { BufferGeometry, Triangle } from "three"
import * as THREE from "three"

export function extractTrianglesFromBufferGeometry(geo: BufferGeometry) {
  const vertices = geo.getAttribute("position").array
  const indexAttribute = geo.getIndex()

  let allTriangles: Triangle[] = []

  if (indexAttribute) {
    const indices = indexAttribute.array
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]
      const b = indices[i + 1]
      const c = indices[i + 2]
      allTriangles.push(
        new Triangle(
          new THREE.Vector3(vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2]),
          new THREE.Vector3(vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2]),
          new THREE.Vector3(vertices[c * 3], vertices[c * 3 + 1], vertices[c * 3 + 2]),
        ),
      )
    }
  } else {
    // If there's no index, assume each consecutive group of 3 vertices forms a triangle
    for (let i = 0; i < vertices.length; i += 9) {
      allTriangles.push(
        new Triangle(
          new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]),
          new THREE.Vector3(vertices[i + 3], vertices[i + 4], vertices[i + 5]),
          new THREE.Vector3(vertices[i + 6], vertices[i + 7], vertices[i + 8]),
        ),
      )
    }
  }
  return allTriangles
}

export function buildBufferGeometryFromTriangles(allTriangles: Triangle[]) {
  // Using the list of triangles, build a new position array and bufferGeometry
  const newVertices: number[] = []
  const newIndices: number[] = []

  allTriangles.forEach((triangle, index) => {
    ;[triangle.a, triangle.b, triangle.c].forEach((vertex) => {
      newVertices.push(vertex.x, vertex.y, vertex.z)
    })
    newIndices.push(index * 3, index * 3 + 1, index * 3 + 2)
  })

  const newGeo = new BufferGeometry()
  newGeo.setAttribute("position", new THREE.Float32BufferAttribute(newVertices, 3))
  newGeo.setIndex(newIndices)
  return newGeo
}
