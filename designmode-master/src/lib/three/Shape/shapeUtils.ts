import type { Matrix4 } from "three"
import { Vector3 } from "three"
import { isDefined } from "src/lib/array"
import type { Edge, Loop, Shape } from "./types"
import { shapeLoopsToCoordinates } from "./shapeCoordinatesHelpers"
import { samePoint } from "src/lib/three/geometryUtils"
import { closePolygon, openPolygon } from "src/lib/three/polygon"
import type { BasicLine, Coord2D } from "src/lib/geometry/geometryTypes"
import type { Feature, LineString, Polygon } from "geojson"
import { polygon } from "@turf/helpers"
import kinks from "@turf/kinks"
import { isClockwise } from "src/lib/geometry/geometryUtils"
import { feetToMeter } from "src/lib/measurementSystem"

export type EditedShape = {
  vertices: (Vector3 | undefined)[]
  edges: (Edge | undefined)[]
  loops: (Loop | undefined)[]
}

function sameEdge(e1: Edge | undefined, e2: Edge | undefined): boolean {
  if (!e1 || !e2) return false

  const [start1, end1] = e1
  const [start2, end2] = e2
  return (start1 === start2 && end1 === end2) || (start1 === end2 && end1 === start2)
}

function sameStartAndEnd(e: Edge | undefined): boolean {
  return e === undefined || e[0] === e[1]
}

function isConnected(v1: number, v2: number, shape: EditedShape): boolean {
  return v1 != v2 && shape.edges.some((e) => e && e.includes(v1) && e.includes(v2))
}

function collapseVertices(shape: EditedShape, collapsed: number[]): EditedShape {
  const [collapseOnVertex, ...removed] = collapsed

  const vertices = shape.vertices.map((v, i) => (removed.includes(i) ? undefined : v))

  const removedEdges: number[] = []
  const edges = shape.edges
    .map((e) => e && (e.map((v) => (removed.includes(v) ? collapseOnVertex : v)) as Edge))
    .map((e, i) => {
      if (sameStartAndEnd(e)) {
        removedEdges.push(i)
        return undefined
      }
      return e
    })

  const loops = shape.loops
    .map((loop) => loop && (loop.filter((e) => !removedEdges.includes(e)) as Loop))
    .map((l) => (l && l.length < 3 ? undefined : l))

  return {
    vertices,
    edges,
    loops,
  }
}

function collapsePointsAtPosition(position: Vector3, shape: EditedShape): EditedShape {
  const atPosition: number[] = []
  shape.vertices.forEach((v, i) => {
    if (v && samePoint(v, position)) atPosition.push(i)
  })

  const toCollapse = atPosition.reduce(
    (previousValue, vertexAtPosition) => {
      if (previousValue.some((v) => isConnected(v, vertexAtPosition, shape))) {
        previousValue.push(vertexAtPosition)
      }
      return previousValue
    },
    atPosition.slice(0, 1),
  )

  if (toCollapse.length < 2) return shape

  return collapseVertices(shape, toCollapse)
}

export namespace ShapeUtils {
  export function addPointOnEdge(shape: Shape, edgeIndex: number, newPointPosition: Vector3): Shape {
    const vertices = shape.vertices.concat(newPointPosition)
    const newVertexIdx = vertices.length - 1
    const affectedEdge = shape.edges[edgeIndex]
    const edges = shape.edges
      .filter((_, i) => i !== edgeIndex)
      .concat([[affectedEdge[0], newVertexIdx] as Edge, [newVertexIdx, affectedEdge[1]] as Edge])

    const loops = shape.loops.map((loop) => {
      return loop.flatMap((loopEdge) => {
        if (loopEdge < edgeIndex) {
          return loopEdge
        } else if (loopEdge > edgeIndex) {
          return loopEdge - 1
        } else {
          return [edges.length - 2, edges.length - 1]
        }
      })
    })

    return {
      vertices,
      edges,
      loops,
    }
  }

  export function translateVertices(
    shape: EditedShape,
    vertexIndices: number[],
    translation: Vector3,
    collapseDuplicates = false,
  ): EditedShape {
    const { vertices: oldVertices, edges, loops } = shape
    const vertices = oldVertices.map((vertex, index) => {
      if (!vertex || !vertexIndices.includes(index)) return vertex

      return new Vector3().addVectors(vertex, translation)
    })

    let newShape: EditedShape = { vertices, edges, loops }
    if (collapseDuplicates) {
      const collapsePositions = vertexIndices.map((idx) => vertices[idx])
      collapsePositions.forEach((v) => {
        if (!v) return
        newShape = collapsePointsAtPosition(v, newShape)
      })
    }

    return newShape
  }

