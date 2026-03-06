import { calculateEdgesGeometry } from "src/lib/three/geometryUtils"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { parseUrn } from "src/lib/element/urn"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { getRegisteredElementSystem } from "src/core/element-systems"

export const svgOutlinesController = createDerivedDataController(createSvgOutlines)

function createSvgOutlines(container: ElementContainer): Float32Array | undefined {
  const elementSystem = getRegisteredElementSystem(parseUrn(container.element.urn).system)
  if (elementSystem?.generateSvgOutlines) {
    try {
      const customOutlines = elementSystem.generateSvgOutlines(container.element)
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
