import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { BufferGeometry } from "three"
import { setupAndComputeBoundsTree } from "src/lib/three/boundsTree"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const volumeMeshWithGeneratedBoundsTreeController = createDerivedDataController(
  calculateVolumeMeshWithBoundsTree,
)

/**
 * Returns the volumeMesh representation as BufferGeometries with bounds tree computed. This mutates the geometry,
 * as it does not hurt to have it.
 *
 * This is used to do faster raycasts on the geometry
 */
function calculateVolumeMeshWithBoundsTree(container: ElementContainer): BufferGeometry | undefined {
  const volumeMesh = container.representations.volumeMesh
  if (!volumeMesh) return undefined
  setupAndComputeBoundsTree(volumeMesh)
  return volumeMesh
}
