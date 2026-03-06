import { useLayoutEffect, useState } from "preact/hooks"
import { useComputed } from "@preact/signals"
import { DrawRenderablesByMaterial } from "src/integrations/renderables/DrawRenderablesByMaterial"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import sceneManager from "src/core/three/sceneManager"
import { scenarioRenderablesSignal } from "./scenario"
import { convertScenarioGeometriesToRenderables } from "./convertToRenderable3d"
import { scenarioChildNodesSignal, SCENARIO_MODEL_REP_ID_CUSTOM_DATA_KEY } from "./scenarioElementUploadState"
import { activeColorOverrideSignal } from "src/integrations/elements-coloring/state"
import { overrideColorInRenderable } from "src/integrations/renderables/renderable"
import { getByAncestorPath } from "src/lib/element/path"

export function ScenarioRenderables3d() {
  const [sceneGroup] = useState(() => new DrawRenderablesByMaterial())

  const renderables = useComputed(() => {
    if (!scenarioRenderablesSignal.value) {
      return []
    }
    const geometries = scenarioRenderablesSignal.value
    const baseRenderables = convertScenarioGeometriesToRenderables(geometries)
    const colorOverrides = activeColorOverrideSignal.value
    if (colorOverrides.size === 0) return baseRenderables

    const childNodes = scenarioChildNodesSignal.value
    if (!childNodes) return baseRenderables

    const pathByModelId = new Map<string, string>()
    for (const node of childNodes) {
      const modelRepId = node.elementContainer.customData?.[SCENARIO_MODEL_REP_ID_CUSTOM_DATA_KEY] as string | undefined
      if (modelRepId) {
        pathByModelId.set(modelRepId, node.path)
      }
    }

    return baseRenderables.map((renderable) => {
      const modelRepId = renderable.geometry.userData?.modelRepId as string | undefined
      if (!modelRepId) return renderable

      const path = pathByModelId.get(modelRepId)
      if (!path) return renderable

      const color = getByAncestorPath(path, colorOverrides)
      if (color) return overrideColorInRenderable(renderable, color)
      return renderable
    })
  }).value

  useLayoutEffect(() => {
    sceneGroup.update(renderables)
    sceneManager.render(true)
  }, [renderables, sceneGroup])

  return useObjectLifecycle(sceneGroup.sceneGroup)
}
