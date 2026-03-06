import {
  addVectorToPoint,
  determinant,
  getVectorFromPointToPoint,
  normalizeVector,
  pointPointDistance,
  scale,
} from "./geometry.js"
import { v4 as uuidv4 } from "uuid"

const PRECISION = 0.01

function updateGraphWithReplacingVertexID(graph, edgeValues, oldVertexID, newVertexID) {
  edgeValues.forEach((e) => {
    if (e.start === oldVertexID) {
      graph.edges[e.id].start = newVertexID
    }
    if (e.end === oldVertexID) {
      graph.edges[e.id].end = newVertexID
    }
  })
  delete graph.vertices[oldVertexID]
  return graph
}

function vertexVertexDistance(v1, v2) {
  return pointPointDistance([v1.x, v1.y], [v2.x, v2.y])
}

function getEdgePoints(edge, vertices) {
  const p1 = [vertices[edge.start].x, vertices[edge.start].y]
  const p2 = [vertices[edge.end].x, vertices[edge.end].y]
  return [p1, p2]
}

function foundVerticesToVerticesEdges(foundVertices, start, end, edgeProps, tolerance = 0.00001) {
  const p = [start.x, start.y]
  const uniqueVertices = [...new Set(foundVertices).values()]
  const filtered = uniqueVertices.filter(
    (v) => vertexVertexDistance(v, start) > tolerance && vertexVertexDistance(v, end) > tolerance,
  )
  const sorted = filtered.sort(function (a, b) {
    return pointPointDistance([a.x, a.y], p) - pointPointDistance([b.x, b.y], p)
  })
  sorted.unshift(start)
  sorted.push(end)
  let edgesOut = {}
  for (let i = 0; i < sorted.length - 1; i++) {
    const id = uuidv4()
    edgesOut[id] = { id: id, start: sorted[i].id, end: sorted[i + 1].id, ...edgeProps }
  }
  return edgesOut
}

function rowColumnToFlatIndex(upper, lower, n) {
  //ref: https://stackoverflow.com/questions/27086195/linear-index-upper-triangular-matrix
  const i = Math.min(upper, lower)
  const j = Math.max(upper, lower)
  return (n * (n - 1)) / 2 - ((n - i) * (n - i - 1)) / 2 + j - i - 1
}

export function isPointBetweenTwoPoints(point1, point2, pointToCheck, tolerance) {
  const dist = pointPointDistance(point1, point2)
  if (pointPointDistance(point1, pointToCheck) < tolerance || pointPointDistance(point2, pointToCheck) < tolerance)
    return false
  let res = Math.abs(pointPointDistance(pointToCheck, point1) + pointPointDistance(pointToCheck, point2))
  return res < dist + tolerance
}

function reconstructEdges(edgesToIntersections, edges, vertices) {
  const edgesValues = Object.values(edges)
  const n = edgesValues.length
  let edgesNew = {}
  for (let i = 0; i < n; i++) {
    const currentEdge = edgesValues[i]
    const p1 = vertices[currentEdge.start]
    const p2 = vertices[currentEdge.end]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { start, end, id, ...edgeProps } = currentEdge
    let inters = []
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const k = rowColumnToFlatIndex(i, j, n)
      const inter = edgesToIntersections[k]

      if (inter) {
        inters.push(inter)
      }
    }
    Object.entries(foundVerticesToVerticesEdges(inters, p1, p2, edgeProps)).forEach(([k, v]) => {
      edgesNew[k] = v
    })
  }
  return edgesNew
}

