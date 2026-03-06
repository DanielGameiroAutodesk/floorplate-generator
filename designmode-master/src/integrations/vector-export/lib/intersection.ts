import * as THREE from "three"
import { type BufferGeometry, Line3 } from "three"
import { type MeshBVH } from "three-mesh-bvh"
import { extractTrianglesFromBufferGeometry } from "./bufferGeometryHelpers"

const EPSILON = 1e-6

function isSharedEdge(edge1: THREE.Line3, edge2: THREE.Line3): boolean {
  const [start1, end1] = [edge1.start, edge1.end]
  const [start2, end2] = [edge2.start, edge2.end]

  const isPointOnEdge = (point: THREE.Vector3, edgeStart: THREE.Vector3, edgeEnd: THREE.Vector3) => {
    const line = new THREE.Line3(edgeStart, edgeEnd)
    if (line.closestPointToPoint(point, true, new THREE.Vector3()).distanceTo(point) > 100 * EPSILON) return false
    return true
  }

  return (
    (start1.equals(start2) && end1.equals(end2)) ||
    (start1.equals(end2) && end1.equals(start2)) ||
    (isPointOnEdge(start1, start2, end2) && isPointOnEdge(end1, start2, end2)) ||
    (isPointOnEdge(start2, start1, end1) && isPointOnEdge(end2, start1, end1))
  )
}

export function triangleTriangleIntersection(
  tri1: THREE.Triangle,
  tri2: THREE.Triangle,
  ignoreIntersectionOnEdges = true,
): THREE.Line3 | THREE.Vector3 | null {
  // NOTE: DOES NOT WORK FOR COPLANAR TRIANGLES
  // TODO: Implement coplanar triangle intersection

  function edgeAgainstTriangle(
    edgeStart: THREE.Vector3,
    edgeEnd: THREE.Vector3,
    triangle: THREE.Triangle,
  ): THREE.Vector3 | null {
    const edgeDir = new THREE.Vector3().subVectors(edgeEnd, edgeStart)
    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3().subVectors(triangle.b, triangle.a),
        new THREE.Vector3().subVectors(triangle.c, triangle.a),
      )
      .normalize()

    const d = -normal.dot(triangle.a)
    const t = -(normal.dot(edgeStart) + d) / normal.dot(edgeDir)

    if (t < 0 || t > 1) return null

    const intersectionPoint = new THREE.Vector3().addVectors(edgeStart, edgeDir.multiplyScalar(t))
    const u = new THREE.Vector3().subVectors(triangle.b, triangle.a)
    const v = new THREE.Vector3().subVectors(triangle.c, triangle.a)
    const w = new THREE.Vector3().subVectors(intersectionPoint, triangle.a)

    const uu = u.dot(u)
    const uv = u.dot(v)
    const vv = v.dot(v)
    const wu = w.dot(u)
    const wv = w.dot(v)
    const denom = uv * uv - uu * vv

    const s = (uv * wv - vv * wu) / denom
    const t2 = (uv * wu - uu * wv) / denom

    if (s >= 0 && t2 >= 0 && s + t2 <= 1) {
      return intersectionPoint
    }

    return null
  }

  function triangleIntersection(
    triangle1: THREE.Triangle,
    triangle2: THREE.Triangle,
  ): THREE.Line3 | THREE.Vector3 | null {
    const edges1: [THREE.Vector3, THREE.Vector3][] = [
      [triangle1.a, triangle1.b],
      [triangle1.b, triangle1.c],
      [triangle1.c, triangle1.a],
    ]
    const edges2: [THREE.Vector3, THREE.Vector3][] = [
      [triangle2.a, triangle2.b],
      [triangle2.b, triangle2.c],
      [triangle2.c, triangle2.a],
    ]

    const intersections: THREE.Vector3[] = []

    edges1.forEach(([start, end]) => {
      const intersection = edgeAgainstTriangle(start, end, triangle2)
      if (intersection) intersections.push(intersection)
    })

    edges2.forEach(([start, end]) => {
      const intersection = edgeAgainstTriangle(start, end, triangle1)
      if (intersection) intersections.push(intersection)
    })

    if (intersections.length === 0) return null
    if (intersections.length === 1) {
      // Check for a common point of the two triangles that is also not the intersection point
      // If it exists, we either have a legitimate intersection, or we have a shared triangle edge (to be filtered out)
      const commonPoint = [triangle1.a, triangle1.b, triangle1.c].find((point1) =>
        [triangle2.a, triangle2.b, triangle2.c].some(
          (point2) => point1.distanceTo(point2) < EPSILON && point1.distanceTo(intersections[0]) > EPSILON,
        ),
      )
      if (commonPoint) intersections.push(commonPoint)
      else return intersections[0]
    }

    const uniqueIntersections: THREE.Vector3[] = []
    intersections.forEach((point) => {
      if (!uniqueIntersections.some((p) => p.distanceTo(point) < EPSILON)) {
        uniqueIntersections.push(point)
      }
    })

    if (uniqueIntersections.length === 1) return uniqueIntersections[0]
    if (uniqueIntersections.length === 2) {
      const intersectionLine = new THREE.Line3(uniqueIntersections[0], uniqueIntersections[1])
      const onTriangleEdge =
        edges1.some((edge) => isSharedEdge(intersectionLine, new THREE.Line3(edge[0], edge[1]))) ||
        edges2.some((edge) => isSharedEdge(intersectionLine, new THREE.Line3(edge[0], edge[1])))
      if (onTriangleEdge && ignoreIntersectionOnEdges) return null

      return intersectionLine
    }

    return null
  }

  return triangleIntersection(tri1, tri2)
}

