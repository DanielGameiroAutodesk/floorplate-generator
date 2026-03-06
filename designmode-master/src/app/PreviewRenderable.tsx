import { GeometryConstants } from "src/lib/three/geometryUtils"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { previewHighlightFillSignal, previewRenderablesSignal, type RenderableV2 } from "src/core/preview-element-state"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import sceneManager from "src/core/three/sceneManager"
import { useLayoutEffect } from "preact/compat"
import { HighlightMesh } from "src/integrations/renderables/HighlightMesh"
import { useState } from "preact/hooks"

const renderGroup3d = new RenderGroup("renderables-3d-preview")
const renderGroup2d = new RenderGroup("renderables-2d-preview")

export default function PreviewRenderable() {
  const renderables = previewRenderablesSignal.value
  const highlighted = previewHighlightFillSignal.value
  const [mesh] = useState(new HighlightMesh())

  useLayoutEffect(() => {
    mesh.update(highlighted)
  }, [highlighted, mesh])

  useLayoutEffect(() => {
    const renderableWithAppliedTranform = (r: RenderableV2) =>
      GeometryConstants.IDENTITY.equals(r.matrix) ? r : { ...r, geometry: r.geometry.clone().applyMatrix4(r.matrix) }
    const renderables3dWithAppliedTransforms = renderables
      .filter((r) => r.scene === "3d")
      .map((r) => renderableWithAppliedTranform(r))
    const renderables2dWithAppliedTransforms = renderables
      .filter((r) => r.scene === "2d")
      .map((r) => {
        const matrix = r.matrix.clone()
        matrix.elements[14] = 0 // Assumes we're not rotating X/Y. Just set all to Z=0 for now.
        return renderableWithAppliedTranform({ ...r, matrix })
      })
    renderGroup3d.update(renderables3dWithAppliedTransforms)
    renderGroup2d.update(renderables2dWithAppliedTransforms)
  }, [renderables])

  useObjectLifecycle(renderGroup3d)
  useObjectLifecycle(renderGroup2d, true, sceneManager.overlay.scene)
  useObjectLifecycle(mesh)

  return null
}
