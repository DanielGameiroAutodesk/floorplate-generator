import { DashedLineMaterial } from "src/lib/three/materials/DashedLineMaterial"
import { AlwaysDepth, Color } from "three"
import { colors } from "src/lib/colors"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"

export const dashedMaterial = new DashedLineMaterial({
  color: new Color(colors.borderAccent).getHex(),
  resolution: screenResolutionVector,
  depthFunc: AlwaysDepth,
  linewidth: 2,
})
export const solidMaterial = new LineMaterial({
  color: new Color(colors.borderAccent).getHex(),
  resolution: screenResolutionVector,
  depthFunc: AlwaysDepth,
  linewidth: 2,
})
export const lockedMaterial = new LineMaterial({
  color: new Color(colors.gray40).getHex(),
  resolution: screenResolutionVector,
  depthFunc: AlwaysDepth,
  linewidth: 1,
})
