import type { Box3 } from "three"
import { Vector3 } from "three"
import { CONTAINED, INTERSECTED, type MeshBVH, NOT_INTERSECTED } from "three-mesh-bvh"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"

type PointXY = { x: number; y: number }
type PointXYZ = { x: number; y: number; z: number }

export function lineSegmentIntersection(p0: PointXYZ, p1: PointXYZ, a: PointXY, b: PointXY): PointXYZ | null {
  const s1_x = p1.x - p0.x
  const s1_y = p1.y - p0.y
  const s1_z = p1.z - p0.z
  const s2_x = b.x - a.x
  const s2_y = b.y - a.y

  const denominator = -s2_x * s1_y + s1_x * s2_y

  if (denominator === 0) {
    // Lines are parallel or collinear
    return null
  }

  const s = (-s1_y * (p0.x - a.x) + s1_x * (p0.y - a.y)) / denominator
  const t = (s2_x * (p0.y - a.y) - s2_y * (p0.x - a.x)) / denominator

  // Check if the intersection point is within the bounds of both segments
  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    // Intersection detected
    const intersectionX = p0.x + t * s1_x
    const intersectionY = p0.y + t * s1_y
    const intersectionZ = p0.z + t * s1_z
    return { x: intersectionX, y: intersectionY, z: intersectionZ }
  }

  // No intersection
  return null
}

function pointLeftOfLine(point: number[], lineStart: number[], lineEnd: number[]): boolean {
  const lineVec = [lineEnd[0] - lineStart[0], lineEnd[1] - lineStart[1]]
  const startToPointVec = [point[0] - lineStart[0], point[1] - lineStart[1]]
  return lineVec[0] * startToPointVec[1] - lineVec[1] * startToPointVec[0] > 0
}

