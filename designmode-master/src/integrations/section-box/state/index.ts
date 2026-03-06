import { type SectionBox } from "src/integrations/section-box/tooling/sectionBox"
import { explicitSignal } from "src/lib/signal"

export type SectionBoxItem = {
  id: string
  name: string
  box: SectionBox
}

type UpdateType = {
  path: string
  surface: "roof" | number
}

export const DEFAULT_BOX_ID = "default"
export const DEFAULT_BOX_NAME = "Default"

// Contains the section boxes associated with this authcontext.
export const [sectionBoxesSignal, setSectionBoxesSignal] = explicitSignal<SectionBoxItem[] | undefined>(undefined)
export const removeSectionBoxFromList = (id: string) => {
  setSectionBoxesSignal((prev) => (prev ?? []).filter((sectionBox) => sectionBox.id !== id))
}

// The currently selected section box, if any.
export const [showOutlineSignal, setShowOutlineSignal] = explicitSignal<boolean>(true)
export const [selectedSectionBoxSignal, setSelectedSectionBoxSignal] = explicitSignal<SectionBoxItem | undefined>(
  undefined,
)
export const commitSelectedSectionBox = (sectionBox: SectionBox) => {
  setSectionBoxPreviewSignal(undefined)
  setSelectedSectionBoxSignal({ id: DEFAULT_BOX_ID, name: DEFAULT_BOX_NAME, box: sectionBox })
}

// The section box that is being previewed, but has not been committed.
export const [sectionBoxPreviewSignal, setSectionBoxPreviewSignal] = explicitSignal<SectionBox | undefined>(undefined)

// The state/type of the section box update.
export const [sectionBoxUpdateState, setSectionBoxUpdateState] = explicitSignal<UpdateType | undefined>(undefined)

export const findSectionBox = (id: string) => sectionBoxesSignal.peek()?.find((sectionBox) => sectionBox.id === id)

export const [isEditingSignal, setIsEditingSignal] = explicitSignal(false)
