type Edge = { start: string; end: string; id: string }
type Vertex = { x: number; y: number; id: string }

type SimpleGraph = {
  edges: Record<string, Edge>
  vertices: Record<string, Vertex>
}

//----------------------------------------
// splitGraphInConnectedSubGraphs
//----------------------------------------

function getVertexEdgeMap(graph: SimpleGraph) {
  const vertexEdgeMap: Record<string, string[]> = {}
  Object.keys(graph.vertices).forEach((vertexID) => {
    vertexEdgeMap[vertexID] = []
  })
  Object.entries(graph.edges).forEach(([edgeID, edge]) => {
    const startVertex = edge.start
    const endVertex = edge.end
    vertexEdgeMap[startVertex].push(edgeID)
    vertexEdgeMap[endVertex].push(edgeID)
  })
  return vertexEdgeMap
}

function splitGraphInConnectedSubGraphs(graph: SimpleGraph) {
  const { edges, vertices } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const visitedEdges: Record<string, boolean> = {}
  const subGraphs: SimpleGraph[] = []

  for (const edge of Object.values(edges)) {
    if (visitedEdges[edge.id]) continue
    const subGraphEdges: Record<string, Edge> = {}
    let edgeList = [edge.id]
    while (edgeList.length > 0) {
      const nextEdgeList = []
      for (const edgeID of edgeList) {
        if (visitedEdges[edgeID]) continue
        visitedEdges[edgeID] = true
        subGraphEdges[edgeID] = edges[edgeID]
        nextEdgeList.push(...vertexEdgeMap[edges[edgeID].start], ...vertexEdgeMap[edges[edgeID].end])
      }
      edgeList = nextEdgeList
    }
    const subGraphVertices: Record<string, Vertex> = {}
    Object.values(subGraphEdges).forEach((subGraphEdge) => {
      subGraphVertices[subGraphEdge.start] = vertices[subGraphEdge.start]
      subGraphVertices[subGraphEdge.end] = vertices[subGraphEdge.end]
    })
    const subGraph = { edges: subGraphEdges, vertices: subGraphVertices }
    subGraphs.push(subGraph)
  }
  return subGraphs
}

//----------------------------------------
// findLoopsInGraph
//----------------------------------------

function getDirectedVertexMap(graph: SimpleGraph) {
  const { vertices, edges } = graph
  const vertexEdgeMap = getVertexEdgeMap(graph)
  const directedVertexMap: Record<string, Record<string, string>> = {}
  Object.entries(vertexEdgeMap).forEach(([vertexID, neighbourEdgeIDs]) => {
    const vertex = vertices[vertexID]
    directedVertexMap[vertexID] = {}
    const angleList = neighbourEdgeIDs
      .map((neighbourEdgeID) => {
        const edge = edges[neighbourEdgeID]
        const otherVertexID = edge.start === vertexID ? edge.end : edge.start
        const otherVertex = vertices[otherVertexID]
        const dx = otherVertex.x - vertex.x
        const dy = otherVertex.y - vertex.y
        const angle = Math.atan2(dy, dx)
        return {
          angle,
          edgeID: neighbourEdgeID,
          otherVertexID,
        }
      })
      .sort((a, b) => a.angle - b.angle)
    const n = angleList.length
    for (let i = 0; i < n; i++) {
      const vertexOneID = angleList[i].otherVertexID
      const vertexTwoID = angleList[(i + 1) % n].otherVertexID
      directedVertexMap[vertexID][vertexTwoID] = vertexOneID
    }
  })

  return directedVertexMap
}

function traceLoopInGraph(
  vertexOneID: string,
  vertexTwoID: string,
  directedVertexMap: Record<string, Record<string, string>>,
) {
  const loop = [vertexOneID, vertexTwoID]
  let currentID = vertexTwoID
  let prevID = vertexOneID
  for (let i = 0; i < 1000; i++) {
    const nextID = directedVertexMap[currentID][prevID]
    if (nextID === vertexTwoID && currentID === vertexOneID) break
    loop.push(nextID)
    prevID = currentID
    currentID = nextID
  }
  return loop
}

function isPolygonClockwise(poly: Vertex[]) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y),
    0,
  )
  return sum > 0
}

function isVertexPolygonLine(vertexPolygon: Vertex[]) {
  const edgeCounter: Record<string, number> = {}
  const n = vertexPolygon.length
  for (let i = 0; i < vertexPolygon.length; i++) {
    const v0 = vertexPolygon[i]
    const v1 = vertexPolygon[(i + 1) % n]
    if (v0.id === v1.id) continue
    const keyOne = v0.id + "-" + v1.id
    const keyTwo = v1.id + "-" + v0.id
    if (!edgeCounter[keyOne]) edgeCounter[keyOne] = 0
    if (!edgeCounter[keyTwo]) edgeCounter[keyTwo] = 0
    edgeCounter[keyOne] += 1
    edgeCounter[keyTwo] += 1
  }
  return Object.values(edgeCounter).every((value) => value === 2)
}

