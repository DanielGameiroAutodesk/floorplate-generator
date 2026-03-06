import { BufferAttribute, BufferGeometry, Color } from "three"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { Renderable3DGeometry } from "src/integrations/renderables/renderable"
import { getRenderingSpecForElement } from "src/integrations/renderables/renderable"
import type { FormaElement } from "forma-elements"
import { generateColorArray } from "src/lib/three/geometryUtils"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { getRegisteredElementSystem } from "src/core/element-systems"
import { parseUrn } from "src/lib/element/urn"

export const volumeMeshRenderables3dController = createDerivedDataController(createVolumeMeshRenderables3d)
export const edgeOutlinesRenderables3dController = createDerivedDataController(createEdgeOutlinesRenderables3d)

function renderableFromVolumeMesh(originalGeometry: BufferGeometry, element: FormaElement): Renderable3DGeometry {
  let mutableGeometry: BufferGeometry | undefined

  // Override the color attribute with a uniform color array if specified by the element properties
  if (element.properties?.color && typeof element.properties.color === "string") {
    mutableGeometry ??= originalGeometry.clone()
    const color = generateColorArray(new Color(element.properties.color), originalGeometry.attributes.position.count)
    mutableGeometry.setAttribute("color", new BufferAttribute(color, 3, true))
  } else {
    // Otherwise, we keep the color array from the original geometry. As these BufferGeometries
    // eventually get merged into BatchedMeshes for rendering, we need to ensure that all geometries
    // are consistent in which attributes they have and whether they have an index (see the check in
    // validateRenderableInstanceOrThrow() in RenderGroupV3.ts). We therefore ensure that the
    // pre-existing color attribute is correctly set to have normalized = true
    if (!originalGeometry.attributes.color.normalized) {
      mutableGeometry ??= originalGeometry.clone()
      const colorAttribute = originalGeometry.attributes.color.clone()
      colorAttribute.normalized = true
      mutableGeometry.setAttribute("color", colorAttribute)
    }
  }

  // Finally, ensure the geometry always has an index (again, for consistency)
  if (!originalGeometry.getIndex()) {
    mutableGeometry ??= originalGeometry.clone()
    mutableGeometry.setIndex([...Array(originalGeometry.attributes.position.count).keys()])
  }

  const geometry = mutableGeometry ?? originalGeometry
  const renderingSpec = getRenderingSpecForElement(geometry, element)
  return { type: "3d", geometry, renderingSpec }
}

function createVolumeMeshRenderables3d(container: ElementContainer): Renderable3DGeometry[] {
  if (container.element.properties?.category === "terrain") return []
  const systemName = parseUrn(container.element.urn).system
  const elementSystem = getRegisteredElementSystem(systemName)
  if (elementSystem?.generateVolumeMeshRenderables3d) {
    const renderable3dGeometry = elementSystem.generateVolumeMeshRenderables3d(container)
    if (renderable3dGeometry) {
      return renderable3dGeometry
    }
  }

  const { volumeMeshWithTransparencySupport, volumeMesh } = container.representations
  if (volumeMeshWithTransparencySupport) {
    const renderables: Renderable3DGeometry[] = []

    renderables.push(renderableFromVolumeMesh(volumeMeshWithTransparencySupport.opaqueGeometry, container.element))

    const transparentRenderable = renderableFromVolumeMesh(
      volumeMeshWithTransparencySupport.transparentGeometry,
      container.element,
    )

    renderables.push({
      ...transparentRenderable,
      renderingSpec: "vertexColorsTransparent",
    })

    return renderables
  }

  if (!volumeMesh) return []
  return [renderableFromVolumeMesh(volumeMesh, container.element)]
}

function createEdgeOutlinesRenderables3d(container: ElementContainer): Renderable3DGeometry[] {
  if (container.element.properties?.category === "terrain") return []
  const outlines = container.outlines.getOrCompute()
  if (!outlines) return []
  return [
    {
      type: "3d",
      geometry: new BufferGeometry().setAttribute("position", new BufferAttribute(outlines, 3)),
      renderingSpec: container.element.properties?.category === "constraints" ? "constraintOutline" : "basicLines",
    },
  ]
}
