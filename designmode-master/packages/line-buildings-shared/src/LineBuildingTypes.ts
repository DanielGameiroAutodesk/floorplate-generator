import type { GraphEdge } from "./shapeHelpers.js"

type CustomLayoutCorner = {
  id: string
  floors: any[]
  sectionType: "Corner"
  angle: number
  startLeg: number
  endLeg: number
  width: number
  name?: string
  revision?: string
  libraryId?: string
}

export type CustomLayout =
  | {
      id: string
      floors: any[]
      sectionType: "Rectangle" | "Split"
      width: number
      length: number
      name?: string
      revision?: string
      libraryId?: string
    }
  | CustomLayoutCorner

export type GraphZ = {
  edges: Record<string, GraphEdge>
  vertices: Record<string, { x: number; y: number; z: number; id: string }>
}

export type LineAlignment = "center" | "right" | "left"
