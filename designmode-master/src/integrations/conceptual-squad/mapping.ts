type Point3D = [number, number, number]

function verticesEqual(vertex1: Point3D, vertex2: Point3D): boolean {
  return vertex1[0] === vertex2[0] && vertex1[1] === vertex2[1] && vertex1[2] === vertex2[2]
}

function findIndex(point: Point3D, vertices: Point3D[]) {
  for (let i = 0; i < vertices.length; i++) {
    if (verticesEqual(point, vertices[i])) return i
  }
  return null
}

function trianglesToVerticesAndFaces(triangles: Point3D[][]) {
  const vertices = [] as Point3D[]
  const faces = [] as number[]
  triangles.forEach((t) => {
    t.forEach((vertex) => {
      const index = findIndex(vertex, vertices)
      if (index === null) {
        const len = vertices.push(vertex)
        faces.push(len - 1)
      } else {
        faces.push(index)
      }
    })
  })
  return { vertices: vertices.flat(), faces }
}

export function positionsToVertsAndFaces(positions: Float32Array): { verts: number[]; faces: number[] } {
  // positions: 3D points in triangles
  const dimension = 3
  const numPoints = positions.length / dimension
  let points = []
  for (let i = 0; i < numPoints; i++) {
    points[i] = [positions[i * dimension], positions[i * dimension + 1], positions[i * dimension + 2]] as Point3D
  }
  let triangles = []
  const numTriangles = numPoints / dimension
  for (let i = 0; i < numTriangles; i++) {
    triangles[i] = [points[i * dimension], points[i * dimension + 1], points[i * dimension + 2]]
  }
  const vertsAndFaces = trianglesToVerticesAndFaces(triangles)
  return { verts: vertsAndFaces.vertices, faces: vertsAndFaces.faces }
}
