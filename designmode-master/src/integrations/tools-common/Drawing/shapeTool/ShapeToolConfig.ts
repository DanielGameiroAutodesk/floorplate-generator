import type { I18nStringProvider } from "src/i18n"

export enum ShapeToolMoveMode {
  HORIZONTAL = "HORIZONTAL",
  VERTICAL = "VERTICAL",
  TERRAIN = "TERRAIN",
}

export enum CreateToolMode {
  Edit = "Edit",
  DrawClosedPolygon = "DrawClosedPolygon",
  DrawLine = "DrawLine",
  DrawLineSegment = "DrawLineSegment",
}

export enum ToolIntention {
  Move = "Move",
  Rotate = "Rotate",
}

export type ShapeToolConfig = {
  /** Mode used */
  toolMode: CreateToolMode
  /** What are the intention of the tool  */
  toolIntention?: ToolIntention
  /** Modes available to move/draw */
  moveModes: ShapeToolMoveMode[]
  /** lock selected vertices to the given vertex indices while editing */
  activeVertices?: number[]
  /** prevent tool from creating temporarily invalid (according to isValid()) shapes while drawing */
  requireAlwaysValid: boolean
  /** create extensions, parallell and orthogonal snapping lines */
  useContextualLines: boolean
  /** moving a vertex will also move any vertices directly above/below that vertex */
  linkVerticesVertically: boolean
  /** All vertices should be placed on terrain */
  onTerrain: boolean
  /** Tool completes automatically whenever the user has created a single valid shape (according to isValid()) */
  /** Snap to other shapes */
  snapToExternalShape: boolean
  hideFloatingInputs?: boolean
  /* override guidetext */
  guideText?: I18nStringProvider
  ignoreTerrainSnappingLines?: boolean
}

export const DRAW_PLANAR_POLYGON: ShapeToolConfig = {
  toolMode: CreateToolMode.DrawClosedPolygon,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  requireAlwaysValid: true,
  onTerrain: false,
  linkVerticesVertically: false,
  useContextualLines: true,
  snapToExternalShape: true,
}

export const DRAW_POLYGON_ON_TERRAIN: ShapeToolConfig = {
  toolMode: CreateToolMode.DrawClosedPolygon,
  moveModes: [ShapeToolMoveMode.TERRAIN],
  requireAlwaysValid: true,
  onTerrain: true,
  linkVerticesVertically: false,
  useContextualLines: true,
  snapToExternalShape: true,
}

export const DRAW_LINE_ON_TERRAIN: ShapeToolConfig = {
  toolMode: CreateToolMode.DrawLine,
  onTerrain: true,
  linkVerticesVertically: false,
  moveModes: [],
  useContextualLines: true,
  requireAlwaysValid: true,
  snapToExternalShape: true,
}
