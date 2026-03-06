import { computed } from "@preact/signals"
import { SideHandles, TopHandle } from "./handling/Handles"
import {
  selectedSectionBoxSignal,
  setSectionBoxPreviewSignal,
  commitSelectedSectionBox,
  showOutlineSignal,
  isEditingSignal,
} from "src/integrations/section-box/state"
import { toolAPI } from "src/core/toolsState"
import { rotateSectionBoxToolCfg } from "./toolbar/SectionBoxToolbar"
import type { SectionBox } from "./sectionBox"
import { trackEditSectionBox } from "src/integrations/section-box/analytics"

const visualizeHandlesSignal = computed(() => {
  const rotationToolEnabled = toolAPI.currentToolSignal.value.id === rotateSectionBoxToolCfg.id
  const showOutline = showOutlineSignal.value
  const isEditing = isEditingSignal.value
  return showOutline && !rotationToolEnabled && !isEditing
})

export function SectionBoxHandles() {
  const sectionBox = selectedSectionBoxSignal.value
  const visualizeHandles = visualizeHandlesSignal.value

  const onComplete = (sectionBox: SectionBox) => {
    commitSelectedSectionBox(sectionBox)
    trackEditSectionBox("move")
  }

  const onCancel = () => setSectionBoxPreviewSignal(undefined)

  if (!sectionBox || !visualizeHandles) return null
  return (
    <>
      <SideHandles
        sectionBox={sectionBox.box}
        onComplete={onComplete}
        onCancel={onCancel}
        previewSectionBox={setSectionBoxPreviewSignal}
      />
      <TopHandle
        sectionBox={sectionBox.box}
        onComplete={onComplete}
        onCancel={onCancel}
        previewSectionBox={setSectionBoxPreviewSignal}
      />
    </>
  )
}
