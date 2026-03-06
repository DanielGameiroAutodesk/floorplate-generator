import { calculateEdgesGeometry } from "src/lib/three/geometryUtils"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { parseUrn } from "src/lib/element/urn"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { getRegisteredElementSystem } from "src/core/element-systems"

export const outlinesController = createDerivedDataController(createOutlines)

function createOutlines(container: ElementContainer): Float32Array | undefined {
  // Check for loaded outlines geometry first
  const outlinesGeometry = container.representations.outlinesGeometry
  if (outlinesGeometry) {
    const positions = outlinesGeometry.attributes.position.array
    return positions instanceof Float32Array ? positions : new Float32Array(positions)
  }

  const elementSystem = getRegisteredElementSystem(parseUrn(container.element.urn).system)
  if (elementSystem?.generateEdgeOutlines) {
    try {
      const customOutlines = elementSystem.generateEdgeOutlines(container.element)
      if (customOutlines) return customOutlines
    } catch {
      // Do nothing
    }
  }
  const volumeMesh = container.representations.volumeMesh
  if (volumeMesh) {
    const outlines = calculateEdgesGeometry(volumeMesh)
    return outlines && outlines.length > 0 ? outlines : undefined
  }
}
