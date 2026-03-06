import type { ElementContainer } from "src/core/elements/ElementContainer"
import { parseUrn } from "src/lib/element/urn"
import { getRegisteredElementSystem } from "src/core/element-systems"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import type { Surface } from "./surface"

export const areaStatsSurfacesController = createDerivedDataController(computeSurfaces)

function computeSurfaces(container: ElementContainer): Surface[] {
  const systemName = parseUrn(container.element.urn).system
  const elementSystem = getRegisteredElementSystem(systemName)
  if (elementSystem?.generateAreaStatsSurfaces) {
    return elementSystem.generateAreaStatsSurfaces(container) ?? []
  }
  return []
}