export function intersectWithBbox(featureToIntersect: ExtrudedPolygonFeature, bBox: Box3): ExtrudedPolygonFeature {
  const BUFFER = 0.001
  const bBoxPoints2D: PointXYZ[] = [
    { x: bBox.min.x, y: bBox.min.y },
    { x: bBox.max.x, y: bBox.min.y },
    { x: bBox.max.x, y: bBox.max.y },
    { x: bBox.min.x, y: bBox.max.y },
  ].map((point2D) => ({ ...point2D, z: bBox.min.z }))
  const firstPoint = featureToIntersect.geometry.coordinates[0][0]
  const lastPoint = featureToIntersect.geometry.coordinates[0][featureToIntersect.geometry.coordinates[0].length - 1]
  const coordinatesForOpenPoly = featureToIntersect.geometry.coordinates[0].slice(0, -1)
  if (0 < Math.pow(lastPoint[0] - firstPoint[0], 2) + Math.pow(lastPoint[1] - firstPoint[1], 2))
    coordinatesForOpenPoly.push(lastPoint)

  const intersectedCoordinates = coordinatesForOpenPoly.flatMap((point: number[], index) => {
    const numPoints = coordinatesForOpenPoly.length
    const prevPoint = coordinatesForOpenPoly[(index - 1 + numPoints) % numPoints]
    const nextPoint = coordinatesForOpenPoly[(index + 1) % numPoints]
    const nextNextPoint = coordinatesForOpenPoly[(index + 2) % numPoints]
    const vecLength = Math.sqrt(Math.pow(nextPoint[0] - point[0], 2) + Math.pow(nextPoint[1] - point[1], 2))
    const unitVec = [(nextPoint[0] - point[0]) / vecLength, (nextPoint[1] - point[1]) / vecLength]
    const normalVec = [-unitVec[1], unitVec[0]]
    const intersections: { p: PointXYZ; intoBbox: boolean }[] = bBoxPoints2D.flatMap((bbPoint, bbIndex) => {
      const nextBbPoint = bBoxPoints2D[(bbIndex + 1) % bBoxPoints2D.length]
      const bbNormal = [-(nextBbPoint.y - bbPoint.y), nextBbPoint.x - bbPoint.x]
      const intoBbox = unitVec[0] * bbNormal[0] + unitVec[1] * bbNormal[1] > 0
      const intersection = lineSegmentIntersection(
        bbPoint,
        nextBbPoint,
        { x: point[0], y: point[1] },
        { x: nextPoint[0], y: nextPoint[1] },
      )
      return intersection
        ? [
            intoBbox
              ? {
                  p: {
                    x: intersection.x + BUFFER * unitVec[0],
                    y: intersection.y + BUFFER * unitVec[1],
                    z: intersection.z,
                  },
                  intoBbox,
                }
              : {
                  p: {
                    x: intersection.x - BUFFER * unitVec[0],
                    y: intersection.y - BUFFER * unitVec[1],
                    z: intersection.z,
                  },
                  intoBbox,
                },
          ]
        : []
    })
    const numIntersections = intersections.length
    if (numIntersections == 0) {
      if (point[0] > bBox.max.x || point[0] < bBox.min.x || point[1] > bBox.max.y || point[1] < bBox.min.y) {
        let closestPoint = bBoxPoints2D[0]
        let projectionOntoNormal = normalVec[0] * bBoxPoints2D[0].x + normalVec[1] * bBoxPoints2D[0].y
        let firstPointClosest = true
        bBoxPoints2D.slice(1).forEach((p, i) => {
          const proj = normalVec[0] * p.x + normalVec[1] * p.y
          // Generally we want the first (in the ring) of any two equidistant points
          if (projectionOntoNormal > proj) {
            closestPoint = p
            projectionOntoNormal = proj
            firstPointClosest = false
          }
          // In the special case where the two equidistant points are the first and last (in the array), we need to use the last one
          if (firstPointClosest && projectionOntoNormal == proj && i + 1 == bBoxPoints2D.length - 1) {
            closestPoint = p
            projectionOntoNormal = proj
          }
        })
        if (
          pointLeftOfLine([closestPoint.x, closestPoint.y], prevPoint, point) &&
          pointLeftOfLine([closestPoint.x, closestPoint.y], nextPoint, nextNextPoint)
        ) {
          // Only return the corner of the terrain if it is actually inside the section box
          return [
            [
              closestPoint.x == bBox.min.x ? closestPoint.x + BUFFER : closestPoint.x - BUFFER,
              closestPoint.y == bBox.min.y ? closestPoint.y + BUFFER : closestPoint.y - BUFFER,
            ],
          ]
        }
        return []
      }
      return [coordinatesForOpenPoly[index]]
    }
    if (numIntersections == 1 && !intersections[0].intoBbox)
      return [coordinatesForOpenPoly[index], ...intersections.map((s) => [s.p.x, s.p.y])]
    intersections.sort(
      (a, b) =>
        Math.pow(a.p.x - point[0], 2) +
        Math.pow(a.p.y - point[1], 2) -
        (Math.pow(b.p.x - point[0], 2) + Math.pow(b.p.y - point[1], 2)),
    )
    return [...intersections.map((s) => [s.p.x, s.p.y])]
  })
  return { ...featureToIntersect, geometry: { ...featureToIntersect.geometry, coordinates: [intersectedCoordinates] } }
}

// Check if a 2D point is within the 2D projection of a 3D triangle and if it is, return the 3D point where the 2D point projects onto the plane of the triangle
export function project2DPointOnTriangle(point: PointXY, a: PointXYZ, b: PointXYZ, c: PointXYZ): PointXYZ | null {
  const left_of_ab: boolean = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) > 0
  // If the point is on the left (or right) of _both_ AB and AC then it can't be inside
  if ((c.x - a.x) * (point.y - a.y) - (c.y - a.y) * (point.x - a.x) > 0 == left_of_ab) return null
  // If the point is not on the same side of AB and BC then it is outside, otherwise it is inside
  if ((c.x - b.x) * (point.y - b.y) - (c.y - b.y) * (point.x - b.x) > 0 != left_of_ab) return null

  const normal = [
    (b.y - a.y) * (c.z - b.z) - (b.z - a.z) * (c.y - b.y),
    (b.z - a.z) * (c.x - b.x) - (b.x - a.x) * (c.z - b.z),
    (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x),
  ]

  // Solve equation for the z value that gives the vector a-to-point a zero dot product with triangle normal vector
  const z = (normal[0] * (a.x - point.x) + normal[1] * (a.y - point.y)) / normal[2] + a.z
  return { x: point.x, y: point.y, z }
}

