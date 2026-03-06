import { AlwaysDepth, Color } from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { DashedLineMaterial } from "src/lib/three/materials/DashedLineMaterial"
import { screenResolutionVector } from "src/core/three/sceneManager"

export const SNAPPING_ACTIVE_COLOR = new Color("#E30288")
export const SNAPPING_PASSIVE_COLOR = new Color("#FF0097")
export const SNAPPING_XAXIS_COLOR = new Color("#FF0000")
export const SNAPPING_YAXIS_COLOR = new Color("#00FF00")
export const SNAPPING_ZAXIS_COLOR = new Color("#0000FF")

const baseLineParams = {
  color: SNAPPING_ACTIVE_COLOR.getHex(),
  linewidth: 1,
  depthFunc: AlwaysDepth,
  transparent: true,
  opacity: 1,
  dashed: false,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -4,
  polygonOffsetFactor: -4,
}

const baseLineParamsZAxis = {
  ...baseLineParams,
  color: SNAPPING_ZAXIS_COLOR.getHex(),
}

export const ACTIVE_SNAPPING_LINE_MATERIAL = new LineMaterial({
  ...baseLineParams,
})

export const ACTIVE_SNAPPING_LINE_MATERIAL_ZAXIS = new LineMaterial({
  ...baseLineParamsZAxis,
})

export const BOLD_SNAPPING_LINE_MATERIAL = new LineMaterial({
  ...baseLineParams,
  linewidth: 1.5,
})

export const BOLD_SNAPPING_LINE_MATERIAL_ZAXIS = new LineMaterial({
  ...baseLineParamsZAxis,
  linewidth: 1.5,
})

export const DASHED_SNAPPING_LINE_MATERIAL = new DashedLineMaterial({
  ...baseLineParams,
  opacity: 0.5,
  dashed: true,
  dashSize: 2,
  gapSize: 2,
  dashScale: 3,
})

export const ADDABLE_SNAPPING_LINE_MATERIAL = new DashedLineMaterial({
  ...baseLineParams,
  color: SNAPPING_PASSIVE_COLOR.getHex(),
  opacity: 0.3,
  dashed: true,
  dashSize: 1,
  gapSize: 1,
  dashScale: 3,
})

export const ADDABLE_SNAPPING_LINE_MATERIAL_ZAXIS = new DashedLineMaterial({
  ...baseLineParamsZAxis,
  opacity: 0.3,
  dashed: true,
  dashSize: 1,
  gapSize: 1,
  dashScale: 3,
})

export const PASSIVE_SNAPPING_LINE_MATERIAL = new LineMaterial({
  ...baseLineParams,
  color: SNAPPING_PASSIVE_COLOR.getHex(),
  opacity: 0.15,
  // dashed: true,
  // dashSize: 2,
  // gapSize: 2,
  // dashScale: 3,
  linewidth: 1,
})

export const PASSIVE_SNAPPING_LINE_MATERIAL_ZAXIS = new LineMaterial({
  ...baseLineParamsZAxis,
  opacity: 0.15,
  // dashed: true,
  // dashSize: 2,
  // gapSize: 2,
  // dashScale: 3,
  linewidth: 1,
})
