import type { Child } from "@spacemakerai/element-types"
import type { TerrainOperation } from "src/core/terrain/terrain-types"

export type ElementClipboardValue = Omit<Child, "key"> & { category?: string }
export type TerrainPadClipboardValue = { type: "terrain_pad"; operation: TerrainOperation }
export type ClipboardValue = ElementClipboardValue | TerrainPadClipboardValue

// Type guard functions
export function isTerrainPad(value: ClipboardValue): value is TerrainPadClipboardValue {
  return "type" in value && value.type === "terrain_pad"
}

export function isElement(value: ClipboardValue): value is ElementClipboardValue {
  return !isTerrainPad(value)
}
