import type { BufferGeometry } from "three"
import { BufferAttribute, Color } from "three"
import type { FormaElement } from "@spacemakerai/element-types"
import { generateColorArray } from "src/lib/three/geometryUtils"
import type { Renderable } from "src/integrations/renderables/renderable"
import { getRenderingSpecForElement } from "src/integrations/renderables/renderable"
import type { ElementContainer } from "src/core/elements/ElementContainer"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

type PartialRenderable = Pick<Renderable, "geometry" | "spec" | "urn">

const computeRenderables3d = (container: ElementContainer): PartialRenderable[] => {
  if (container.element.properties?.category === "terrain") return []

  const volumeMesh = container?.representations.volumeMesh
  return volumeMesh ? renderableFromVolumeMesh(volumeMesh, container.element) : []
}

export const renderables3dController = createDerivedDataController(computeRenderables3d)

function renderableFromVolumeMesh(volumeMesh: BufferGeometry, element: FormaElement): PartialRenderable[] {
  let geometryWithColor = volumeMesh
  if (element.properties?.color && typeof element.properties.color === "string") {
    geometryWithColor = volumeMesh.clone()
    const color = generateColorArray(new Color(element.properties.color), volumeMesh.attributes.position.count)
    geometryWithColor.setAttribute("color", new BufferAttribute(color, 3, true))
  }

  const meshRenderable = {
    spec: getRenderingSpecForElement(volumeMesh, element),
    geometry: geometryWithColor,
    urn: element.urn,
  }

  return [meshRenderable]
}