  export function removeVertex(shape: EditedShape, vertexIndex: number): EditedShape {
    if (shape.vertices.length === 1 && vertexIndex === 0) {
      return {
        vertices: [],
        edges: [],
        loops: [],
      }
    }
    const firstEdgeWithVertex = shape.edges.find((e) => e && e.includes(vertexIndex))

    if (firstEdgeWithVertex === undefined) {
      //If the vertex is unconnected, just collapse it on any other vertex to remove it.
      return collapseVertices(shape, [vertexIndex === 0 ? 1 : 0, vertexIndex])
    } else {
      const otherEndOfEdge = firstEdgeWithVertex.find((v) => v !== vertexIndex)!
      return collapseVertices(shape, [otherEndOfEdge, vertexIndex])
    }
  }

  export function addShape(shape: EditedShape, added: EditedShape): EditedShape {
    //TODO: Jørgen create loop when added shape closes an open loop/creates loop by combining with edges of existing shape

    const existingVertices = shape.vertices
    let numNewVerts = 0
    const indexOfNewVert = added.vertices.map((v) => {
      const existing = existingVertices.findIndex((exV) => exV && v && samePoint(exV, v))
      if (existing !== -1) return existing
      return existingVertices.length + numNewVerts++
    })
    const addedVertices = added.vertices.filter((value, index) => indexOfNewVert[index] >= existingVertices.length)

    let numNewEdges = 0

    const addedRemapped = added.edges.map((addedEdge) => addedEdge && (addedEdge.map((v) => indexOfNewVert[v]) as Edge))
    const indexOfNewEdges = addedRemapped.map((addedEdge) => {
      const existing = shape.edges.findIndex((existingEdge: Edge | undefined) => sameEdge(existingEdge, addedEdge))
      if (existing !== -1) return existing
      return shape.edges.length + numNewEdges++
    })
    const addedEdges: (Edge | undefined)[] = addedRemapped.filter((e, i) => indexOfNewEdges[i] >= shape.edges.length)

    const addedLoops: (Loop | undefined)[] = added.loops.map((loop) => loop && loop.map((n) => indexOfNewEdges[n]))

    return {
      vertices: shape.vertices.concat(addedVertices),
      edges: shape.edges.concat(addedEdges),
      loops: shape.loops.concat(addedLoops),
    }
  }

  export function pruneEditedShape(edited: EditedShape): Shape {
    const removedVertexIndices = edited.vertices.map((v, i) => (v ? undefined : i)).filter(isDefined)
    const remappedVertices = edited.vertices.map((_, oldIndex) => {
      return oldIndex - removedVertexIndices.filter((c) => c < oldIndex).length
    })
    const remapVertex = (idx: number) => {
      return remappedVertices[idx]
    }

    const removedEdgeIndices = edited.edges.map((v, i) => (v ? undefined : i)).filter(isDefined)
    const remappedEdges = edited.edges.map((_, oldIndex) => {
      return oldIndex - removedEdgeIndices.filter((c) => c < oldIndex).length
    })
    const remapEdge = (idx: number) => {
      return remappedEdges[idx]
    }

    return {
      vertices: edited.vertices.filter(isDefined),
      edges: edited.edges.filter(isDefined).map((e) => e.map(remapVertex) as Edge),
      loops: edited.loops.filter(isDefined).map((l) => l.map(remapEdge) as Loop),
    }
  }

  export function singleLoopOfShape(shape: Shape): number[] | undefined {
    if (shape.edges.length < 3) return undefined
    if (shape.edges.length !== shape.vertices.length) return undefined

    const loop: number[] = [0]
    let candidateEdges = [...shape.edges]

    while (candidateEdges.length > 0) {
      const currentLast = loop[loop.length - 1]
      const edgeIdx = candidateEdges.findIndex((e) => e.includes(currentLast))
      if (edgeIdx < 0) return undefined
      loop.push(...candidateEdges[edgeIdx].filter((v) => v !== currentLast))
      candidateEdges = candidateEdges.filter((e, i) => i !== edgeIdx)
    }

    if (loop[0] !== loop[loop.length - 1]) return undefined

    return loop
  }

