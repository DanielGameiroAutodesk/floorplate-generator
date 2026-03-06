import { Matrix4 } from "three"
import type { Renderable3DInstance } from "src/integrations/renderables/renderable"
import type { VisualizationSettings } from "src/lib/visualizationSettings"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { createParameterizedDerivedDataController } from "src/core/elements/derived-data/derived-data"

export const allRenderables3dController = createParameterizedDerivedDataController(computeAllRenderables3d)

function computeAllRenderables3d(visualizationSettings: VisualizationSettings) {
  return function (node: ChildNodeContainer): Renderable3DInstance[] {
    const defaultVolumeMeshRenderables = node.elementContainer.volumeMeshRenderables3d
      .getOrCompute()
      .map((r) => ({ ...r, transform: node.globalMatrix }))

    const volumeMeshRenderables: Renderable3DInstance[] =
      visualizationSettings.buildings.mode === "off"
        ? defaultVolumeMeshRenderables
        : (node
            .renderables3dForUnits(visualizationSettings)
            .getOrCompute()
            ?.map((r) => ({
              type: "3d",
              geometry: r.geometry,
              renderingSpec: r.spec,
              transform: new Matrix4(),
            })) ?? defaultVolumeMeshRenderables)

    const outlinesRenderables = node.elementContainer.edgeOutlinesRenderables3d
      .getOrCompute()
      .map((r) => ({ ...r, transform: node.globalMatrix }))

    return [...volumeMeshRenderables, ...outlinesRenderables]
  }
}
