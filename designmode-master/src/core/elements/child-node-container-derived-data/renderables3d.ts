import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { Renderable } from "src/integrations/renderables/renderable"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const renderables3dController = createDerivedDataController(computeRenderables3d)

function computeRenderables3d(node: ChildNodeContainer): Renderable[] {
  const partialRenderables = node.elementContainer.renderable3d.getOrCompute()
  return partialRenderables.map((partialRenderable) => {
    return {
      ...partialRenderable,
      geometry: partialRenderable.geometry.clone().applyMatrix4(node.globalMatrix),
      id: node.path,
      toplevel: node.path, // TODO, should be "toplevel path"
    }
  })
}
