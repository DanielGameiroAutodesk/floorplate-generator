import { Color } from "three"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"

export const cutTerrainMaterial = new LineMaterial({
  color: new Color("#56565c").getHex(),
  linewidth: 3,
  userData: { preventClipping: true },
  worldUnits: false,
})

export const cutElementMaterial = new LineMaterial({
  color: new Color("#65656b").getHex(),
  linewidth: 2,
  userData: { preventClipping: true },
  worldUnits: false,
})