export function lineIntersectsBox(lineStart: PointXY, lineEnd: PointXY, box: Box3) {
  const x0 = lineStart.x,
    y0 = lineStart.y
  const x1 = lineEnd.x,
    y1 = lineEnd.y

  // Delta values
  const dx = x1 - x0
  const dy = y1 - y0

  let t0 = 0 // start parameter (0 means p0)
  let t1 = 1 // end parameter (1 means p1)

  const p = [-dx, dx, -dy, dy] // Clipping against left, right, bottom, top
  const q = [x0 - box.min.x, box.max.x - x0, y0 - box.min.y, box.max.y - y0] // Distance to each boundary

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      // Line is parallel to one of the box boundaries
      if (q[i] < 0) return NOT_INTERSECTED // Parallel and outside the box
    } else {
      const t = q[i] / p[i]
      if (p[i] < 0) {
        t0 = Math.max(t0, t) // Moving the lower bound up
      } else {
        t1 = Math.min(t1, t) // Moving the upper bound down
      }
      if (t0 > t1) return NOT_INTERSECTED // The line doesn't intersect the box
    }
  }
  const isInsideBox = (x: number, y: number) => x >= box.min.x && x <= box.max.x && y >= box.min.y && y <= box.max.y
  const startInside = isInsideBox(x0, y0)
  const endInside = isInsideBox(x1, y1)
  return startInside && endInside ? CONTAINED : INTERSECTED
}

// Intersects the terrain mesh (as a BVH) along a 2D line segment and returns the array of intersection points sorted by their distance from the startpoint
// Assumes that the terrain never folds back on itself, i.e. that there are no points in the xy-plane where the terrain takes on multiple z-values
export function extractTerrainCutPoints(bvh: MeshBVH, startPoint: PointXY, endPoint: PointXY) {
  const intersections: (PointXYZ & { d?: number })[] = []
  // The start and end points of the line can be inside exactly one triangle - keep track of whether we have found them
  let startPointTriangleFound = false
  let endPointTriangleFound = false
  bvh.shapecast({
    intersectsBounds: (box) => {
      return lineIntersectsBox(startPoint, endPoint, box)
    },
    intersectsTriangle: (tri) => {
      ;[
        [tri.a, tri.b],
        [tri.b, tri.c],
        [tri.a, tri.c],
      ].forEach(([a, b]) => {
        // For each of the three lines in the triangle, check if they 2D-intersect with the 2D line segment and return the 3D point corresponding to the intersection
        const intersection: (PointXYZ & { d?: number }) | null = lineSegmentIntersection(a, b, startPoint, endPoint)
        if (intersection) {
          intersection.d = (intersection.x - startPoint.x) ** 2 + (intersection.y - startPoint.y) ** 2
          intersections.push(intersection)
        }
      })

      // Check if the start/end point of the 2D line segment are inside the 2D projection of the triangle, and if so add the corresponding 3D point as an intersection
      if (!startPointTriangleFound) {
        const startInTriangle: (PointXYZ & { d?: number }) | null = project2DPointOnTriangle(
          startPoint,
          tri.a,
          tri.b,
          tri.c,
        )
        if (startInTriangle) {
          startInTriangle.d = 0
          intersections.push(startInTriangle)
          startPointTriangleFound = true
        }
      }
      if (!endPointTriangleFound) {
        const endInTriangle: (PointXYZ & { d?: number }) | null = project2DPointOnTriangle(
          endPoint,
          tri.a,
          tri.b,
          tri.c,
        )
        if (endInTriangle) {
          endInTriangle.d = (endInTriangle.x - startPoint.x) ** 2 + (endInTriangle.y - startPoint.y) ** 2
          intersections.push(endInTriangle)
          endPointTriangleFound = true
        }
      }
    },
  })
  if (!intersections.length) {
    return [new Vector3(startPoint.x, startPoint.y, 0), new Vector3(endPoint.x, endPoint.y, 0)]
  }
  intersections.sort((a, b) => a.d! - b.d!)

  // Filter out duplicate points caused by each mesh line being intersected twice since it is shared by two triangles
  return intersections.filter((p, i) => i == 0 || intersections[i - 1].d != p.d).map((p) => new Vector3(p.x, p.y, p.z))
}

