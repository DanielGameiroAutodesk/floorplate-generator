import { memo } from "preact/compat"
import { Renderables2d } from "src/integrations/renderables/renderables2d"
import SelectionVisuals from "src/integrations/renderables/SelectionVisuals"
import { usePlaceModeSceneVisuals } from "src/integrations/tools-common/PlaceMode/placeModeVisualHook"
import { previewRenderablesSignal } from "src/core/preview-element-state"
import PreviewRenderable from "./PreviewRenderable"
import HighlightedFillRenderables from "src/integrations/renderables/HighlightedFillRenderables"
import { Renderables3d } from "src/integrations/renderables/Renderables3d"
import { AutomationSelectionVisuals } from "src/integrations/building-systems-site-study/iterative/AutomationSelectionVisuals"

export const Renderables = memo(() => {
  usePlaceModeSceneVisuals()

  return (
    <>
      <Renderables2d />
      <Renderables3d />
      <SelectionVisuals />
      <AutomationSelectionVisuals />
      <HighlightedFillRenderables />
      <Renderable3dTogglePreview />
    </>
  )
})

function Renderable3dTogglePreview() {
  const preview = previewRenderablesSignal.value
  return preview.length > 0 ? <PreviewRenderable /> : null
}
