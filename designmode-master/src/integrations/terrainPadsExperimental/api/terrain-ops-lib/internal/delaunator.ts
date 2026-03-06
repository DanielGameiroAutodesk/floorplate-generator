import Delaunator from "delaunator"
import Constrainautor from "@kninnug/constrainautor"

interface DelaunatorLike {
  triangles: Uint32Array
  coords: Float32Array
}
function points2dToArray(points: Point[]) {
  const input = new Float32Array(points.length * 2)
  for (let i = 0; i < points.length; i++) {
    input[i * 2] = points[i][0]
    input[i * 2 + 1] = points[i][1]
  }
  return input
}

export function runConstrainedDelaunay(points: Point[], constrainedEdges: [number, number][]): Uint32Array {
  const delaunay = new Delaunator(points2dToArray(points))
  const con = new Constrainautor(delaunay)

  for (let edge of constrainedEdges) {
    con.constrainOne(edge[0], edge[1])
  }

  return getTriangles(con.del)
}

type Point = [number, number, number]

function getTriangles(delaunay: DelaunatorLike): Uint32Array {
  const res = new Uint32Array(delaunay.triangles.length)
  for (let t = 0; t < delaunay.triangles.length / 3; t++) {
    res[t * 3] = delaunay.triangles[t * 3 + 2]
    res[t * 3 + 1] = delaunay.triangles[t * 3 + 1]
    res[t * 3 + 2] = delaunay.triangles[t * 3]
  }
  return res
}
