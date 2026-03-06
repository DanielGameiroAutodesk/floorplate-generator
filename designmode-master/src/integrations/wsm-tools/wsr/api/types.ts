import type { GrossFloorAreaPolygon } from "@spacemakerai/element-types"

/**
 * This controls specialization of the integrated 3d sketch tools and interface
 * depending on the object being edited.
 *
 * Currently, Default=WSM, and Volumes has no specialization (so =Default)
 *
 *
 */
export enum Integrated3DSketchEditModeType {
  Default,
  Constraints,
  Volumes,
  /** WSM mode = all features available */
  WSM,
}

export const WSM_MACHINE_TOL = 1.0e-12
export const WSM_DISTANCE_TOL = 1.0e-6

export type Point = [number, number]

export type Polygon = Point[]

export type MultiRingPolygon = Polygon[]

export interface RawMeshData {
  position: Float32Array
  normal: Float32Array
}

export interface WSMGeometryData extends RawMeshData {
  uv?: Float32Array
  index?: number[]
  color?: Uint8Array
  axmRepresentation?: string
  floorVolumes?: { position: Float32Array; normal: Float32Array }[]
  floorPolygons?: GrossFloorAreaPolygon[][]
}

// Used to describe a tool on the context menu
export type MainTool = {
  Icon: string
  Name: string
  Result: boolean
  ToolTip: string
  ToolType: FormIt.ToolType
}

export interface ReducedMeshesAndTransformsData {
  objectName: "ReducedMeshesAndTransforms"
  transforms: WSM.Transf3dInterface[]
  meshes: WSM.Utils.ReducedMeshData[]
}

/* taper move or straight move */
export type MoveMode = "tMove" | "sMove"
export const defaultMoveMode: MoveMode = "tMove"
/* default mode for extrude is straight */
export const defaultExtrudeMode: MoveMode = "sMove"

// Default floor heights
export const defaultFloorHeightImperial = 10
export const defaultFloorHeightMetric = 3
