import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { VisualizationSettings } from "src/lib/visualizationSettings"
import { getGFAUnitColor } from "src/lib/visualizationSettings"
import { generateColorArray } from "src/lib/three/geometryUtils"
import { BufferAttribute, BufferGeometry, Color } from "three"
import { isDefined } from "src/lib/array"
import type { Renderable } from "src/integrations/renderables/renderable"
import { createParameterizedDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const renderables3dForUnitsController = createParameterizedDerivedDataController(computeRenderableUnits)

function computeRenderableUnits(visualizationSettings: VisualizationSettings) {
  return (node: ChildNodeContainer): Renderable[] | undefined => {
    const unitVisualization = node.units.getOrCompute()

    // Temp hack to color 3d sketch floors
    if (!isDefined(unitVisualization)) {
      if (
        visualizationSettings.buildings.mode === "functions" &&
        node.elementContainer.element.properties?.functionId
      ) {
        return overrideRenderablesWithFunctionColor(
          visualizationSettings,
          node.elementContainer.element.properties.functionId,
          node,
        )
      }
      return undefined
    }

    return unitVisualization.map((unit) => {
      const color = getGFAUnitColor(unit.info, visualizationSettings)
      const colorArray = generateColorArray(new Color(color), unit.geo.position.length / 3)
      const geo = new BufferGeometry()
      geo.setAttribute("position", new BufferAttribute(unit.geo.position, 3))
      geo.setAttribute("normal", new BufferAttribute(unit.geo.normal, 3))
      geo.setAttribute("color", new BufferAttribute(colorArray, 3, true))
      geo.setIndex([...Array(unit.geo.position.length / 3).keys()])

      return { id: node.path, toplevel: node.path, geometry: geo, spec: "vertexColors" }
    })
  }
}

function overrideRenderablesWithFunctionColor(
  visualizationSettings: VisualizationSettings,
  functionId: string,
  node: ChildNodeContainer,
): Renderable[] {
  const color = new Color(visualizationSettings?.buildings?.functionColors[functionId] || "#ffffff")

  const rendeables = node.renderables3d.getOrCompute()
  return rendeables.map((r) => {
    const transparent = r.geometry.attributes?.color?.itemSize === 4
    const geo = r.geometry.clone()
    if (!geo.getIndex()) {
      geo.setIndex([...Array(r.geometry.getAttribute("position").count).keys()])
    }

    if (transparent) {
      geo.setAttribute(
        "color",
        new BufferAttribute(generateColorArray(color, r.geometry.getAttribute("position").count, 0.5), 4, true),
      )
      return { ...r, geometry: geo }
    } else {
      geo.setAttribute(
        "color",
        new BufferAttribute(generateColorArray(color, r.geometry.getAttribute("position").count), 3, true),
      )
      return { ...r, geometry: geo }
    }
  })
}
