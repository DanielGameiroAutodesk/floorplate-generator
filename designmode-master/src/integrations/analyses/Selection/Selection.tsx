import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { useRecoilState, useRecoilValue } from "recoil"
import type { SelectableAnalysisType } from "./analysis-selection-state"
import {
  activeSelectableAreasState,
  areaSelectionOpenState,
  DefaultArea,
  defaultAreaSelectedState,
  selectableAreasSignal,
  useDefaultAnalysisType,
  useSyncActiveSelectableAreas,
} from "./analysis-selection-state"
import styles from "./Selection.module.pcss"
import { SelectionDialog } from "./SelectionDialog"
import { useEnclosingCircleOfSelection } from "./useEnclosingCircleOfSelection"
import { ClickOutside } from "src/lib/components/ClickOutside"
import { proposalIdSignal, viewRevisionSignal } from "src/core/proposal"
import { useComputed } from "@preact/signals"
import { useTranslator } from "src/i18n"

export function Selection({ analysisType }: { analysisType: SelectableAnalysisType }) {
  const t = useTranslator()
  const [isOpen, setOpen] = useRecoilState(areaSelectionOpenState)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [popout, setPopout] = useState<HTMLElement | null>(null)
  const activeSelectableAreas = useRecoilValue(activeSelectableAreasState(proposalIdSignal.value))
  const setEnclosingCircleLogicDisabled = useEnclosingCircleOfSelection(analysisType)
  const defaultAreaSelected = useRecoilValue(defaultAreaSelectedState(proposalIdSignal.value))
  useDefaultAnalysisType()
  useSyncActiveSelectableAreas()

  const selectionButtonTitle = useMemo(() => {
    if (defaultAreaSelected === DefaultArea.EntireSite) return "Entire model"
    if (defaultAreaSelected === DefaultArea.CustomCircle) return "Custom circle"
    return `Selection (${activeSelectableAreas.size})`
  }, [activeSelectableAreas.size, defaultAreaSelected])

  useEffect(() => {
    const close = () => {
      setOpen(false)
    }
    const open = () => {
      setOpen(true)
    }

    popout?.addEventListener("weave-menu-container-close", close)
    window.addEventListener("forma/analysis-menu/area-select-open", open)
    return () => {
      popout?.removeEventListener("weave-menu-container-close", close)
      window.removeEventListener("forma/analysis-menu/area-select-open", open)
    }
  }, [setOpen, popout])

  const isDisabled = useComputed(() => {
    switch (viewRevisionSignal.value) {
      case "revision-edit-access":
        if (selectableAreasSignal.value.length <= 0) return true
        return false
      case "revision-view-only":
        return true
      case "view-only":
        return true
      case "current":
        return false
      case "no-access":
        return true
    }
  }).value

  const close = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    },
    [setOpen, isOpen],
  )

  return (
    <ClickOutside onClickOutside={close}>
      <div className={styles.wrapper} onKeyDown={onKeyDown}>
        <button
          ref={buttonRef}
          className={styles.button}
          disabled={isDisabled}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          <div className={styles.buttonContent}>
            <span>{selectionButtonTitle}</span>
            <SelectionIcon></SelectionIcon>
          </div>
        </button>
        {isOpen && (
          <div onClick={(e) => e.stopPropagation()}>
            <weave-menu-container
              ref={(el) => setPopout(el)}
              title={t(($) => $.analysis.selectionTitle)}
              right={-8}
              top={30}
              open={isOpen}
            >
              <SelectionDialog
                setEnclosingCircleLogicDisabled={setEnclosingCircleLogicDisabled}
                onClose={() => setOpen(false)}
                analysisType={analysisType}
              ></SelectionDialog>
            </weave-menu-container>
          </div>
        )}
      </div>
    </ClickOutside>
  )
}

function SelectionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.5 5C3.5 5.828 4.172 6.5 5 6.5C5.828 6.5 6.5 5.828 6.5 5C6.5 4.172 5.828 3.5 5 3.5C4.172 3.5 3.5 4.172 3.5 5ZM9.5 5C9.5 5.828 10.172 6.5 11 6.5C11.828 6.5 12.5 5.828 12.5 5C12.5 4.172 11.828 3.5 11 3.5C10.172 3.5 9.5 4.172 9.5 5ZM11 12.5C10.172 12.5 9.5 11.828 9.5 11C9.5 10.172 10.172 9.5 11 9.5C11.828 9.5 12.5 10.172 12.5 11C12.5 11.828 11.828 12.5 11 12.5ZM3.5 11C3.5 11.828 4.172 12.5 5 12.5C5.828 12.5 6.5 11.828 6.5 11C6.5 10.172 5.828 9.5 5 9.5C4.172 9.5 3.5 10.172 3.5 11Z"
        fill="#808080"
      />
    </svg>
  )
}
