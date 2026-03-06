type Polygon = [number, number][]
type Edge = { start: string; end: string; id: string }
type Vertex = { x: number; y: number; id: string }
type SimpleGraph = { edges: Record<string, Edge>; vertices: Record<string, Vertex> }

type DirectedEdge = `{${string}}` // Poor man's hashable tuple
const createDirectedEdge = (edgeId: string, reverse: boolean): DirectedEdge =>
  JSON.stringify({ edgeId, reverse }) as DirectedEdge
const parseDirectedEdge = (directedEdge: DirectedEdge): { edgeId: string; reverse: boolean } =>
  JSON.parse(directedEdge) as { edgeId: string; reverse: boolean }
type VertexDirectedEdgeMap = Record<string, Set<DirectedEdge>>

function createVertexDirectedEdgeMap(graph: SimpleGraph): VertexDirectedEdgeMap {
  const vertexDirectedEdgeMap: VertexDirectedEdgeMap = {}
  Object.values(graph.edges).forEach(({ id, start, end }) => {
    if (!(start in vertexDirectedEdgeMap)) vertexDirectedEdgeMap[start] = new Set()
    if (!(end in vertexDirectedEdgeMap)) vertexDirectedEdgeMap[end] = new Set()
    vertexDirectedEdgeMap[start].add(createDirectedEdge(id, false))
    vertexDirectedEdgeMap[end].add(createDirectedEdge(id, true))
  })
  return vertexDirectedEdgeMap
}

function determinant(vector1: [number, number], vector2: [number, number]) {
  return vector1[0] * vector2[1] - vector1[1] * vector2[0]
}

function polygonArea(poly: Polygon) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    area += determinant(p1, p2)
  }
  return 0.5 * Math.abs(area)
}

function isClockwise(poly: Polygon) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length][0] - p[0]) * (poly[(i + 1) % poly.length][1] + p[1]),
    0,
  )
  return sum > 0
}

function argMin(array: number[]) {
  let argmin = 0
  let min_value = Number.MAX_VALUE
  for (let i = 0; i < array.length; i++) {
    if (array[i] < min_value) {
      argmin = i
      min_value = array[i]
    }
  }
  return argmin
}

function getDirectionOfTwoVertices(v1: Vertex, v2: Vertex): [number, number] {
  const diff = [v2.x - v1.x, v2.y - v1.y]
  const length = Math.sqrt(Math.pow(diff[0], 2) + Math.pow(diff[1], 2))
  return [diff[0] / length, diff[1] / length]
}

function scoreDirection(currentDirection: [number, number], candidateDirection: [number, number]) {
  const mod = (n: number, m: number) => ((n % m) + m) % m
  const prevAngle = mod(Math.atan2(-currentDirection[1], -currentDirection[0]), Math.PI * 2)
  const candidateAngle = mod(Math.atan2(candidateDirection[1], candidateDirection[0]), Math.PI * 2)
  return mod(prevAngle - candidateAngle, Math.PI * 2)
}

function getNextDirectedEdgeInCycle(
  graph: SimpleGraph,
  vertexDirectedEdgeMap: VertexDirectedEdgeMap,
  currentDirectedEdge: DirectedEdge,
): DirectedEdge {
  const { edgeId, reverse } = parseDirectedEdge(currentDirectedEdge)
  const prevVertexId = reverse ? graph.edges[edgeId].end : graph.edges[edgeId].start
  const currentVertexId = reverse ? graph.edges[edgeId].start : graph.edges[edgeId].end
  const reversedDirectedEdge = createDirectedEdge(edgeId, !reverse)

  const prevVertex = graph.vertices[prevVertexId]
  const currentVertex = graph.vertices[currentVertexId]

  const currentDirection = getDirectionOfTwoVertices(prevVertex, currentVertex)
  const outgoingEdges = [...vertexDirectedEdgeMap[currentVertexId].values()].filter((e) => e != reversedDirectedEdge)
  if (outgoingEdges.length == 0) outgoingEdges.push(reversedDirectedEdge)

  const scores = outgoingEdges.map((directedEdge) => {
    const { edgeId, reverse } = parseDirectedEdge(directedEdge)
    const toVertexId = reverse ? graph.edges[edgeId].start : graph.edges[edgeId].end
    const nextDirection = getDirectionOfTwoVertices(currentVertex, graph.vertices[toVertexId])
    return scoreDirection(currentDirection, nextDirection)
  })

  const minScoreIndex = argMin(scores)
  return outgoingEdges[minScoreIndex]
}

