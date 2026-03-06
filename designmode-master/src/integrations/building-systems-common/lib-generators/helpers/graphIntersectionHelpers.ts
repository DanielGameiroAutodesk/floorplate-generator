// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  addVectorToPoint,
  determinant,
  getVectorFromPointToPoint,
  normalizeVector,
  pointPointDistance,
  scale,
} from "./geometry"
// import { v4 as uuidv4 } from "uuid";
import { generateId as uuidv4 } from "./uuidTemp"

const PRECISION = 0.01

export function getEdgePoints(edge, vertices) {
  const p1 = [vertices[edge.start].x, vertices[edge.start].y]
  const p2 = [vertices[edge.end].x, vertices[edge.end].y]
  return [p1, p2]
}

function vertexVertexDistance(v1, v2) {
  return pointPointDistance([v1.x, v1.y], [v2.x, v2.y])
}

function foundVerticesToVerticesEdges(foundVertices, start, end, width, tolerance = 0.00001) {
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
    edgesOut[id] = {
      id: id,
      start: sorted[i].id,
      end: sorted[i + 1].id,
      width: width,
    }
  }
  return edgesOut
}

function rowColumnToFlatIndex(upper, lower, n) {
  //ref: https://stackoverflow.com/questions/27086195/linear-index-upper-triangular-matrix
  const i = Math.min(upper, lower)
  const j = Math.max(upper, lower)
  const k = (n * (n - 1)) / 2 - ((n - i) * (n - i - 1)) / 2 + j - i - 1
  return k
}

function isPointBetweenTwoPoints(point1, point2, pointToCheck, tolerance) {
  const dist = pointPointDistance(point1, point2)
  if (pointPointDistance(point1, pointToCheck) < tolerance || pointPointDistance(point2, pointToCheck) < tolerance)
    return false
  let res = Math.abs(pointPointDistance(pointToCheck, point1) + pointPointDistance(pointToCheck, point2))
  return res < dist + tolerance
}