function getIntersectionVertexIfAny(ei, ej, vertices) {
  const e1 = getEdgePoints(ei, vertices)
  const e2 = getEdgePoints(ej, vertices)

  const res = customIntersection(e1[0], e1[1], e2[0], e2[1])
  if (!res) {
    return null
  }
  const { t, u, intersectionPoint } = res
  const tolerance = 0.00000001
  if (t < -tolerance || u < -tolerance || t > 1 + tolerance || u > 1 + tolerance) {
    return null
  }
  if (Math.abs(t) <= tolerance) return vertices[ei.start]

  if (Math.abs(t - 1) <= tolerance) return vertices[ei.end]

  if (Math.abs(u) <= tolerance) return vertices[ej.start]

  if (Math.abs(u - 1) <= tolerance) return vertices[ej.end]

  if (t > -tolerance && u > -tolerance && t < 1 + tolerance && u < 1 + tolerance) {
    return { id: uuidv4(), x: intersectionPoint[0], y: intersectionPoint[1] }
  }
  return null
}

function edgesOverlap(ei, ej, vertices, tol) {
  const e1 = getEdgePoints(ei, vertices)
  const e2 = getEdgePoints(ej, vertices)
  const edgesParallel = areLinesParallel(e1[0], e1[1], e2[0], e2[1])
  let overlaps = [[], []]
  if (!edgesParallel) return overlaps
  if (isPointBetweenTwoPoints(e1[0], e1[1], e2[0], tol)) {
    overlaps[0].push(ej.start)
  }
  if (isPointBetweenTwoPoints(e1[0], e1[1], e2[1], tol)) {
    overlaps[0].push(ej.end)
  }
  if (isPointBetweenTwoPoints(e2[0], e2[1], e1[0], tol)) {
    overlaps[1].push(ei.start)
  }
  if (isPointBetweenTwoPoints(e2[0], e2[1], e1[1], tol)) {
    overlaps[1].push(ei.end)
  }
  return overlaps
}

function updateEdgesToIntersectionsMap(i, j, n, edgesValues, vertices, edgesToIntersections) {
  const k = rowColumnToFlatIndex(i, j, n)
  const newVertex = getIntersectionVertexIfAny(edgesValues[i], edgesValues[j], vertices)
  if (newVertex) {
    vertices[newVertex.id] = newVertex
    edgesToIntersections[k] = newVertex
  }
}

function getIntersectionMap(graph) {
  const edgeValues = Object.values(graph.edges)
  const numEdges = edgeValues.length
  let edgesToIntersectionsMap = new Array((numEdges * (numEdges - 1)) / 2) //Number of pairs between n items
  for (let i = 0; i < numEdges; i++) {
    for (let j = i + 1; j < numEdges; j++) {
      updateEdgesToIntersectionsMap(i, j, numEdges, edgeValues, graph.vertices, edgesToIntersectionsMap)
    }
  }
  return edgesToIntersectionsMap
}

function handlePartiallyOverlappingEdges(graph, precision) {
  const edgeValues = Object.values(graph.edges)
  const numEdges = edgeValues.length
  let newEdges = {}
  let parallelIntersectionMap = new Array(numEdges).fill([])
  for (let i = 0; i < numEdges; i++) {
    for (let j = i + 1; j < numEdges; j++) {
      const [overlap_i, overlap_j] = edgesOverlap(edgeValues[i], edgeValues[j], graph.vertices, precision)
      parallelIntersectionMap[i] = parallelIntersectionMap[i].concat(overlap_i)
      parallelIntersectionMap[j] = parallelIntersectionMap[j].concat(overlap_j)
    }
    if (parallelIntersectionMap[i].length > 0) {
      const verticesAtParallelIntersection = parallelIntersectionMap[i].map((id) => graph.vertices[id])
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { start, end, id, ...edgeProps } = edgeValues[i]
      const edgesOut = foundVerticesToVerticesEdges(
        verticesAtParallelIntersection,
        graph.vertices[edgeValues[i].start],
        graph.vertices[edgeValues[i].end],
        edgeProps,
      )
      newEdges = { ...newEdges, ...edgesOut }
    } else {
      newEdges[edgeValues[i].id] = edgeValues[i]
    }
  }
  return {
    edges: removeDuplicateEdgesByValue(newEdges),
    vertices: graph.vertices,
  }
}

