import type { FormaElement } from "@spacemakerai/element-types"
import type { Circle } from "src/integrations/analyses/Selection/analysis-selection-state"
import { isTerrainElement } from "src/core/terrain/terrain-types"
import { elementState } from "src/core/elements/ElementState"

export function getTerrainElement(proposalElement: FormaElement): FormaElement | undefined {
  for (const child of proposalElement.children ?? []) {
    const childElement = elementState.currentSnapshot.peek().getFormaElement(child.urn)
    if (childElement && isTerrainElement(childElement)) {
      return childElement
    }
  }
  return undefined
}

export function circleInsideTerrain(terrainElement: FormaElement, circle: Circle): boolean {
  if (!terrainElement?.properties) return false
  if (!terrainElement.properties?.bbox) return false
  if (!circle) return false
  if (!terrainElement.properties?.geoReference?.refPoint) return false
  const [[x_min, y_min], [x_max, y_max]] = terrainElement.properties.bbox
  const refPoint = terrainElement.properties.geoReference.refPoint
  const centerXGlobal = circle.x + refPoint[0]
  const centerYGlobal = circle.y + refPoint[1]

  if (centerXGlobal - circle.radius < x_min) return false
  else if (centerXGlobal + circle.radius > x_max) return false
  else if (centerYGlobal - circle.radius < y_min) return false
  else if (centerYGlobal + circle.radius > y_max) return false
  return true
}
