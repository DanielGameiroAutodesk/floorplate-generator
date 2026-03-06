import type { GridParams } from "./grid"

export type Polygon = [number, number][]

export type GenerateCellGraphParameters =
  | { polygons: Polygon[]; technique: "voronoi"; maxCellArea: number }
  | { polygons: Polygon[]; technique: "grid" }
  | { polygons: Polygon[]; technique: "convex" }
  | { polygons: Polygon[]; technique: "blank" }
  | { polygons: Polygon[]; technique: "grid2"; params: GridParams }

export type Technique = GenerateCellGraphParameters["technique"]

export type Vertex = { x: number; y: number; id: string }
type Edge = { start: string; end: string; id: string }

export type Vertices = { [id: string]: Vertex }
export type Edges = { [id: string]: Edge }

export type SimpleGraph = {
  vertices: Vertices
  edges: Edges
}
