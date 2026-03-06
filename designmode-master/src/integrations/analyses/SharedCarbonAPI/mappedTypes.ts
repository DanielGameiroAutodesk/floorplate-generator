import type { Transform } from "forma-elements"

/**
 * This file exposes types of designmode APIs that are used in the embodied carbon analysis
 * The types in this file are owned by carbon squad. When types in designmode change,
 * we will have to explicitly update this file (or create a mapping in our API layer),
 * and update the embodied carbon analysis to use the new types.
 */

export type ColorbarAdd = {
  colors: string[]
  isInteractive: boolean
  unit?: string | undefined
  labelPosition?: "center" | "edge" | undefined
  labels?: string[] | undefined
}

/**
 * designmode exposes more rendering specs/modes, but these are the only ones we use atm
 */
type RenderingSpec = "basicVertexColorsTransparent"
type RenderingMode = "normal"

type GeometryData = {
  position?: Float32Array
  uv?: Float32Array
  normal?: Float32Array
  index?: number[]
  color?: Uint8Array
}

/**
 * Object to be rendered by the designmode rendering engine
 */
export type RenderedObject = {
  id: string
  geometryData: GeometryData

  /**
   * World transform of the object. Will be applied to the geometryData
   */
  transform: Transform

  /**
   * Name of the spec to use for this object
   */
  spec: RenderingSpec

  /**
   * mode within the given spec to use for this object
   */
  mode: RenderingMode
}