function findLoopsInGraph(graph: SimpleGraph) {
  const directedVertexMap = getDirectedVertexMap(graph)
  const polygons: Vertex[][] = []
  const usedEdges: Record<string, boolean> = {}
  Object.keys(graph.vertices).forEach((vertexOneID) => {
    const neighbours = Object.values(directedVertexMap[vertexOneID])
    neighbours.forEach((vertexTwoID) => {
      const edgeName = vertexOneID + "-" + vertexTwoID
      if (!usedEdges[edgeName]) {
        const loop = traceLoopInGraph(vertexOneID, vertexTwoID, directedVertexMap)
        const polygon = loop.map((vertexID) => {
          return graph.vertices[vertexID]
        })
        polygons.push(polygon)
        const n = loop.length
        for (let i = 0; i < n; i++) {
          const edgeName = loop[i] + "-" + loop[(i + 1) % n]
          usedEdges[edgeName] = true
        }
      }
    })
  })
  const innerLoops = polygons.filter((polygon) => {
    return !isPolygonClockwise(polygon) && !isVertexPolygonLine(polygon)
  })
  const outerLoops = polygons
    .filter((polygon) => {
      return isPolygonClockwise(polygon) || isVertexPolygonLine(polygon)
    })
    .map((polygon) => polygon.reverse())

  return { innerLoops, outerLoops }
}

//----------------------------------------
// getSubGraphTree
//----------------------------------------

function areaOfPolygon(polygon: Vertex[], holes: Vertex[][] = []) {
  const nPoints = polygon.length
  let area = 0

  for (let i = 0; i < nPoints; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % nPoints]
    area += 0.5 * (p0.x * p1.y - p1.x * p0.y)
  }

  let negativeArea = 0
  const nHoles = holes.length
  for (let i = 0; i < nHoles; i++) {
    const polygon = holes[i]
    const nPointsHole = polygon.length
    for (let j = 0; j < nPointsHole; j++) {
      const p0 = polygon[j]
      const p1 = polygon[(j + 1) % nPointsHole]
      negativeArea += 0.5 * (p0.x * p1.y - p1.x * p0.y)
    }
  }

  return area - negativeArea
}

function isPointInsidePolygon(point: Vertex, polygon: Vertex[]) {
  let { x, y } = point
  const n = polygon.length

  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    let xi = polygon[i].x
    let yi = polygon[i].y
    let xj = polygon[j].x
    let yj = polygon[j].y

    let intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function makePolygonCounterClockwise(polygon: Vertex[]) {
  const poly = [...polygon]
  if (isPolygonClockwise(poly)) poly.reverse()
  return poly
}

function getSubGraphTree(
  subGraphLoops: {
    subGraphID: string
    outerLoop: Vertex[]
    innerLoops: Vertex[][]
  }[],
) {
  const n = subGraphLoops.length
  const childGroups: Record<string, string[]> = {}
  const parentGroup: Record<string, string> = {}
  for (let i = 0; i < n; i++) {
    const groupID = subGraphLoops[i].subGraphID
    childGroups[groupID] = []
  }
  const areas = subGraphLoops.map(({ outerLoop }) => areaOfPolygon(outerLoop))
  for (let i = 0; i < n; i++) {
    let minArea = Infinity
    let parentIndex = undefined
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const { outerLoop: childPolygon } = subGraphLoops[i]
      const { outerLoop: parentPolygon } = subGraphLoops[j]
      const pointInsidePolygon = isPointInsidePolygon(childPolygon[0], parentPolygon)
      if (pointInsidePolygon && areas[j] < minArea) {
        minArea = areas[j]
        parentIndex = j
      }
    }
    if (parentIndex !== undefined) {
      const parentID = subGraphLoops[parentIndex].subGraphID
      const childID = subGraphLoops[i].subGraphID
      childGroups[parentID].push(childID)
      parentGroup[childID] = parentID
    }
  }
  return { childGroups, parentGroup }
}

function getRootGroup(parentGroup: Record<string, string>, groupID: string) {
  let rootGroupID = groupID
  while (parentGroup[rootGroupID]) {
    rootGroupID = parentGroup[rootGroupID]
  }
  return rootGroupID
}

//----------------------------------------
// graphToOuterPolygons
//----------------------------------------

export function graphToOuterPolygons(graph: SimpleGraph): [number, number][][] {
  let currentSubGraphID = 0
  const subGraphs = splitGraphInConnectedSubGraphs(graph)
  const subGraphLoops: {
    subGraphID: string
    outerLoop: Vertex[]
    innerLoops: Vertex[][]
  }[] = subGraphs
    .map((subGraph) => {
      const { innerLoops, outerLoops } = findLoopsInGraph(subGraph)
      const outerLoop = outerLoops[0]
      const subGraphID = `${currentSubGraphID++}`
      return { subGraphID, outerLoop, innerLoops }
    })
    .filter(({ outerLoop }) => outerLoop)

  const { parentGroup } = getSubGraphTree(subGraphLoops)

  const polygons: Vertex[][] = []
  subGraphLoops.forEach(({ outerLoop: groupPolygon, subGraphID: groupID }) => {
    const rootGroupID = getRootGroup(parentGroup, groupID)
    if (rootGroupID === groupID) {
      polygons.push(makePolygonCounterClockwise(groupPolygon))
    }
  })

  return polygons.map((polygon) => polygon.map(({ x, y }: { x: number; y: number }) => [x, y]))
}
