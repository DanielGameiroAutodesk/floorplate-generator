import { useCallback, useMemo } from "preact/compat"
import sceneManager from "src/core/three/sceneManager"
import type { Renderable } from "./renderable"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import RenderGroup from "./RenderGroup"
import { IgnoreContext } from "src/core/ignore-context"
import { activeColorOverrideSignal } from "src/integrations/elements-coloring/state"
import type { InternalPath } from "src/lib/element/path"
import { getByAncestorPath } from "src/lib/element/path"
import { BufferAttribute } from "three"
import { elementState } from "src/core/elements/ElementState"
import { getVisibleNodesSignal } from "src/core/elements/predicates"

function colorRenderable(
  uncolored: Renderable,
  path: InternalPath,
  activeColorOverrides: Map<InternalPath, Uint8Array> | undefined,
): Renderable {
  if (!activeColorOverrides) return uncolored
  let colorOverride = getByAncestorPath(path, activeColorOverrides)

  if (!colorOverride || !uncolored.geometry.attributes.color) return uncolored
  if (colorOverride.length === 4 && colorOverride[3] === 255) {
    // don't render opaque meshes as transparent
    colorOverride = colorOverride.slice(0, 3)
  }

  const coloredGeometry = uncolored.geometry.clone()
  const vertices = coloredGeometry.getAttribute("position").count
  const colorArray = (coloredGeometry.getAttribute("color").array as Uint8Array) || new Uint8Array(vertices * 4)
  for (let i = 0; i < colorArray.length; i += 4) {
    colorArray.set(colorOverride, i)
  }
  coloredGeometry.setAttribute("color", new BufferAttribute(colorArray, 4, true))
  return { ...uncolored, geometry: coloredGeometry, spec: "basicVertexColorsTransparent" }
}

export function Renderables2d() {
  const faintIds = IgnoreContext.idsNotInContextSignal.value
  const activeColorOverrides = activeColorOverrideSignal.value

  const proposal = elementState.currentProposalSignal.value
  const getVisibleNodes = getVisibleNodesSignal.value

  const overrideRenderables = useCallback(
    (r: Renderable, path: InternalPath): Renderable => {
      if (faintIds.has(r.id)) {
        return { ...r, mode: "faint" }
      } else {
        return colorRenderable(r, path, activeColorOverrides)
      }
    },
    [activeColorOverrides, faintIds],
  )

  const batch = useMemo(() => {
    let renderables: Renderable[] = []

    for (let node of getVisibleNodes(proposal)) {
      for (let renderable of node.renderables2d.getOrCompute() ?? []) {
        renderables.push(overrideRenderables(renderable, node.path))
      }
    }

    const filteredReversedRenderables: Renderable[] = []
    for (let i = renderables.length - 1; i >= 0; i--) {
      filteredReversedRenderables.push(renderables[i])
    }

    return new RenderGroup("renderables2d", filteredReversedRenderables)
  }, [getVisibleNodes, proposal, overrideRenderables])

  useObjectLifecycle(batch, true, sceneManager.overlay.scene)

  return null
}
