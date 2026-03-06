import { useCallback, useEffect, useLayoutEffect, useRef } from "preact/hooks"
import { useRecoilState } from "recoil"
import { useTranslator } from "src/i18n"
import * as formaUnits from "@spacemakerai/forma-units"
import { dimensionInputDialogState } from "src/integrations/wsm-tools/wsr/integrated/state"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import styles from "./DimensionInputDialog.module.pcss"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import type { DimensionInputType } from "src/integrations/wsm-tools/wsr/integrated/types"
import { useIsImperial } from "src/lib/unitSettings"

const DimensionInputDialog = () => {
  const t = useTranslator()
  const isImperial = useIsImperial()
  const inputRef = useRef<WeaveInputElement>(null)
  const modal = useRef<WeaveModalElement>(null)

  const [dimensionInputDialog, setDimensionInputDialog] = useRecoilState(dimensionInputDialogState)
  const unit = isImperial ? formaUnits.UnitType.ImperialFeetInches : formaUnits.UnitType.MetricMeter

  const setInputFocus = useCallback(() => {
    if (!inputRef.current) return

    inputRef.current.focus()
    inputRef.current.inputEl?.select()
  }, [])

  useLayoutEffect(() => {
    modal.current?.show()
  })

  useEffect(() => {
    if (!inputRef.current || !dimensionInputDialog.isOpen) return

    setInputFocus()
  }, [dimensionInputDialog.isOpen, setInputFocus])

  if (!dimensionInputDialog.isOpen) {
    return null
  }

  const handleInputFocus = (e: FocusEvent) => {
    const inputEl = e.target as HTMLInputElement
    inputEl.value = formaUnits.formatLengthAs(parseFloat(inputEl.value), unit)
  }

  const handleInputKeyDown = (e: KeyboardEvent) => {
    const inputEl = e.target as HTMLInputElement
    let value = parseFloat(inputEl.value)

    switch (e.key) {
      case "Escape":
        e.preventDefault()
        inputEl.blur()
        break
      case "Enter":
        handleSubmit()
        break
      case "ArrowUp":
        e.preventDefault()
        value += 1
        inputEl.value = formaUnits.formatLengthAs(value, unit)
        break
      case "ArrowDown":
        e.preventDefault()
        value -= 1
        inputEl.value = formaUnits.formatLengthAs(value, unit)
        break
    }
  }

  const handleInputBlur = (e: FocusEvent) => {
    const inputEl = e.target as HTMLInputElement
    inputEl.value = formaUnits.formatLength(parseFloat(inputEl.value))
    const result = FormIt.StringConversion.StringToLinearValue(inputEl.value, true)
    if (!result.first) {
      setDimensionInputDialog({ ...dimensionInputDialog })
      return
    }
  }

  const handleClose = () => {
    setDimensionInputDialog((prevState) => ({ ...prevState, isOpen: false }))
  }

  const getDefaultInputValue = (type: DimensionInputType | "") => {
    switch (type) {
      case "offset":
        return formaUnits.formatLength(dimensionInputDialog.offset.defaultValue)
      case "fillet":
        return formaUnits.formatLength(dimensionInputDialog.fillet.defaultValue)
      case "shell":
        return formaUnits.formatLength(dimensionInputDialog.shell.defaultValue)
    }
  }

  const handleSubmit = () => {
    const value = inputRef.current?.value
    const result = FormIt.StringConversion.StringToLinearValue(value!, true)
    if (!result.first) {
      setDimensionInputDialog({ ...dimensionInputDialog })
      return
    }

    switch (dimensionInputDialog.type) {
      case "offset":
        FormIt.Tools.OffsetBody(result.second)
        setDimensionInputDialog({
          ...dimensionInputDialog,
          offset: { ...dimensionInputDialog.offset, defaultValue: result.second },
        })
        break
      case "fillet":
        FormIt.Tools.BlendFacesOrEdges(result.second)
        setDimensionInputDialog({
          ...dimensionInputDialog,
          fillet: { ...dimensionInputDialog.fillet, defaultValue: result.second },
        })
        break
      case "shell":
        FormIt.Tools.ShellBodyOrFaces(result.second)
        setDimensionInputDialog({
          ...dimensionInputDialog,
          shell: { ...dimensionInputDialog.shell, defaultValue: result.second },
        })
        break
    }

    handleClose()
  }

  return (
    <div>
      <weave-modal width="320px" ref={modal} onClose={() => handleClose()} class={"no-margin-padding-clear"}>
        <div slot="title">{dimensionInputDialog.title} </div>
        <div slot="content">
          <div className={styles.FormControl}>
            <div>{dimensionInputDialog.inputLabel}</div>
            <weave-input
              className={styles.DimensionDialogInput}
              type="text"
              value={getDefaultInputValue(dimensionInputDialog.type)}
              ref={inputRef}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
            />
          </div>
        </div>
        <div slot="actions" style={{ gap: "10px" }}>
          <weave-button variant="outlined" onClick={() => handleClose()}>
            {t(($) => $.wsm.buttons.cancel)}
          </weave-button>
          <weave-button variant="solid" onClick={() => handleSubmit()}>
            {t(($) => $.wsm.buttons.apply)}
          </weave-button>
        </div>
      </weave-modal>
    </div>
  )
}

export default DimensionInputDialog
