import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import { parseUrn } from "src/lib/element/urn"
import { getRegisteredElementSystem, NO_OVERRIDE } from "src/core/element-systems"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const generateUnitsController = createDerivedDataController(generateUnits)

function generateUnits(container: ElementContainer): BuildingPieceMesh[] | undefined {
  const system = getRegisteredElementSystem(parseUrn(container.element.urn).system)
  if (!system?.generateUnitMeshes) return undefined

  const units = system.generateUnitMeshes(container.element)
  if (units === NO_OVERRIDE) {
    return undefined
  }
  return units
}
