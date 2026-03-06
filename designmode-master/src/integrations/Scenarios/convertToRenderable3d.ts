import type { BufferGeometry } from "three"
import { BufferAttribute, Color, Matrix4 } from "three"
import type { Renderable3DInstance } from "src/integrations/renderables/renderable"
import { generateColorArray } from "src/lib/three/geometryUtils"

export function convertScenarioGeometriesToRenderables(geometries: BufferGeometry[]): Renderable3DInstance[] {
  const whiteColor = new Color("white")
  const identityTransform = new Matrix4()

  return geometries.map((geometry) => {
    // Clone to avoid mutating original
    const renderableGeometry = geometry.clone()

    // Add color attribute if missing (required by vertexColors spec)
    if (!renderableGeometry.attributes.color) {
      const vertexCount = renderableGeometry.attributes.position.count
      const colorArray = generateColorArray(whiteColor, vertexCount)
      renderableGeometry.setAttribute("color", new BufferAttribute(colorArray, 3, true))
    }

    return {
      type: "3d",
      geometry: renderableGeometry,
      renderingSpec: "vertexColors",
      transform: identityTransform,
      renderingMode: "normal",
    }
  })
}