function getOnePolygon(
  graph: SimpleGraph,
  vertexDirectedEdgeMap: VertexDirectedEdgeMap,
  unvisitedEdges: Set<DirectedEdge>,
): { polygon: Polygon; edgeIDs: string[] } | undefined {
  const startDirectedEdge = unvisitedEdges.values().next().value
  if (startDirectedEdge === undefined) return

  let traversedDirectedEdges: DirectedEdge[] = []
  let currentDirectedEdge: DirectedEdge = startDirectedEdge

  let counter = 0
  const maxIterations = 2 * Object.values(graph.vertices).length

  while (counter < maxIterations) {
    traversedDirectedEdges.push(currentDirectedEdge)
    const nextDirectedEdge = getNextDirectedEdgeInCycle(graph, vertexDirectedEdgeMap, currentDirectedEdge)
    if (nextDirectedEdge == startDirectedEdge) {
      break
    }
    currentDirectedEdge = nextDirectedEdge
    counter++
  }

  traversedDirectedEdges.forEach((directedEdge) => {
    const { edgeId, reverse } = parseDirectedEdge(directedEdge)
    const fromVertexId = reverse ? graph.edges[edgeId].end : graph.edges[edgeId].start
    if (!vertexDirectedEdgeMap[fromVertexId].has(directedEdge)) {
      throw new Error("Could not find a traversed DirectedEdge in vertexDirectedEdgeMap")
    }
    vertexDirectedEdgeMap[fromVertexId].delete(directedEdge)
    if (!unvisitedEdges.has(directedEdge)) {
      throw new Error("Could not find a traversed DirectedEdge in unvisitedEdges")
    }
    unvisitedEdges.delete(directedEdge)
  })

  const polygon: Polygon = traversedDirectedEdges.map((directedEdge) => {
    const { edgeId, reverse } = parseDirectedEdge(directedEdge)
    const fromVertexId = reverse ? graph.edges[edgeId].end : graph.edges[edgeId].start
    const fromVertex = graph.vertices[fromVertexId]
    return [fromVertex.x, fromVertex.y]
  })
  polygon.push(polygon[0])

  const edgeIDs = traversedDirectedEdges.map((directedEdge) => {
    const { edgeId } = parseDirectedEdge(directedEdge)
    return edgeId
  })

  return { polygon, edgeIDs }
}

export function graphToInnerPolygons(graph: SimpleGraph) {
  const NPD = 0.01

  const vertexDirectedEdgeMap = createVertexDirectedEdgeMap(graph)
  const unvisitedEdges: Set<DirectedEdge> = new Set(
    Object.values(graph.edges).flatMap(({ id }) => [createDirectedEdge(id, false), createDirectedEdge(id, true)]),
  )

  let polygonsWithBelongingEdgeIDs = []
  let counter = 0
  const maxIterations = 2 * Object.values(graph.vertices).length

  while (counter < maxIterations) {
    const polygonAndEdgeIDs = getOnePolygon(graph, vertexDirectedEdgeMap, unvisitedEdges)
    if (polygonAndEdgeIDs === undefined) {
      break
    }
    const { polygon, edgeIDs } = polygonAndEdgeIDs
    if (polygon.length > 3 && polygonArea(polygon) > NPD && !isClockwise(polygon)) {
      polygonsWithBelongingEdgeIDs.push({ polygon, edgeIDs })
    }
    counter++
  }

  return polygonsWithBelongingEdgeIDs
}