// Checks if a line segment contains a point where the elevation equals a specified number and returns that point if it exists
function findElevationOnLineSegment(startPoint: PointXYZ, endPoint: PointXYZ, elevation: number): PointXYZ | null {
  // Parametrise the line through the start and end points by t, where t=0 is the start point and t=1 is the end point
  const t = (elevation - startPoint.z) / (endPoint.z - startPoint.z)
  if (t < 0 || t > 1) return null // t values outside the interval indicate the sought for point is not on the line segment
  return { x: (1 - t) * startPoint.x + t * endPoint.x, y: (1 - t) * startPoint.y + t * endPoint.y, z: elevation }
}

// Checks if a point is inside a rectangle, assuming positive winding for rectangle
function isPointInsideRect(point: PointXY, withinRectangle: [PointXY, PointXY, PointXY, PointXY]): boolean {
  return (
    pointLeftOfLine(
      [point.x, point.y],
      [withinRectangle[0].x, withinRectangle[0].y],
      [withinRectangle[1].x, withinRectangle[1].y],
    ) &&
    pointLeftOfLine(
      [point.x, point.y],
      [withinRectangle[1].x, withinRectangle[1].y],
      [withinRectangle[2].x, withinRectangle[2].y],
    ) &&
    pointLeftOfLine(
      [point.x, point.y],
      [withinRectangle[2].x, withinRectangle[2].y],
      [withinRectangle[3].x, withinRectangle[3].y],
    ) &&
    pointLeftOfLine(
      [point.x, point.y],
      [withinRectangle[3].x, withinRectangle[3].y],
      [withinRectangle[0].x, withinRectangle[0].y],
    )
  )
}

// Checks if a line segment crosses the boundary of a polygon, and if it does return the first such intersection found
function findLineIntersectionWithPolygon(pointA: PointXYZ, pointB: PointXYZ, polygon: PointXY[]) {
  for (let i = 0; i < polygon.length; i++) {
    const intersection = lineSegmentIntersection(pointA, pointB, polygon[i], polygon[(i + 1) % polygon.length])
    if (intersection) return intersection
  }
  return null
}

// Intersect arbitrary meshes (as BVHs) with a 2D line segment and return line segments corresponding to all the cuts across individual triangles in the mesh
// Only returns such line segments if they are between two specified z-values, and segments crossing those z-value are truncated
export function extractMeshCutLines(
  bvh: MeshBVH,
  startPoint: PointXY,
  endPoint: PointXY,
  elevationMax: number,
  elevationMin: number,
): [Vector3, Vector3][] {
  const cutLineSegments: [Vector3, Vector3][] = []
  bvh.shapecast({
    intersectsBounds: (box) => {
      if (box.min.z > elevationMax || box.max.z < elevationMin) return NOT_INTERSECTED
      return lineIntersectsBox(startPoint, endPoint, box)
    },
    intersectsTriangle: (tri) => {
      const intersections: PointXYZ[] = []
      if (tri.a.z > elevationMax && tri.b.z > elevationMax && tri.c.z > elevationMax) return
      ;[
        [tri.a, tri.b],
        [tri.b, tri.c],
        [tri.a, tri.c],
      ].forEach(([a, b]) => {
        // Check if each side of the triangle intersects the 2D line segment
        const intersection: PointXYZ | null = lineSegmentIntersection(a, b, startPoint, endPoint)
        if (intersection) intersections.push(intersection)
      })

      // Check if the start/end point of the 2D line segment are inside the 2D projection of the triangle, and if so add the corresponding 3D point as an intersection
      const startInTriangle: (PointXYZ & { d?: number }) | null = project2DPointOnTriangle(
        startPoint,
        tri.a,
        tri.b,
        tri.c,
      )
      if (startInTriangle) {
        startInTriangle.d = 0
        intersections.push(startInTriangle)
      }
      const endInTriangle: (PointXYZ & { d?: number }) | null = project2DPointOnTriangle(endPoint, tri.a, tri.b, tri.c)
      if (endInTriangle) {
        endInTriangle.d = (endInTriangle.x - startPoint.x) ** 2 + (endInTriangle.y - startPoint.y) ** 2
        intersections.push(endInTriangle)
      }
      // If any triangle is intersected twice, that means we have a cut across a triangle that we want a line segment for
      if (intersections.length === 2) {
        let pointA = intersections[0]
        let pointB = intersections[1]
        // Check if either point is outside the z-values we want to stay between
        const pointAInside = pointA.z <= elevationMax && pointA.z >= elevationMin
        const pointBInside = pointB.z <= elevationMax && pointB.z >= elevationMin
        // If at least one point is inside we want to return a line segment
        if (pointAInside || pointBInside) {
          // If one point is outside, we want to replace that point by the intersection of the line segment with the relevant z-value
          if (!(pointAInside && pointBInside)) {
            let newPoint = findElevationOnLineSegment(pointA, pointB, elevationMax)
            if (!newPoint) newPoint = findElevationOnLineSegment(pointA, pointB, elevationMin)
            if (!newPoint) {
              console.warn("Calculation error - this indicates a bug in the section box intersection code")
            } else {
              if (pointBInside) pointA = newPoint
              if (pointAInside) pointB = newPoint
            }
          }
          cutLineSegments.push([new Vector3(pointA.x, pointA.y, pointA.z), new Vector3(pointB.x, pointB.y, pointB.z)])
        }
      }
    },
  })
  return cutLineSegments
}

