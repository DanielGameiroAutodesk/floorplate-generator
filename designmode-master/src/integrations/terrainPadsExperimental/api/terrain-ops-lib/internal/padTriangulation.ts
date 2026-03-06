import { mapLoopsEdgesToXIntervals, isPointInsideMappedEdgesPolygon } from "./mapPolygonEdges"
import { runConstrainedDelaunay } from "./delaunator"
import { calculateTriangleCentroid2d, type Vec3 } from "./utils"

function buildConstrainedEdges(
  constrainedInteriorLineStringsIdxes: number[][],
  boundaryEdges: [number, number][],
  interiorPointsOffset: number,
) {
  const constrainedEdges: [number, number][] = []
  boundaryEdges.forEach((edge) => {
    constrainedEdges.push(edge)
  })

  const constrainedLineStringSegments: [number, number][] = constrainLineStringsSegments(
    constrainedInteriorLineStringsIdxes,
  )

  constrainedLineStringSegments.forEach((edge) => {
    constrainedEdges.push([edge[0] + interiorPointsOffset, edge[1] + interiorPointsOffset])
  })
  return constrainedEdges
}

function constrainLineStringsSegments(lineStringIndices: number[][]) {
  const constrainedLineStringSegments: [number, number][] = []
  let count = 0
  for (let poly of lineStringIndices) {
    for (let i = 0; i < poly.length - 1; i++) {
      if (poly[i] === poly[(i + 1) % poly.length]) {
        count++
        console.warn("found duplicate indices", count)
        continue
      }
      constrainedLineStringSegments.push([poly[i], poly[(i + 1) % poly.length]])
    }
  }
  return constrainedLineStringSegments
}

function extractEdgesFromBaseGeo(edgesIndex: [number, number][], baseGeometryPositions: Float32Array) {
  const extractedBoundaryVertices: [number, number, number][] = []
  const vertexToIdxMap = new Map<string, number>()
  let addedVertexCount = 0
  const edgesLocal: [number, number][] = []
  edgesIndex.forEach((edge) => {
    const newEdge: number[] = []
    edge.forEach((idx) => {
      const vertex = [
        baseGeometryPositions[idx * 3],
        baseGeometryPositions[idx * 3 + 1],
        baseGeometryPositions[idx * 3 + 2],
      ] as [number, number, number]
      const key = vertex.slice(0, 2).join("_")
      if (!vertexToIdxMap.has(key)) {
        newEdge.push(addedVertexCount)
        vertexToIdxMap.set(key, addedVertexCount++)
        extractedBoundaryVertices.push(vertex)
      } else {
        newEdge.push(vertexToIdxMap.get(key)!)
      }
    })
    edgesLocal.push(newEdge as [number, number])
  })
  return { extractedBoundaryVertices, edgesLocal }
}

export function filterTrianglesOutsideEdges(
  boundaryEdgesIndex: [number, number][],
  points: [number, number, number][],
  index: Uint32Array,
  isBoundaryPoint: (idx: number) => boolean,
) {
  const trianglesInsideBoundaryIndex = []
  const boundaryPointEdges2d: [[number, number], [number, number]][] = boundaryEdgesIndex.map((edge) => {
    const p1 = points[edge[0]]
    const p2 = points[edge[1]]
    return [
      [p1[0], p1[1]],
      [p2[0], p2[1]],
    ]
  })
  const edgesMapped = mapLoopsEdgesToXIntervals(boundaryPointEdges2d)
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]
    const b = index[i + 1]
    const c = index[i + 2]
    // if all three points are boundary points, triangle might be outside the boundary
    if (isBoundaryPoint(a) && isBoundaryPoint(b) && isBoundaryPoint(c)) {
      const centroid = calculateTriangleCentroid2d(points[a], points[b], points[c])
      const inside = isPointInsideMappedEdgesPolygon(centroid, edgesMapped)
      if (inside) {
        trianglesInsideBoundaryIndex.push(a, b, c)
      }
    } else {
      trianglesInsideBoundaryIndex.push(a, b, c)
    }
  }
  return trianglesInsideBoundaryIndex
}

export function triangulatePadAreas(
  padPolygons: { polygons: number[][]; points: Vec3[] },
  boundaryEdgesIndex: [number, number][],
  baseGeometryPositions: Float32Array,
) {
  const { extractedBoundaryVertices, edgesLocal: boundaryEdgesLocal } = extractEdgesFromBaseGeo(
    boundaryEdgesIndex,
    baseGeometryPositions,
  )
  const polygonPoints: [number, number, number][] = padPolygons.points.map((p) => [p.x, p.y, p.z])
  const meshVertices = [...extractedBoundaryVertices, ...polygonPoints]

  const interiorPointsOffset = extractedBoundaryVertices.length
  const constrainedEdges = buildConstrainedEdges(padPolygons.polygons, boundaryEdgesLocal, interiorPointsOffset)

  let index
  try {
    index = runConstrainedDelaunay(meshVertices, constrainedEdges)
  } catch (e) {
    console.warn("Error running constrained delaunay triangulation in triangulatePadAreas", e)
    index = runConstrainedDelaunay(meshVertices, [])
  }

  const isPointIdxOnBoundary = (idx: number) => idx < interiorPointsOffset
  // Delaunay triangulates convex hull of the points, so we need to filter out triangles that are outside the boundary edges
  const filteredIndices = filterTrianglesOutsideEdges(boundaryEdgesLocal, meshVertices, index, isPointIdxOnBoundary)

  return { indices: filteredIndices, vertices: meshVertices }
}
