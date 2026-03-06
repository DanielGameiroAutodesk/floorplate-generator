import { Color } from "three"
import type { PolygonWithHolesXY } from "./geometry/polygonXY"
import { areaOfPolygonWithHoles } from "./geometry/areaOfPolygon"

export const UNIT_PROGRAM_COLORS: Record<string, string> = {
  UNASSIGNED: "#FFFFFF",
  LIVING_UNIT: "#FFFFFF",
  // CORE: "#EEEEEE",
  // CORRIDOR: "#EEEEEE",
  CORE: "#DADADA", // Darkened by THREE.Color
  CORRIDOR: "#DADADA", // Darkened by THREE.Color
  PARKING: "#95989D",
  __default__: "#ffffff",
}

export type VisualizationSettings = {
  buildings: {
    mode: "off" | "functions" | "areas" | "types"
    functionColors: Record<string, string>
    areaSizeBuckets: {
      max: number | null
      color: string
    }[]
  }
}

export type BuildingPieceMesh = {
  info: { functionId?: string; functionName?: string; areaType?: string; area?: number }
  geo: { position: Float32Array; normal: Float32Array }
}

export function getGFAUnitColor(info: BuildingPieceMesh["info"], visualizationSettings: VisualizationSettings): string {
  if (visualizationSettings?.buildings.mode === "functions") {
    if (info.functionName) {
      return visualizationSettings?.buildings?.functionColors[info.functionName] || "#ffffff"
    }
    if (info.functionId) {
      return visualizationSettings?.buildings?.functionColors[info.functionId] || "#ffffff"
    }
    return "#ffffff"
  } else if (visualizationSettings?.buildings.mode === "areas") {
    const bucket = visualizationSettings.buildings.areaSizeBuckets.find(
      (bucket) => bucket.max === null || (info.area ?? 0) < bucket.max,
    )
    return bucket?.color || "#ffffff"
  } else if (visualizationSettings?.buildings.mode === "types") {
    const clr = UNIT_PROGRAM_COLORS[info.areaType || "__default__"]
    // adjusting to SRGB color space
    return "#" + new Color(clr).convertLinearToSRGB().getHexString()
  }
  return "#ffffff"
}

export function getUnitColor(
  unit: { functionId?: string; program?: string },
  polygonsWithHoles: PolygonWithHolesXY[],
  visualizationSettings?: VisualizationSettings,
) {
  if (visualizationSettings?.buildings.mode === "functions") {
    if (unit.functionId) {
      return visualizationSettings?.buildings?.functionColors[unit.functionId] || "#ffffff"
    }
    return "#ffffff"
  } else if (visualizationSettings?.buildings.mode === "areas") {
    const area = polygonsWithHoles.reduce((acc, p) => acc + areaOfPolygonWithHoles(p), 0)
    const bucket = visualizationSettings.buildings.areaSizeBuckets.find(
      (bucket) => bucket.max === null || area < bucket.max,
    )
    return bucket?.color || "#ffffff"
  } else if (visualizationSettings?.buildings.mode === "types") {
    const clr = UNIT_PROGRAM_COLORS[unit.program || "__default__"]
    // adjusting to SRGB color space
    return "#" + new Color(clr).convertLinearToSRGB().getHexString()
  }
  return "#ffffff"
}
