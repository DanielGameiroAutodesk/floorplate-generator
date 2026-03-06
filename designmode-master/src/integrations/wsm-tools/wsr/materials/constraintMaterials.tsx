/** Materials and defaults for constraint editing in WSR */
import { SketchMaterials } from "@spacemakerai/web-sketch-renderer"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { Color, MeshBasicMaterial } from "three"
import type { DefaultSketchMaterials } from "@spacemakerai/web-sketch-renderer/lib/graphics/sketchMaterials"
import { COMMON_MATERIALS } from "./commonMaterials"

/**
 * Default face color for constraints
 */
export const CONSTRAINT_DEFAULT_FACE_COLOR = "#dbb1cc"
export const CONSTRAINT_DEFAULT_FACE_OPACITY = 0.5

/**
 * These material overrides are used when editing a constraint.
 */
export const CONSTRAINT_MATERIALS: Partial<DefaultSketchMaterials> = {
  ...COMMON_MATERIALS,
  edgeMaterial: new LineMaterial({
    ...SketchMaterials.defaultEdgeParams,
    color: new Color(0.1, 0.1, 0.4),
    linewidth: 0.7,
  }),
  edgeSketchSelection: new LineMaterial({
    ...SketchMaterials.defaultEdgeSelectionParams,
    color: 0x00ddff,
    linewidth: 1,
  }),
  edgeSketchPreselection: new LineMaterial({
    ...SketchMaterials.defaultEdgePreselectionParams,
    color: 0x00ccee,
    linewidth: 1,
  }),
  faceMaterial: new MeshBasicMaterial({
    ...SketchMaterials.defaultFaceMaterial,
    color: CONSTRAINT_DEFAULT_FACE_COLOR,
    transparent: true,
    opacity: CONSTRAINT_DEFAULT_FACE_OPACITY,
  }),
  faceSketchPreselection: new MeshBasicMaterial({
    ...SketchMaterials.defaultFacePreselectionParams,
    color: 0x9bd5e7,
    opacity: 0.3,
  }),
}
