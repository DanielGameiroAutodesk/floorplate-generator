import { useLayoutEffect, useMemo, useState } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { getVisibleNodesSignal } from "src/core/elements/predicates"
import type { Renderable3DInstance } from "./renderable"
import { overrideColorInRenderable } from "./renderable"
import { visualizationSettingsSignal } from "./visualizationSettings"
import type { InternalPath } from "src/lib/element/path"
import { getByAncestorPath } from "src/lib/element/path"
import { IgnoreContext } from "src/core/ignore-context"
import { activeColorOverrideSignal } from "src/integrations/elements-coloring/state"
import { DrawRenderablesByMaterial } from "./DrawRenderablesByMaterial"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import sceneManager from "src/core/three/sceneManager"
import { useComputed } from "@preact/signals"

/**
 * Overview of the rendering pipeline for 3D element geometry:
 *
 * 1. ElementContainer provides RenderableV3Geometry objects (i.e. renderables in untransformed
 *    coordinates) for its volumeMesh and edge outlines
 *
 * 2. ChildNodeContainer gets these RenderableV3Geometry objects from ElementContainer and wraps
 *    them in the node's global transform, to produce RenderableV3Instance objects
 *
 * 3. The <Renderables3d /> component in this file collects RenderableV3Instance objects from all
 *    visible nodes in the current element snapshot, overrides rendering mode/colors according to
 *    current app state, and passes the final overridden renderables to DrawRenderablesByMaterial
 *
 * 4. DrawRenderablesByMaterial groups renderables into buckets according to rendering spec/mode
 *    (which together determine the material), and creates a RenderGroupV3 per bucket/material
 *
 * 5. RenderGroupV3 merges the renderable geometry into larger groups, to minimize the number of
 *    render calls to WebGL. However, we don't want everything to merge into one huge group, as this
 *    would lead to costly rebuilding of the merged geometry on every proposal change. RenderGroupV3
 *    therefore creates a number of smaller groups that tries to strike a balance between minimizing
 *    render calls and making geometry updates cheap
 *
 * 6. For each group of geometry in RenderGroupV3, we construct a BatchedMesh from three.js. The
 *    BatchedMesh takes care of merging the buffers together, applying transforms on GPU, and also
 *    supports cheap instantiation of several copies of the same unique geometry with different
 *    transforms. We use a wrapper class BatchedMeshForRenderables for bookkeeping of the various
 *    geometry and instance IDs in the three.js BatchedMesh
 */

export function Renderables3d() {
  const proposal = useComputed(
    () => elementState.EXPERIMENTAL_previewProposalSignal.value ?? elementState.currentProposalSignal.value,
  ).value

  const getVisibleNodes = getVisibleNodesSignal.value
  const visualizationSettings = visualizationSettingsSignal.value

  const faintPaths = IgnoreContext.idsNotInContextSignal.value
  const colorOverrides = activeColorOverrideSignal.value

  const [sceneGroup] = useState(new DrawRenderablesByMaterial())

  const overrideRendering = useMemo(() => {
    return (r: Renderable3DInstance, path: InternalPath): Renderable3DInstance => {
      if (faintPaths.has(path)) {
        return { ...r, renderingMode: "faint" }
      }
      const supportsColorOverride = r.renderingSpec !== "constraintFace"
      if (supportsColorOverride) {
        const color = getByAncestorPath(path, colorOverrides)
        if (color) return overrideColorInRenderable(r, color)
      }
      return r
    }
  }, [colorOverrides, faintPaths])

  const visibleNodes = useMemo(
    () =>
      getVisibleNodes(proposal).map((node) => ({
        path: node.path,
        renderables: node.allRenderables3d(visualizationSettings).getOrCompute(),
      })),
    [getVisibleNodes, proposal, visualizationSettings],
  )

  const renderables = useMemo(
    () => visibleNodes.flatMap(({ path, renderables }) => renderables.map((r) => overrideRendering(r, path))),
    [visibleNodes, overrideRendering],
  )

  useLayoutEffect(() => {
    sceneGroup.update(renderables)
    sceneManager.render(true)
  }, [renderables, sceneGroup])

  return useObjectLifecycle(sceneGroup.sceneGroup)
}
