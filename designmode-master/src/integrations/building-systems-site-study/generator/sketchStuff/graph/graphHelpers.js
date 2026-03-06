import { pointPointDistance } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { v4 as uuidv4 } from "uuid"
import { mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"

export function cleanGraph(graph) {
  Object.values(graph.edges).forEach((e) => {
    if (
      e.start === e.end ||
      (graph.vertices[e.start].x === graph.vertices[e.end].x && graph.vertices[e.start].y === graph.vertices[e.end].y)
    ) {
      delete graph.edges[e.id]
    }
  })

  const edgeForVertex = Object.values(graph.edges).reduce((acc, e) => {
    if (!acc[e.start]) {
      acc[e.start] = e.id
    }
    if (!acc[e.end]) {
      acc[e.end] = e.id
    }
    return acc
  }, {})

  Object.keys(graph.vertices).forEach((vertexID) => {
    if (!edgeForVertex[vertexID]) delete graph.vertices[vertexID]
  })
}

/** @returns {Graph} */
export function polygonToGraph(polygon, edgeWidth) {
  let poly = [...polygon]
  if (pointPointDistance(poly[0], poly[poly.length - 1]) < 0.00001) {
    poly.pop()
  }
  const n = poly.length
  const verticesIDs = poly.map(() => uuidv4())
  const vertices = poly.reduce((acc, curr, i) => {
    const newVertex = { id: verticesIDs[i], x: curr[0], y: curr[1] }
    acc[newVertex.id] = newVertex
    return acc
  }, {})
  const edgesValues = verticesIDs.map((e, i) => ({
    id: uuidv4(),
    start: verticesIDs[i],
    end: verticesIDs[mod(i + 1, n)],
    width: edgeWidth,
  }))
  const edges = edgesValues.reduce((acc, curr) => {
    acc[curr.id] = curr
    return acc
  }, {})
  return { vertices, edges }
}

/** @returns {Graph} */
export function polygonsToGraph(polygons, edgeWidth) {
  let vertices = {}
  let edges = {}
  const width = edgeWidth ? edgeWidth : 10
  polygons.forEach((poly) => {
    const { vertices: verticesTemp, edges: edgesTemp } = polygonToGraph(poly, width)
    vertices = { ...vertices, ...verticesTemp }
    edges = { ...edges, ...edgesTemp }
  })
  return { edges: edges, vertices: vertices }
}

export function getEdgePoints(edge, vertices) {
  const p1 = [vertices[edge.start].x, vertices[edge.start].y]
  const p2 = [vertices[edge.end].x, vertices[edge.end].y]
  return [p1, p2]
}
