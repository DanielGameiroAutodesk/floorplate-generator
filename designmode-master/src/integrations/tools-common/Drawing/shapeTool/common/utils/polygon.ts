import { Vector3 } from "three"
import ArrayUtils from "src/lib/array"
import { RBush3D } from "rbush-3d"
import lca from "line-of-closest-approach"
import type { Coord3D, Segment } from "src/lib/geometry/geometryTypes"

export interface PolygonOnGround {
  type: "PolygonOnGround"
  shape: [number, number][]
}

function sameCoord(c1: Coord3D, c2: Coord3D): boolean {
  function sameish(n1: number, n2: number) {
    return Math.abs(n1 - n2) < 0.001
  }

  return sameish(c1[0], c2[0]) && sameish(c1[1], c2[1]) && sameish(c1[2], c2[2])
}

function isConnected([s1start, s1end]: Segment, [s2start, s2end]: Segment): boolean {
  return (
    sameCoord(s1start, s2start) || sameCoord(s1start, s2end) || sameCoord(s1end, s2start) || sameCoord(s1end, s2end)
  )
}

const reusedVector_1 = new Vector3()
const reusedVector_2 = new Vector3()

function segmentLength([[x, y, z], [x2, y2, z2]]: Segment): number {
  reusedVector_1.set(x2 - x, y2 - y, z2 - z)
  return reusedVector_1.length()
}

function angleBetweenSegments(s1: Segment, s2: Segment): number {
  reusedVector_1.set(s1[1][0] - s1[0][0], s1[1][1] - s1[0][1], 0)
  reusedVector_2.set(s2[1][0] - s2[0][0], s2[1][1] - s2[0][1], 0)
  return reusedVector_1.angleTo(reusedVector_2)
}

const tree = new RBush3D(5)

export function isLineStringIntersectingOrHasLoopbacks2D(points: Vector3[]): boolean {
  if (points.length <= 2) return false

  const segments = ArrayUtils.sliding2(points.map(({ x, y }) => [x, y, 0] as [number, number, number]))

  //If the angle at a corner is (close to) 180 degrees, the polygon is considered self intersecting
  const hasLoopback = segments.some((currentSegment, index, array) => {
    let nextIndex = (index + 1) % array.length
    let nextSegment = array[nextIndex]
    if (nextIndex === 0 && !isConnected(currentSegment, nextSegment)) return false

    let angle = angleBetweenSegments(currentSegment, nextSegment)
    return Math.abs(angle - Math.PI) < 0.0001
  })
  if (hasLoopback) return true

  if (points.length <= 3) return false

  tree.clear()
  const eps = 0.001 //1mm

  function segToBox(segment: Segment, buffer = 0) {
    return {
      minX: Math.min(segment[0][0], segment[1][0]) - buffer,
      maxX: Math.max(segment[0][0], segment[1][0]) + buffer,
      minY: Math.min(segment[0][1], segment[1][1]) - buffer,
      maxY: Math.max(segment[0][1], segment[1][1]) + buffer,
      minZ: Math.min(segment[0][2], segment[1][2]) - buffer,
      maxZ: Math.max(segment[0][2], segment[1][2]) + buffer,
      segment,
    }
  }

  segments.forEach((segment) => {
    tree.insert(segToBox(segment))
  })
  return segments.some((seg) => {
    const inVicinity = tree.search(segToBox(seg, eps * 2))
    return inVicinity.some((seg2box) => {
      //Segments that share a corner and intersect by overlapping are handled by the hasLoopback check above
      const seg2 = seg2box.segment
      if (isConnected(seg, seg2)) return false

      let lineOfClosestApproach = lca(seg, seg2, true)
      let distance = segmentLength([lineOfClosestApproach[0], lineOfClosestApproach[1]])

      //If lines cross each other within eps distance, we consider them to be intersecting
      return distance <= eps
    })
  })
}

export function subdividePolygon(vertices: Vector3[], subdivisionMeters = 5, closedPolygon = true): Vector3[] {
  if (vertices.length < 2) return vertices

  const subdivided: Vector3[] = []
  const lastSegment = closedPolygon ? vertices.length : vertices.length - 1
  for (let i = 0; i < lastSegment; i++) {
    const cur = vertices[i]
    subdivided.push(cur)

    const next = vertices[(i + 1) % vertices.length]
    const difference = new Vector3().subVectors(next, cur)
    const distance = difference.length()
    if (distance > 1) {
      const numPieces = Math.floor(distance / subdivisionMeters)
      const distancePerPiece = distance / numPieces
      const direction = difference.clone().normalize()
      for (let p = 0; p < numPieces - 1; p++) {
        subdivided.push(new Vector3().addVectors(cur, direction.clone().multiplyScalar(distancePerPiece * (p + 1))))
      }
    }
  }
  if (!closedPolygon) {
    subdivided.push(vertices[vertices.length - 1])
  }

  return subdivided
}

export const subdivideLine = (v: Vector3[], s?: number) => subdividePolygon(v, s, false)
