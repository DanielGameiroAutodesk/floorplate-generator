type Id = string

// Short names to increase readability in generics
type PType = Record<string, any>

type Vertex<T extends PType = any> = {
  x: number
  y: number

  locked?: boolean

  properties?: T
}

type Edge<T extends PType = any> = {
  start: Id
  end: Id

  properties?: T
}

type InternalEdge<T extends PType = any> = {
  start: Id
  end: Id

  superEdgeId: Id // The id of the super-edge

  properties?: T
}

type CoEdge<T extends PType = any> = {
  edgeId: Id
  reverse: boolean
  properties?: T
}

type Loop<T extends PType = any> = {
  coEdgeIds: Id[]
  properties?: T
}

type InternalVertexCopied<T extends PType = any> = {
  type: "vertex"

  locked?: boolean

  x: number
  y: number

  properties?: T
}

type InternalVertexIntersection<T extends PType = any> = {
  type: "intersection"

  x: number
  y: number

  intersection: { a: { id: Id; distanceFromStart: number }; b: { id: Id; distanceFromStart: number } }

  properties?: T
}

type VirtualVertex = {
  type: "virtual"
  x: number
  y: number
}

type InternalVertex<T extends PType = any> = InternalVertexCopied<T> | InternalVertexIntersection<T> | VirtualVertex

type NonEmptyList<T> = [T, ...T[]]

type GraphPolygon<T extends PType = any> = {
  loopIds: NonEmptyList<Id> // First id is outer polygon, rest are inner polygons
  properties?: T
}

type Graph<
  EdgeProperties extends PType = any,
  CoEdgeProperties extends PType = any,
  PolygonProperties extends PType = any,
  VertexProperties extends PType = any,
> = {
  id: string
  vertices: Record<Id, Vertex<VertexProperties>>
  edges: Record<Id, Edge<EdgeProperties>>

  _vertices: Record<Id, InternalVertex<VertexProperties>>
  _edges: Record<Id, InternalEdge<EdgeProperties>>
  _coEdges: Record<Id, CoEdge<CoEdgeProperties>>

  _loops: Record<Id, Loop>
  _polygons: Record<Id, GraphPolygon<PolygonProperties>>

  _counter: number
}

export type {
  Id,
  Vertex,
  Edge,
  Loop,
  Graph,
  PType,
  CoEdge,
  InternalVertex,
  InternalVertexCopied,
  InternalVertexIntersection,
  InternalEdge,
  GraphPolygon,
}
