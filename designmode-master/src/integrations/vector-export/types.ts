import type { Line3 } from "three"

// Containers for all lines in the scene
export type LineTypes = { objectLines: Line3[]; sectionCutLines: Line3[]; terrainIntersectionLines: Line3[] }
export type LinesByCategory = Record<string, LineTypes>
export type LinesByBase = {
  base: LinesByCategory
  proposal: LinesByCategory
}

// Containers for relevant lines in the scene - those that are in the view of the camera
type RelevantLines = {
  occluded: LineTypes
  visible: LineTypes
  visibleBelowTerrain: LineTypes
}
type RelevantLinesByCategory = Record<string, RelevantLines>
export type RelevantLinesByBase = {
  base: RelevantLinesByCategory
  proposal: RelevantLinesByCategory
}

export type OccludedLines = {
  visible: Line3[]
  hidden: Line3[]
  visibleBelow: Line3[]
}
