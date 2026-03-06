import Flatbush from "flatbush"
import { Box3, Vector3, type Intersection } from "three"
import type { ExtendedTriangle, MeshBVH } from "three-mesh-bvh"
import { isPointInsideMappedEdgesPolygon, mapPolygonEdgesToXIntervals } from "./mapPolygonEdges"
import { doEdgesIntersect } from "./doEdgesIntersect"

export function getPolygonsOverlapMasks(
  baseGeoIndicies: Uint32Array,
  baseGeoPositions: Float32Array,
  polygons: [number, number, number][][],
  terrainBbox: Box3,
  baseBvh: MeshBVH,
  intersectBaseGeometry: (origin: Vector3, direction: Vector3) => Intersection[],
) {
  const trianglesMask = new Array(baseGeoIndicies.length / 3).fill(false)
  const pointsMask: boolean[] = new Array(baseGeoPositions.length / 3).fill(false)
  polygons.forEach((polygon) => {
    const box = getVerticesInPolygonBbox(polygon, terrainBbox)
    trianglesAndPointsOverlappingPolygon(box, baseBvh, polygon, trianglesMask, pointsMask, intersectBaseGeometry)
  })
  return { trianglesMask, pointsMask }
}

function trianglesAndPointsOverlappingPolygon(
  box: Box3,
  bvh: MeshBVH,
  polygonVertices: [number, number, number][],
  trianglesMaskMutableOutput: boolean[],
  pointsMaskMutableOutput: boolean[],
  getRayIntersections: (origin: Vector3, direction: Vector3) => Intersection[],
) {
  const baseGeoPositions = bvh.geometry.attributes.position.array
  const baseGeoIndicies = bvh.geometry.index!.array as Uint32Array
  const edgeMap = mapPolygonEdgesToXIntervals(polygonVertices.map((p) => ({ x: p[0], y: p[1], z: p[2] })))

  const edges = edgeMap.edges
  const index = createEdgesIndex(edges)

  const pointInsideMap = new Map<number, boolean>()
  const checkPointInside = (idx: number) => {
    if (pointInsideMap.has(idx)) return pointInsideMap.get(idx)!
    const x = baseGeoPositions[idx * 3]
    const y = baseGeoPositions[idx * 3 + 1]
    const inside = isPointInsideMappedEdgesPolygon([x, y], edgeMap)
    pointInsideMap.set(idx, inside)
    return inside
  }

  let foundIntersections = false
  bvh.shapecast({
    intersectsBounds: (tBox) => box.intersectsBox(tBox),
    intersectsTriangle: (tri: ExtendedTriangle, idx: number) => {
      const [a, b, c] = baseGeoIndicies.slice(idx * 3, idx * 3 + 3)
      const aInside = checkPointInside(a)
      const bInside = checkPointInside(b)
      const cInside = checkPointInside(c)

      if (aInside) pointsMaskMutableOutput[a] = true
      if (bInside) pointsMaskMutableOutput[b] = true
      if (cInside) pointsMaskMutableOutput[c] = true

      if (aInside || bInside || cInside) {
        trianglesMaskMutableOutput[idx] = true
        foundIntersections = true
      } else {
        const minX = Math.min(tri.a.x, tri.b.x, tri.c.x)
        const minY = Math.min(tri.a.y, tri.b.y, tri.c.y)
        const maxX = Math.max(tri.a.x, tri.b.x, tri.c.x)
        const maxY = Math.max(tri.a.y, tri.b.y, tri.c.y)
        const found = index.search(minX, minY, maxX, maxY)
        if (found.length > 0) {
          const triEdges = [
            [tri.a, tri.b],
            [tri.b, tri.c],
            [tri.c, tri.a],
          ]
          for (const edgeIdx of found) {
            const edge = edges[edgeIdx]
            let intersects = false
            for (const triEdge of triEdges) {
              if (
                doEdgesIntersect(
                  edge[0][0],
                  edge[0][1],
                  edge[1][0],
                  edge[1][1],
                  triEdge[0].x,
                  triEdge[0].y,
                  triEdge[1].x,
                  triEdge[1].y,
                )
              ) {
                intersects = true
                trianglesMaskMutableOutput[idx] = true
                break
              }
            }
            if (intersects) {
              foundIntersections = true
              break
            }
          }
        }
      }
      // Always continue traversal
      return false
    },
  })
  // If no intersections found, raycast to find containing triangle
  if (!foundIntersections) {
    maskContainingTriangle(polygonVertices, box.max.z, getRayIntersections, trianglesMaskMutableOutput)
  }
}

function maskContainingTriangle(
  polygonVertices: [number, number, number][],
  maxZ: number,
  getRayIntersections: (origin: Vector3, direction: Vector3) => Intersection[],
  trianglesMaskMutableOutput: boolean[],
) {
  const origin = new Vector3(polygonVertices[0][0], polygonVertices[0][1], maxZ + 1)
  const direction = new Vector3(0, 0, -1)
  const intersections = getRayIntersections(origin, direction)
  if (intersections.length > 0) {
    const idx = intersections[0].faceIndex!
    trianglesMaskMutableOutput[idx] = true
  } else {
    console.warn("No intersections found for polygon", polygonVertices)
  }
}

function createEdgesIndex(edges: [[number, number], [number, number]][]) {
  const index = new Flatbush(edges.length)
  edges.forEach(([p1, p2]) => {
    const minX = Math.min(p1[0], p2[0])
    const minY = Math.min(p1[1], p2[1])
    const maxX = Math.max(p1[0], p2[0])
    const maxY = Math.max(p1[1], p2[1])
    index.add(minX, minY, maxX, maxY)
  })
  index.finish()
  return index
}

function getVerticesInPolygonBbox(polygon: [number, number, number][], verticesBbox: Box3) {
  const cx = polygon.map((c) => c[0])
  const cy = polygon.map((c) => c[1])
  const minX = cx.reduce((a, b) => Math.min(a, b), Infinity)
  const minY = cy.reduce((a, b) => Math.min(a, b), Infinity)
  const minZ = verticesBbox.min.z
  const maxX = cx.reduce((a, b) => Math.max(a, b), -Infinity)
  const maxY = cy.reduce((a, b) => Math.max(a, b), -Infinity)
  const maxZ = verticesBbox.max.z
  const box = new Box3(new Vector3(minX, minY, minZ), new Vector3(maxX, maxY, maxZ))
  return box
}