function reconstructEdges(edgesToIntersections, edges, vertices, edgesToIntersectIds, width) {
  const edgesValues = Object.values(edges)
  const n = edgesValues.length
  let edgesNew = {}
  for (let i = 0; i < n; i++) {
    const currentEdge = edgesValues[i]
    const p1 = vertices[currentEdge.start]
    const p2 = vertices[currentEdge.end]
    let inters = []
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const k = rowColumnToFlatIndex(i, j, n)
      const inter = edgesToIntersections[k]

      if (inter) {
        inters.push(inter)
      }
    }
    Object.entries(foundVerticesToVerticesEdges(inters, p1, p2, currentEdge.width || width)).forEach(([k, v]) => {
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
  if (Math.abs(t - 0) <= tolerance) return vertices[ei.start]

  if (Math.abs(t - 1) <= tolerance) return vertices[ei.end]

  if (Math.abs(u - 0) <= tolerance) return vertices[ej.start]

  if (Math.abs(u - 1) <= tolerance) return vertices[ej.end]

  if (t > -tolerance && u > -tolerance && t < 1 + tolerance && u < 1 + tolerance) {
    return { id: uuidv4(), x: intersectionPoint[0], y: intersectionPoint[1] }
  }
  return null
}

function edgesOverlap(ei, ej, vertices, edges, tol, parallellIntersectionMap, i, j) {
  const e1 = getEdgePoints(ei, vertices)
  const e2 = getEdgePoints(ej, vertices)
  const res = customIntersection(e1[0], e1[1], e2[0], e2[1])
  const coincidingVertex = ei.start === ej.start || ei.start === ej.end || ei.end === ej.start || ei.end === ej.end
  if (res && !coincidingVertex) {
    return
  }
  if (isPointBetweenTwoPoints(e1[0], e1[1], e2[0], tol)) {
    parallellIntersectionMap[i].push(ej.start)
  }
  if (isPointBetweenTwoPoints(e1[0], e1[1], e2[1], tol)) {
    parallellIntersectionMap[i].push(ej.end)
  }
  if (isPointBetweenTwoPoints(e2[0], e2[1], e1[0], tol)) {
    parallellIntersectionMap[j].push(ei.start)
  }
  if (isPointBetweenTwoPoints(e2[0], e2[1], e1[1], tol)) {
    parallellIntersectionMap[j].push(ei.end)
  }
}

function updateEdgesToIntersectionsMap(i, j, n, edgesValues, vertices, edgesToIntersections) {
  const k = rowColumnToFlatIndex(i, j, n)
  const newVertex = getIntersectionVertexIfAny(edgesValues[i], edgesValues[j], vertices)
  if (newVertex) {
    vertices[newVertex.id] = newVertex
    edgesToIntersections[k] = newVertex
  }
}

function getIntersectionMap(vertices, edges, edgesToIntersectIds) {
  const edgeValues = Object.values(edges)
  const n = edgeValues.length
  const includesList = edgeValues.map((e) => edgesToIntersectIds.includes(e.id))
  let edgesToIntersectionsMap = new Array((n * (n - 1)) / 2) //Number of pairs between n items
  for (let i = 0; i < edgeValues.length; i++) {
    for (let j = i + 1; j < edgeValues.length; j++) {
      if (!includesList[i] && !includesList[j]) {
        continue
      }
      updateEdgesToIntersectionsMap(i, j, n, edgeValues, vertices, edgesToIntersectionsMap, edges)
    }
  }
  return edgesToIntersectionsMap
}

function handleParallellEdges(edges, vertices, edgesToIntersectIds, tolerance) {
  const tol = tolerance ? tolerance : PRECISION
  const edgeValues = Object.values(edges)
  const n = edgeValues.length
  let parallellIntersectionMap = {}
  for (let i = 0; i < n; i++) {
    parallellIntersectionMap[i] = []
  }
  for (let i = 0; i < edgeValues.length; i++) {
    for (let j = i + 1; j < edgeValues.length; j++) {
      if (!edgesToIntersectIds.includes(edgeValues[i].id) && !edgesToIntersectIds.includes(edgeValues[j].id)) {
        continue
      }
      edgesOverlap(edgeValues[i], edgeValues[j], vertices, edges, tol, parallellIntersectionMap, i, j)
    }
  }
  let { newEdges, updatedEdgeIDs } = constructNonOverlappingEdges(
    edges,
    vertices,
    parallellIntersectionMap,
    edgeValues,
    edgesToIntersectIds,
  )
  return {
    graphWithoutOverlappingEdges: { edges: newEdges, vertices: vertices },
    updatedEdgeIDs,
  }
}

function constructNonOverlappingEdges(edges, vertices, parallellIntersectionMap, edgeValues, edgesToIntersectIDs) {
  let updatedEdgeIDs = []
  let newEdges = {}
  for (let i = 0; i < edgeValues.length; i++) {
    if (parallellIntersectionMap[i].length > 0) {
      const verticesAtParallellIntersection = parallellIntersectionMap[i].map((id) => vertices[id])
      const edgesOut = foundVerticesToVerticesEdges(
        verticesAtParallellIntersection,
        vertices[edgeValues[i].start],
        vertices[edgeValues[i].end],
        edgeValues[i].width,
      )
      newEdges = { ...newEdges, ...edgesOut }
      if (edgesToIntersectIDs.includes(edgeValues[i].id)) {
        updatedEdgeIDs.push(...Object.keys(edgesOut))
      }
    } else {
      newEdges[edgeValues[i].id] = edgeValues[i]
      if (edgesToIntersectIDs.includes(edgeValues[i].id)) {
        updatedEdgeIDs.push(edgeValues[i].id)
      }
    }
  }
  return { newEdges, updatedEdgeIDs }
}

function removeDuplicateEdgesByValue(edges) {
  const filtered = Object.values(edges).reduce(function (acc, cur) {
    const id = cur.start < cur.end ? cur.start + cur.end : cur.end + cur.start
    acc[id] = { id: cur.id, start: cur.start, end: cur.end, width: cur.width }
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

export function getGraphWithUpdatedIntersections(graph, edgeWidth, edgeIds, tolerance = PRECISION) {
  const edgeIDsToIntersect = edgeIds ? edgeIds : Object.keys(graph.edges)
  const { graphWithoutOverlappingEdges, updatedEdgeIDs } = handleParallellEdges(
    graph.edges,
    graph.vertices,
    edgeIDsToIntersect,
    tolerance,
  )
  const edgesToIntersectionsMap = getIntersectionMap(
    graphWithoutOverlappingEdges.vertices,
    graphWithoutOverlappingEdges.edges,
    updatedEdgeIDs,
  )
  const edgesAfterIntersection = reconstructEdges(
    edgesToIntersectionsMap,
    graphWithoutOverlappingEdges.edges,
    graphWithoutOverlappingEdges.vertices,
    updatedEdgeIDs,
    edgeWidth,
  )
  return {
    vertices: graphWithoutOverlappingEdges.vertices,
    edges: removeDuplicateEdgesByValue(edgesAfterIntersection),
  }
}

export function getGraphIntersectedWithSelf(graph, edgeWidth, edgeIds?, tolerance = PRECISION) {
  const edgeIDsToIntersect = edgeIds ? edgeIds : Object.keys(graph.edges)
  const { graphWithoutOverlappingEdges, updatedEdgeIDs } = handleParallellEdges(
    graph.edges,
    graph.vertices,
    edgeIDsToIntersect,
    tolerance,
  )
  const edgesToIntersectionsMap = getIntersectionMap(
    graphWithoutOverlappingEdges.vertices,
    graphWithoutOverlappingEdges.edges,
    updatedEdgeIDs,
  )
  const edgesAfterIntersection = reconstructEdges(
    edgesToIntersectionsMap,
    graphWithoutOverlappingEdges.edges,
    graphWithoutOverlappingEdges.vertices,
    updatedEdgeIDs,
    edgeWidth,
  )
  return {
    vertices: graphWithoutOverlappingEdges.vertices,
    edges: removeDuplicateEdgesByValue(edgesAfterIntersection),
  }
}
