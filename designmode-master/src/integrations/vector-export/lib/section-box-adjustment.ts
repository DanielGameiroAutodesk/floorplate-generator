import { type BufferGeometry, Line3, Plane, Triangle, Vector3 } from "three"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { lineSegmentIntersection } from "src/integrations/section-box/rendering/utilities/extractCutGeometries"
import { buildBufferGeometryFromTriangles, extractTrianglesFromBufferGeometry } from "./bufferGeometryHelpers"

type PointXY = { x: number; y: number }
type PointXYZ = { x: number; y: number; z: number }

export function trimGeometryWithSectionBox(geo: BufferGeometry, sectionBox: ExtrudedPolygonFeature): BufferGeometry {
  let allTriangles = extractTrianglesFromBufferGeometry(geo)

  // Create planes for all 6 sides of section box, normals pointing _into_ box
  const topZ = new Plane(new Vector3(0, 0, -1), sectionBox.properties.elevation + sectionBox.properties.height)
  const bottomZ = new Plane(new Vector3(0, 0, 1), -sectionBox.properties.elevation)
  const rectangle = sectionBox.geometry.coordinates[0].slice(1)
  const sides = rectangle.map((p, i) => {
    const p2 = rectangle[(i + 1) % rectangle.length]
    const vec = new Vector3(p2[0] - p[0], p2[1] - p[1], 0)
    const normal = new Vector3(-vec.y, vec.x, 0).normalize()
    const distance = p[0] * normal.x + p[1] * normal.y
    return new Plane(normal, -distance)
  })
  // For each plane, cut all intersected triangles and remote triangles on wrong side of plane
  const planes = [topZ, bottomZ, ...sides]
  planes.forEach((plane) => {
    allTriangles = allTriangles.flatMap((tri) => {
      const inside = []
      const outside = []
      if (tri.a.dot(plane.normal) < -plane.constant) outside.push("a")
      else inside.push("a")
      if (tri.b.dot(plane.normal) < -plane.constant) outside.push("b")
      else inside.push("b")
      if (tri.c.dot(plane.normal) < -plane.constant) outside.push("c")
      else inside.push("c")
      if (inside.length === 1) {
        const insidePoint = inside[0] === "a" ? tri.a : inside[0] === "b" ? tri.b : tri.c
        const outsidePoint1 = inside[0] === "a" ? tri.b : inside[0] === "b" ? tri.c : tri.a
        const outsidePoint2 = inside[0] === "a" ? tri.c : inside[0] === "b" ? tri.a : tri.b
        const intersection1 = plane.intersectLine(new Line3(insidePoint, outsidePoint1), new Vector3())
        const intersection2 = plane.intersectLine(new Line3(insidePoint, outsidePoint2), new Vector3())
        return intersection1 && intersection2 ? [new Triangle(insidePoint, intersection1, intersection2)] : []
      }
      if (inside.length === 2) {
        const outsidePoint = outside[0] === "a" ? tri.a : outside[0] === "b" ? tri.b : tri.c
        const insidePoint1 = outside[0] === "a" ? tri.b : outside[0] === "b" ? tri.c : tri.a
        const insidePoint2 = outside[0] === "a" ? tri.c : outside[0] === "b" ? tri.a : tri.b
        const intersection1 = plane.intersectLine(new Line3(outsidePoint, insidePoint1), new Vector3())
        const intersection2 = plane.intersectLine(new Line3(outsidePoint, insidePoint2), new Vector3())
        return intersection1 && intersection2
          ? [
              new Triangle(insidePoint1, insidePoint2, intersection2),
              new Triangle(intersection2, intersection1, insidePoint1),
            ]
          : []
      }
      if (inside.length === 3) return [tri]

      return []
    })
  })
  return buildBufferGeometryFromTriangles(allTriangles)
}

function findLineIntersectionsWithPolygon(pointA: PointXYZ, pointB: PointXYZ, polygon: PointXY[]) {
  const intersections: PointXYZ[] = []
  for (let i = 0; i < polygon.length; i++) {
    const intersection = lineSegmentIntersection(pointA, pointB, polygon[i], polygon[(i + 1) % polygon.length])
    if (intersection) intersections.push(intersection)
  }
  return intersections
}

function pointLeftOfLine(point: PointXY, lineStart: PointXY, lineEnd: PointXY): boolean {
  const lineVec = { x: lineEnd.x - lineStart.x, y: lineEnd.y - lineStart.y }
  const startToPointVec = { x: point.x - lineStart.x, y: point.y - lineStart.y }
  return lineVec.x * startToPointVec.y - lineVec.y * startToPointVec.x > 0
}

export function trimEdgeWithSectionBox(edge: Line3, sectionBox: ExtrudedPolygonFeature): Line3 | null {
  let start = edge.start.clone()
  let end = edge.end.clone()
  const minZ = sectionBox.properties.elevation
  const maxZ = sectionBox.properties.elevation + sectionBox.properties.height
  if (start.z > maxZ && end.z > maxZ) return null
  if (start.z < minZ && end.z < minZ) return null
  if (end.z > maxZ) {
    const t = (maxZ - start.z) / (end.z - start.z)
    end = new Vector3((1 - t) * start.x + t * end.x, (1 - t) * start.y + t * end.y, (1 - t) * start.z + t * end.z)
  }
  if (end.z < minZ) {
    const t = (minZ - start.z) / (end.z - start.z)
    end = new Vector3((1 - t) * start.x + t * end.x, (1 - t) * start.y + t * end.y, (1 - t) * start.z + t * end.z)
  }
  if (start.z > maxZ) {
    const t = (maxZ - start.z) / (end.z - start.z)
    start = new Vector3((1 - t) * start.x + t * end.x, (1 - t) * start.y + t * end.y, (1 - t) * start.z + t * end.z)
  }
  if (start.z < minZ) {
    const t = (minZ - start.z) / (end.z - start.z)
    start = new Vector3((1 - t) * start.x + t * end.x, (1 - t) * start.y + t * end.y, (1 - t) * start.z + t * end.z)
  }

  const polygonXY = sectionBox.geometry.coordinates[0].slice(1).map((p) => ({ x: p[0], y: p[1] }))
  // Check if points are inside, assuming the polygon has positive winding
  const startInsidePoly = !polygonXY.some((p, i) => !pointLeftOfLine(start, p, polygonXY[(i + 1) % polygonXY.length]))
  const endInsidePoly = !polygonXY.some((p, i) => !pointLeftOfLine(end, p, polygonXY[(i + 1) % polygonXY.length]))
  if (!startInsidePoly || !endInsidePoly) {
    const intersections2D = findLineIntersectionsWithPolygon(start, end, polygonXY)
    if (intersections2D.length === 2) {
      const pointA = new Vector3(intersections2D[0].x, intersections2D[0].y, intersections2D[0].z)
      const pointB = new Vector3(intersections2D[1].x, intersections2D[1].y, intersections2D[1].z)
      return new Line3(pointA, pointB)
    } else if (intersections2D.length === 1) {
      const pointA = new Vector3(intersections2D[0].x, intersections2D[0].y, intersections2D[0].z)
      if (!startInsidePoly) return new Line3(pointA, end)
      return new Line3(start, pointA)
    }
    return null
  }
  // If both points are inside return original line, since we know the polygon is a rectangle and hence convex
  return new Line3(start, end)
}