  /**
   * Given a shape, returns a list of connected vertices in the shape.
   * NOTE: if shape consists of more than one connected set of vertices, only one of these will be returned
   * @param shape
   * @param edgeIdx
   * @return an ordered list of vertices
   */
  export function connectedVerticesOfShape(shape: Shape): Vector3[] {
    if (shape.edges.length === 0) return []

    const vertices = [shape.edges[0][0]]

    let foundConnected = true

    //Appending
    while (foundConnected) {
      foundConnected = false
      const connectedEdge = shape.edges.find(
        (e) => e.includes(vertices[vertices.length - 1]) && e.some((v) => !vertices.includes(v)),
      )
      if (connectedEdge) {
        vertices.push(...connectedEdge.filter((v) => !vertices.includes(v)))
        foundConnected = true
      }
    }

    foundConnected = true
    //Prepending
    while (foundConnected) {
      foundConnected = false
      const connectedEdge = shape.edges.find((e) => e.includes(vertices[0]) && e.some((v) => !vertices.includes(v)))
      if (connectedEdge) {
        vertices.unshift(...connectedEdge.filter((v) => !vertices.includes(v)))
        foundConnected = true
      }
    }

    return vertices.map((v) => shape.vertices[v])
  }

  /**
   * Creates coordinates list assuming first loop in shape is exterior and the rests are holes
   * @param shape
   *
   */
  export function coordinatesFromShape(shape: Shape) {
    let shapeWithLoops = shape
    if (shape.loops.length === 0) {
      const loop = singleLoopOfShape(shape)
      if (!loop) return []
      shapeWithLoops = { ...shape, loops: [loop] }
    }
    return shapeLoopsToCoordinates(shapeWithLoops)
  }

  export function createEmptyShape() {
    return {
      vertices: [],
      edges: [],
      loops: [],
    }
  }

  /**
   * Creates coordinates list assuming first loop in shape is exterior and the rests are holes
   *
   * @param coordinates
   * @param elevation
   * @param matrix
   * @param closed
   */
  export function shapeFromCoordinates(coordinates: number[][][], elevation: number, matrix?: Matrix4, closed = true) {
    function ringToShape(ring: number[][]): Shape {
      const vegShapeAsVec3 = openPolygon(ring.map((point) => new Vector3(point[0], point[1], elevation)))
      if (matrix) vegShapeAsVec3.forEach((v) => v.applyMatrix4(matrix))
      const edges = vegShapeAsVec3.map((_, i) => [i, (i + 1) % vegShapeAsVec3.length] as [number, number])
      if (!closed) {
        edges.pop()
      }

      return {
        vertices: vegShapeAsVec3,
        edges,
        loops: closed ? [loopFromEdges(edges)] : [],
      }
    }

    return pruneEditedShape(
      coordinates.reduce((acc, ring) => {
        return addShape(acc, ringToShape(ring))
      }, createEmptyShape() as EditedShape),
    )
  }

  export const closeEdgesOnShape = (shape: Shape): Shape => {
    const isFirstAndLastConnected = shape.edges.some((e) => e.includes(0) && e.includes(shape.vertices.length - 1))
    const newEdges = isFirstAndLastConnected ? shape.edges : [...shape.edges, [shape.vertices.length - 1, 0] as Edge]
    return {
      ...shape,
      edges: newEdges,
      loops: [newEdges.map((_, i) => i)],
    }
  }

  export function loopFromEdges(edges: Edge[]): Loop {
    //TODO: Jørgen: needs to check if the set of edges actually loop
    return edges.map((_, i) => i)
  }

  export const closeEdgesAndCreateLoopFromShape = (shape: Shape): Shape => {
    const withClosedEdges = closeEdgesOnShape(shape)
    return { ...withClosedEdges, loops: [loopFromEdges(withClosedEdges.edges)] }
  }

  /**
   * Given a vertex index, list the index of all vertices connected to that vertex by an edge
   * @param shape
   * @param vertexIndex
   */
  export function connectedVertices(shape: Shape, vertexIndex: number): number[] {
    return Array.from(
      new Set(shape.edges.filter((e) => e.includes(vertexIndex)).flatMap((e) => e.filter((v) => v !== vertexIndex))),
    )
  }
}

export function loopFromEdges(edges: Edge[]): Loop {
  //TODO: Jørgen: needs to check if the set of edges actually loop
  return edges.map((_, i) => i)
}

export function AT_LEAST_ONE_VERTEX(shape: Shape): boolean {
  return shape.vertices.length > 1
}

export function AT_LEAST_TWO_VERTICES(shape: Shape): boolean {
  return shape.vertices.length >= 2
}

export function isSelfIntersecting(points: Vector3[]): boolean {
  const copy = [...points]
  if (points.length <= 3) return false
  const map = closePolygon(copy).map((v) => [v.x, v.y])
  const poly = polygon([map])
  const foundKinks = kinks(poly)
  return foundKinks.features.length > 0
}