export function triangleQuadrilateralIntersection(
  triangle: THREE.Triangle,
  halfQuadTriangle1: THREE.Triangle,
  halfQuadTriangle2: THREE.Triangle,
): Line3 | null {
  const intersection1 = triangleTriangleIntersection(halfQuadTriangle1, triangle)
  const intersection2 = triangleTriangleIntersection(halfQuadTriangle2, triangle)
  let line: Line3 | null = null
  if (intersection1 instanceof Line3 && intersection2 instanceof Line3) {
    const distances = [
      intersection1.start.distanceTo(intersection2.start),
      intersection1.start.distanceTo(intersection2.end),
      intersection1.end.distanceTo(intersection2.start),
      intersection1.end.distanceTo(intersection2.end),
    ]
    const closestIndex = distances.indexOf(Math.min(...distances))
    if (closestIndex === 0) {
      line = new Line3(intersection1.end, intersection2.end)
    }
    if (closestIndex === 1) {
      line = new Line3(intersection1.end, intersection2.start)
    }
    if (closestIndex === 2) {
      line = new Line3(intersection1.start, intersection2.end)
    }
    if (closestIndex === 3) {
      line = new Line3(intersection1.start, intersection2.start)
    }
    if (!line) console.log("Failed to merge lines")
  } else if (intersection1 instanceof Line3) {
    line = intersection1
  } else if (intersection2 instanceof Line3) {
    line = intersection2
  }
  return line
}

export function getMeshToMeshIntersectionLines(bufferGeometry: BufferGeometry, bvh: MeshBVH): Line3[] {
  const lines: Line3[] = []
  const allTriangles = extractTrianglesFromBufferGeometry(bufferGeometry)

  for (let i = 0; i < allTriangles.length; i++) {
    const triangle = allTriangles[i]
    bvh.shapecast({
      intersectsBounds: (box) => {
        return triangle.intersectsBox(box)
      },
      intersectsTriangle: (tri) => {
        const intersection = triangleTriangleIntersection(tri, triangle)
        if (intersection instanceof Line3) {
          lines.push(intersection)
        }
      },
    })
  }
  return lines
}
