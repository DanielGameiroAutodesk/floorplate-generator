import type { BufferGeometry } from "three"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { parseUrn } from "src/lib/element/urn"
import type { TerrainShape } from "src/lib/element/types"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { getRegisteredElementSystem } from "src/core/element-systems"
import type { CustomSelectionTarget } from "src/core/selection/selectionTypes"

export const selectablesController = createDerivedDataController(selectablesFromElementContainer)

export type Selectable = {
  target:
    | { type: "element"; subPath?: string } // Selecting this selectable means selecting an element (by path + optional subpath)
    | { type: "custom"; customSelection: CustomSelectionTarget } // Selecting this selectable means selecting an arbitrary, custom non-element entity
  selectable2d?: { terrainShape: TerrainShape }
  selectable3d?: { hitbox: BufferGeometry; outlines?: Float32Array }
}

export type SelectionMode = "merge-whole-subtree" | "custom-selectables-only"

function selectablesFromElementContainer(container: ElementContainer): {
  selectionMode: SelectionMode
  selectables: Selectable[]
} {
  // Check if element system has a custom override
  const systemName = parseUrn(container.element.urn).system
  const elementSystem = getRegisteredElementSystem(systemName)
  if (elementSystem?.generateSelectables) {
    const selectables = elementSystem.generateSelectables(container)
    if (selectables) return selectables
  }

  // Otherwise, use the default logic to generate selectables for the volumeMesh/terrainShape
  const selectables: Selectable[] = []

  const volumeMesh = container.representations.volumeMesh
  if (volumeMesh) {
    const outlines = container.outlines.getOrCompute()
    selectables.push({ target: { type: "element" }, selectable3d: { hitbox: volumeMesh, outlines } })
  }
  const terrainShape = container.representations.terrainShape
  if (terrainShape) {
    selectables.push({ target: { type: "element" }, selectable2d: { terrainShape } })
  }

  return { selectionMode: "merge-whole-subtree", selectables }
}