// Intersects a mesh (with a bounding volume hierarchy) at a certain z-value and returns line segments corresponding to all the cuts across individual triangles in the mesh
// Only returns such line segments if they are within a specified rectangle, and segments crossing rectangle boundary are truncated
export function extractMeshHorizontalCutLines(
  bvh: MeshBVH,
  cutElevation: number,
  withinRectangle: [PointXY, PointXY, PointXY, PointXY],
): [Vector3, Vector3][] {
  const cutLineSegments: [Vector3, Vector3][] = []
  bvh.shapecast({
    intersectsBounds: (box) => {
      // TODO: expand check to also test if box is within polygon
      if (box.min.z > cutElevation) return NOT_INTERSECTED
      if (box.max.z < cutElevation) return NOT_INTERSECTED
      if (box.min.z < cutElevation && box.max.z > cutElevation) return CONTAINED
      return INTERSECTED
    },
    intersectsTriangle: (tri) => {
      const intersections: PointXYZ[] = []
      ;[
        [tri.a, tri.b],
        [tri.b, tri.c],
        [tri.a, tri.c],
      ].forEach(([a, b]) => {
        // Check if each side of the triangle crosses the z-value we care about
        const intersection: PointXYZ | null = findElevationOnLineSegment(a, b, cutElevation)
        if (intersection) intersections.push(intersection)
      })

      // If any triangle is intersected twice, that means we have a cut across a triangle that we want a line segment for
      if (intersections.length === 2) {
        let pointA = intersections[0]
        let pointB = intersections[1]
        // Check if either point is outside the rectangle we want to stay within
        const pointAInside = isPointInsideRect(pointA, withinRectangle)
        const pointBInside = isPointInsideRect(pointB, withinRectangle)
        // If at least one point is inside we want to return a line segment
        //  TODO: this neglects the case where the line segment starts and ends outside the polygon but still crosses it
        if (pointAInside || pointBInside) {
          // If one point is outside, we want to replace that point by the intersection of the line segment with the rectangle
          if (!(pointAInside && pointBInside)) {
            const crossingPoint = findLineIntersectionWithPolygon(pointA, pointB, withinRectangle)
            if (!crossingPoint)
              console.warn("Calculation error - this indicates a bug in the section box intersection code")
            else {
              if (pointAInside) pointB = crossingPoint
              if (pointBInside) pointA = crossingPoint
            }
          }
          cutLineSegments.push([new Vector3(pointA.x, pointA.y, pointA.z), new Vector3(pointB.x, pointB.y, pointB.z)])
        }
      }
    },
  })
  return cutLineSegments
}
