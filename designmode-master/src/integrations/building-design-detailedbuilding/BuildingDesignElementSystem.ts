import type { ElementSystem } from "src/core/element-systems"
import type { Selectable } from "src/core/elements/element-container-derived-data/selectables"
import { BufferAttribute, Matrix4 } from "three"

export const BuildingDesignElementSystem: ElementSystem = {
  generateSelectables: (container) => {
    const selectables: Selectable[] = []
    for (const child of container.element.children ?? []) {
      const matrix = child.transform ? new Matrix4().fromArray(child.transform) : undefined
      const childContainer = container.childrenByUrn.get(child.urn)!
      const volumeMesh = childContainer.representations.volumeMesh
      if (volumeMesh) {
        let outlines = childContainer.outlines.getOrCompute()
        if (outlines && matrix) {
          outlines = new Float32Array(outlines)
          new BufferAttribute(outlines, 3).applyMatrix4(matrix)
        }
        let hitbox = volumeMesh
        if (hitbox && matrix) {
          hitbox = hitbox.clone()
          hitbox.applyMatrix4(matrix)
        }
        selectables.push({
          target: { type: "element", subPath: child.key },
          selectable3d: { hitbox, outlines },
        })
      }
      const terrainShape = childContainer.representations.terrainShape
      if (terrainShape) {
        selectables.push({ target: { type: "element", subPath: child.key }, selectable2d: { terrainShape } })
      }
    }
    return { selectionMode: "custom-selectables-only", selectables }
  },
}
