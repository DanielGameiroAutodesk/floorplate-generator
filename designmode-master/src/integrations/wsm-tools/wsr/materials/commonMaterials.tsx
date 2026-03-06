// /** Material overrides and default values for integrated 3d sketch mode */
import { SketchMaterials, type DefaultSketchMaterials } from "@spacemakerai/web-sketch-renderer"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { DoubleSide, MeshLambertMaterial } from "three"
import { WSRMeshLambertMaterial } from "@spacemakerai/web-sketch-renderer"
import { MeshBasicMaterial } from "three"

export const COMMON_MATERIALS: Partial<DefaultSketchMaterials> = {
  faceSketchSelection: new MeshLambertMaterial({
    ...SketchMaterials.defaultFaceSelectionParams,
    color: 0x6ac0e7,
    opacity: 0.5,
  }),
  ghostEdgeMaterial: new LineMaterial({
    ...SketchMaterials.defaultEdgeSelectionParams,
    color: 0x006eaf,
    linewidth: 1,
  }),
  ghostMaterial: new MeshBasicMaterial({
    ...SketchMaterials.defaultFacePreselectionParams,
    color: 0x9bd5ef,
    opacity: 0.3,
  }),
  instanceBoundingBoxSelection: new LineMaterial({
    ...SketchMaterials.defaultInstanceBoundingBoxSelectionParams,
    color: 0x0696d7,
    linewidth: 1,
    dashed: true,
    dashScale: 0.25,
    dashSize: 0.1,
    dashOffset: 0.1,
    gapSize: 0.1,
    alphaToCoverage: true,
    worldUnits: false,
  }),
  instanceBoundingBoxPreselection: new LineMaterial({
    ...SketchMaterials.defaultInstanceBoundingBoxSelectionParams,
    color: 0x30bbf9,
    linewidth: 1,
    dashed: true,
    dashScale: 0.25,
    dashSize: 0.1,
    dashOffset: 0.1,
    gapSize: 0.1,
    alphaToCoverage: true,
    worldUnits: false,
  }),
  instanceInContextBoxLineMaterial: new LineMaterial({
    ...SketchMaterials.defaultInstanceInContextBoxLineParams,
    color: 0x81aabb,
    linewidth: 1,
    dashed: true,
    dashScale: 0.4,
    dashSize: 0.1,
    dashOffset: 0.1,
    gapSize: 0.05,
    alphaToCoverage: true,
    worldUnits: false,
  }),
  instanceEdgeSelection: new LineMaterial({
    ...SketchMaterials.defaultInstanceEdgeSelectionParams,
    color: 0x0696d7,
    linewidth: 1,
  }),
  instanceEdgePreselection: new LineMaterial({
    ...SketchMaterials.defaultInstanceEdgeSelectionParams,
    color: 0x030bbf9,
    linewidth: 1,
  }),
  instanceFaceSelection: new WSRMeshLambertMaterial(
    {
      ...SketchMaterials.defaultFaceMaterial,
      side: DoubleSide,
      color: 0x9bd5ef,
      opacity: 0.3,
      transparent: true,
      defines: {
        STIPPLING: 1,
        BACKFACE_DIAGNOSTICS: 0,
      },
    },
    {},
  ),
  instanceFacePreselection: new WSRMeshLambertMaterial(
    {
      ...SketchMaterials.defaultFaceMaterial,
      side: DoubleSide,
      color: 0x9bd5ef,
      opacity: 0.3,
      transparent: true,
      defines: {
        STIPPLING: 1,
        BACKFACE_DIAGNOSTICS: 0,
      },
    },
    {},
  ),
}
