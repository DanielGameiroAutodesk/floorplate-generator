import {
  DEFAULT_BOX_ID,
  findSectionBox,
  removeSectionBoxFromList,
  selectedSectionBoxSignal,
  setSectionBoxesSignal,
  setSelectedSectionBoxSignal,
  type SectionBoxItem,
} from "src/integrations/section-box/state"
import styles from "./SectionBoxRow.module.pcss"
import { putSectionBox, deleteSectionBox } from "src/integrations/section-box/sectionBoxApiInterface"
import { editAccessLevelSignal } from "src/core/edit-access-state"
import { trackDeleteSectionBox, trackSelectSectionBox } from "src/integrations/section-box/analytics"
import { useTranslator } from "src/i18n"

const CheckedIcon = () => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.18021 12L2 8.1129L3.29587 6.8214L6.15699 9.4647L12.6791 3L14 4.2681L6.18021 12Z"
        fill="#0696D7"
      />
    </svg>
  )
}

const updateSectionBox = (updatedSectionBox: SectionBoxItem) => {
  // Update the name of the section box
  setSectionBoxesSignal((prev) =>
    (prev ?? []).map((sectionBox) => {
      if (sectionBox.id === updatedSectionBox.id) return updatedSectionBox
      return sectionBox
    }),
  )

  // Update the name of the section box on the server
  void putSectionBox(updatedSectionBox)
}

const onDelete = (id: string) => () => {
  const activeSectionBox = selectedSectionBoxSignal.peek()
  const isEnabled = activeSectionBox?.id === id
  // If section box is active and it was enabled, then disable it
  if (isEnabled) {
    setSelectedSectionBoxSignal({ ...activeSectionBox, id: DEFAULT_BOX_ID })
  }
  removeSectionBoxFromList(id)
  void deleteSectionBox(id)
  trackDeleteSectionBox()
}

type SectionBoxRowProps = {
  id: string
  name: string
}

export function SectionBoxRow({ id, name }: SectionBoxRowProps) {
  const isDisabled = editAccessLevelSignal.value !== "edit"

  // Update the name of the section box
  const onUpdateName = (id: string) => (e: CustomEvent<{ value: string }>) => {
    const sectionBox = findSectionBox(id)
    if (!sectionBox) return
    updateSectionBox({ ...sectionBox, name: e.detail.value })
  }

  const onItemSelect = (id: string) => () => {
    const sectionBox = findSectionBox(id)
    if (!sectionBox) return
    trackSelectSectionBox()
    setSelectedSectionBoxSignal(sectionBox)
  }

  const t = useTranslator()

  return (
    <div data-testid="section-box-row" className={styles.RowButton} onClick={onItemSelect(id)}>
      {isDisabled ? (
        <div className={styles.DisplayText} data-selected={selectedSectionBoxSignal.value?.id === id}>
          {name}
        </div>
      ) : (
        <>
          <div className={styles.RowItemIcon}>
            {selectedSectionBoxSignal.value?.id === id ? (
              <CheckedIcon />
            ) : (
              <div className={styles.UncheckedRowItem}></div>
            )}
          </div>
          <weave-editable
            doubleclick
            className={styles.EditableInput}
            onChange={onUpdateName(id)}
            data-selected={selectedSectionBoxSignal.value?.id === id}
          >
            {name}
          </weave-editable>
          <weave-tooltip text={t(($) => $.sectionBox.deleteButton)} nub="down-right">
            <button
              style={{ padding: "0.4rem 0.6rem 0.4rem 0rem" }}
              data-testid="delete-section-box-button"
              className={styles.Button}
              onClick={onDelete(id)}
            >
              <weave-close />
            </button>
          </weave-tooltip>
        </>
      )}
    </div>
  )
}