export function SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON(shape: Shape): boolean {
  const loopInShape = ShapeUtils.singleLoopOfShape(shape)
  if (!loopInShape) return false

  const polygon = loopInShape.map((v) => shape.vertices[v])
  return !isSelfIntersecting(polygon)
}

export function SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON_WITH_HOLES(shape: Shape): boolean {
  // todo check validity of holes
  const coordinates = ShapeUtils.coordinatesFromShape(shape)
  if (coordinates.length === 0 || coordinates[0].length < 3) return false
  for (const ring of coordinates) {
    if (isSelfIntersecting(ring.map((p) => new Vector3(p[0], p[1])))) {
      return false
    }
  }

  return true
}

export const shapeToBlock = (shape: Shape) => {
  if (!SINGLE_CLOSED_NON_SELF_INTERSECTING_POLYGON(shape)) {
    console.error("Shape not a valid footprint for block", shape)
    throw new Error("Shape not a valid footprint for block")
  }
  const vertices = ShapeUtils.singleLoopOfShape(shape)!.map((v) => shape.vertices[v])
  const verticesAsVec2 = vertices.map(({ x, y }) => [x, y])
  const lowestZ = vertices.reduce((acc, cur) => Math.min(acc, cur.z), Infinity)
  return {
    groundPolygon: verticesAsVec2 as Coord2D[],
    elevation: lowestZ,
  }
}

export function shapeToPolygonFeature(shape: Shape, height?: number): Feature<Polygon> {
  const { groundPolygon, elevation } = shapeToBlock(shape)

  if (isClockwise(groundPolygon)) {
    groundPolygon.reverse()
  }

  return {
    type: "Feature",
    properties: height
      ? {
          height: height,
          elevation: elevation,
        }
      : null,
    geometry: {
      type: "Polygon",
      coordinates: [groundPolygon],
    },
  }
}

export function shapeToBasicLine(shape: Shape, properties: any = {}, close = false): BasicLine {
  const vertices = ShapeUtils.connectedVerticesOfShape(shape)
  const coordinates = vertices.filter(isDefined).map(({ x, y }) => [x, y])

  if (close) {
    coordinates.push(coordinates[0])
  }
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates,
    },
    properties,
  }
}

export function polygonGeometryElevatedToShape(geometry: Polygon, worldMatrix: Matrix4, elevation: number = 0): Shape {
  const elevatedVertices = geometry.coordinates[0].map(([x, y]) => new Vector3(x, y, elevation))
  const worldVertices = openPolygon(elevatedVertices).map((v) => v.applyMatrix4(worldMatrix))
  const edges = worldVertices.map((_, i) => [i, (i + 1) % worldVertices.length] as [number, number])
  return {
    vertices: worldVertices,
    edges,
    loops: [loopFromEdges(edges)],
  }
}

export function polygonGeometryToShape(
  geometry: Polygon,
  worldMatrix: Matrix4,
  elevationAt: (x: number, y: number) => number,
): Shape {
  const flatVertices = geometry.coordinates[0].map(([x, y]) => new Vector3(x, y, 0))
  const projectedVertices = openPolygon(flatVertices)
    .map((v) => v.applyMatrix4(worldMatrix))
    .map((v) => v.setZ(elevationAt(v.x, v.y)))
  const edges = projectedVertices.map((_, i) => [i, (i + 1) % projectedVertices.length] as [number, number])
  return {
    vertices: projectedVertices,
    edges,
    loops: [loopFromEdges(edges)],
  }
}

export function lineStringGeometryToShape(
  geometry: LineString,
  worldMatrix: Matrix4,
  elevationAt: (x: number, y: number) => number,
): Shape {
  const projectedVertices = geometry.coordinates
    .map(([x, y]) => new Vector3(x, y, 0).applyMatrix4(worldMatrix))
    .map((v) => v.setZ(elevationAt(v.x, v.y)))
  return {
    vertices: projectedVertices,
    edges: geometry.coordinates
      .slice(0, -1)
      .map((_, i) => [i, (i + 1) % geometry.coordinates.length] as [number, number]),
    loops: [],
  }
}

export function categoryToDefaultLineWidth(isImperial: boolean, category?: string): number {
  const widths: Record<string, number> = {
    roads: isImperial ? feetToMeter(20) : 6,
    road: isImperial ? feetToMeter(20) : 6,
    rails: isImperial ? feetToMeter(14) : 4,
    rail: isImperial ? feetToMeter(14) : 4,
    generic: isImperial ? feetToMeter(4) : 1,
    default: isImperial ? feetToMeter(4) : 1,
  }

  if (!category || !widths[category]) return widths.default

  return widths[category]
}
