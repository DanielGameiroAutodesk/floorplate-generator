/** Material overrides and default values for integrated 3d sketch mode */
import { SketchMaterials } from "@spacemakerai/web-sketch-renderer"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { DoubleSide, MeshBasicMaterial, MeshLambertMaterial } from "three"
import type { DefaultSketchMaterials } from "@spacemakerai/web-sketch-renderer/lib/graphics/sketchMaterials"
import { WSRMeshLambertMaterial } from "@spacemakerai/web-sketch-renderer"
import { COMMON_MATERIALS } from "./commonMaterials"

export const I3DS_DEFAULT_FACE_COLOR = "#FFFFFF"
export const I3DS_DEFAULT_FACE_OPACITY = 1.0

/**
 * Multiplication factor for the saturation value of any element color.
 * Lower values desaturate more. 1 doesn't desaturate at all.
 * Always in the range of 0 to 1
 */
export const I3DS_ELEMENT_COLOR_DESATURATION = 1.0 //0.75

/**
 * The amount we linear interpolate (lerp) the L factor of the HSL color
 * of element towards 1.0 (to lighten it). Range is 0 to 1. Higher values
 * lighten more.
 */
export const I3DS_ELEMENT_COLOR_LIGHTENING_FACTOR = 0 // 0.25

/**
 * A scale for how much extra do we desaturate blue colors (since they interfere
 * with selection graphics.). 1.0 is maximum, and 0.0 is no special treatment
 * for blue at all.
 */
export const I3DS_ELEMENT_BLUE_DESATURATION_INFLUENCE = 0.0 // 1.0

/**
 * Overrides WSR builtin styling
 */
export const I3DS_MATERIALS: Partial<DefaultSketchMaterials> = {
  ...COMMON_MATERIALS,
  edgeMaterial: new LineMaterial({
    ...SketchMaterials.defaultEdgeParams,
    color: 0x0696d7,
    linewidth: 0.5,
  }),
  edgeSketchPreselection: new LineMaterial({
    ...SketchMaterials.defaultEdgePreselectionParams,
    color: 0x0696d7,
    linewidth: 2,
  }),
  edgeSketchPreselectionOccluded: new LineMaterial({
    ...SketchMaterials.defaultEdgePreselectionOccludedParams,
    color: 0x0696d7,
    opacity: 0.5,
    linewidth: 1,
  }),
  edgeSketchSelection: new LineMaterial({
    ...SketchMaterials.defaultEdgeSelectionParams,
    color: 0x006eaf,
    linewidth: 2,
  }),
  edgeSketchSelectionOccluded: new LineMaterial({
    ...SketchMaterials.defaultEdgeSelectionOccludedParams,
    color: 0x006eaf,
    opacity: 0.5,
    linewidth: 1,
  }),
  unshadedFaceMaterial: new WSRMeshLambertMaterial({
    ...SketchMaterials.defaultUnshadedFaceMaterial,
    side: DoubleSide,
    color: I3DS_DEFAULT_FACE_COLOR,
  }),
  faceMaterial: new WSRMeshLambertMaterial(
    {
      ...SketchMaterials.defaultFaceMaterial,
      side: DoubleSide,
      color: I3DS_DEFAULT_FACE_COLOR,
    },
    {},
  ),
  faceSketchPreselection: new MeshBasicMaterial({
    ...SketchMaterials.defaultFacePreselectionParams,
    color: 0x9bd5ef,
    opacity: 0.3,
  }),
  faceSketchPreselectionOccluded: new MeshBasicMaterial({
    ...SketchMaterials.defaultFacePreselectionOccludedParams,
    color: 0x9bd5ef,
    opacity: 0.1,
  }),
  faceSketchSelectionOccluded: new MeshLambertMaterial({
    ...SketchMaterials.defaultFaceSelectionOccludedParams,
    color: 0x6ac0e7,
    opacity: 0.1,
  }),
  levelMaterial: new LineMaterial({
    ...SketchMaterials.defaultLevelParams,
    color: "#808080",
    linewidth: 1,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  }),
}