function removeDuplicateEdgesByValue(edges) {
  const filtered = Object.values(edges).reduce(function (acc, cur) {
    const id = cur.start < cur.end ? cur.start + cur.end : cur.end + cur.start
    acc[id] = cur
    return acc
  }, {})
  return Object.values(filtered).reduce(function (acc, cur) {
    acc[cur.id] = cur
    return acc
  }, {})
}

function customIntersection(s1_start, s1_end, s2_start, s2_end) {
  const v1 = getVectorFromPointToPoint(s1_end, s1_start)
  const v2 = getVectorFromPointToPoint(s2_start, s2_end)
  const v3 = getVectorFromPointToPoint(s2_start, s1_start)
  const normalizedDeterminant = determinant(normalizeVector(v1), normalizeVector(v2))
  if (Math.abs(normalizedDeterminant) < 0.0001) {
    return null
  }
  const d = determinant(v1, v2)
  const t = determinant(v3, v2) / d
  const u = determinant(v1, v3) / d
  const intersectionPoint = addVectorToPoint(s1_start, scale(getVectorFromPointToPoint(s1_start, s1_end), t))
  return { t, u, intersectionPoint }
}

function areLinesParallel(s1_start, s1_end, s2_start, s2_end) {
  const v1 = getVectorFromPointToPoint(s1_end, s1_start)
  const v2 = getVectorFromPointToPoint(s2_start, s2_end)
  const normalizedDeterminant = determinant(normalizeVector(v1), normalizeVector(v2))
  return Math.abs(normalizedDeterminant) < 0.0001
}

function removeDuplicateVertices(graph, precision) {
  let mergedGraph = graph
  const vertexValues = Object.values(mergedGraph.vertices)
  const edgeValues = Object.values(mergedGraph.edges)
  const n = vertexValues.length

  for (let i = 0; i < n; i++) {
    const v1 = vertexValues[i]
    for (let j = i + 1; j < n; j++) {
      const v2 = vertexValues[j]
      if (vertexVertexDistance(v1, v2) <= precision) {
        mergedGraph = updateGraphWithReplacingVertexID(mergedGraph, edgeValues, v1.id, v2.id)
      }
    }
  }
  return mergedGraph
}

function removeZeroLengthEdges(edges) {
  return Object.values(edges).reduce((acc, e) => {
    if (e.start !== e.end) acc[e.id] = e
    return acc
  }, {})
}

function removeVerticesWithoutConnectedEdges(graph) {
  const edgeForVertex = Object.values(graph.edges).reduce((acc, e) => {
    if (!acc[e.start]) acc[e.start] = e.id
    if (!acc[e.end]) acc[e.end] = e.id
    return acc
  }, {})

  const filteredVertices = Object.values(graph.vertices).reduce((acc, v) => {
    if (edgeForVertex[v.id]) acc[v.id] = v
    return acc
  }, {})
  return { edges: graph.edges, vertices: filteredVertices }
}

function removeRedundantVerticesAndEdges(graph, precision) {
  const graphWithoutDuplicateVertices = removeDuplicateVertices(graph, precision)
  const edgesWithoutZeroLength = removeZeroLengthEdges(graphWithoutDuplicateVertices.edges)
  const edgesWithoutDuplicates = removeDuplicateEdgesByValue(edgesWithoutZeroLength)
  return removeVerticesWithoutConnectedEdges({
    vertices: graphWithoutDuplicateVertices.vertices,
    edges: edgesWithoutDuplicates,
  })
}

export function getGraphIntersectedWithSelf(graph, precision = PRECISION) {
  const graphWithoutOverlappingEdges = handlePartiallyOverlappingEdges(graph, precision)
  const edgesToIntersectionsMap = getIntersectionMap(graphWithoutOverlappingEdges)
  const edgesAfterIntersection = reconstructEdges(
    edgesToIntersectionsMap,
    graphWithoutOverlappingEdges.edges,
    graphWithoutOverlappingEdges.vertices,
  )
  return removeRedundantVerticesAndEdges(
    {
      vertices: graphWithoutOverlappingEdges.vertices,
      edges: edgesAfterIntersection,
    },
    precision,
  )
}
