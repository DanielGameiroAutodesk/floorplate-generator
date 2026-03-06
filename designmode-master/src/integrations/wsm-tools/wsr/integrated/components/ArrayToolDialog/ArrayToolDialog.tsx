import { useCallback, useLayoutEffect, useRef } from "preact/hooks"

import { useTranslator, type I18nStringProvider } from "src/i18n"

import { atom, useSetRecoilState } from "recoil"

import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import type { ChangeEvent } from "preact/compat"

import styles from "./ArrayToolDialog.module.pcss"

// set up array distance options
enum ArrayDistance {
  TOTAL = "total",
  BETWEEN_2_POINTS = "between-2-points",
}
const arrayDistanceOptions = [
  {
    value: ArrayDistance.TOTAL,
    label: ((t) => t(($) => $.wsm.dialogs.arrayDistanceTotalLength)) satisfies I18nStringProvider,
  },
  {
    value: ArrayDistance.BETWEEN_2_POINTS,
    label: ((t) => t(($) => $.wsm.dialogs.arrayDistanceBetween2Points)) satisfies I18nStringProvider,
  },
]

// set up array type options
enum ArrayType {
  LINEAR = "linear",
  RADIAL = "radial",
}
const arrayTypeOptions = [
  {
    value: "linear",
    label: ((t) => t(($) => $.wsm.dialogs.arrayTypeLinear)) satisfies I18nStringProvider,
  },
  {
    value: "radial",
    label: ((t) => t(($) => $.wsm.dialogs.arrayTypeRadial)) satisfies I18nStringProvider,
  },
]

// set up defaults and track current values
// so dialog remembers settings between invocations
let currentArrayDistance: ArrayDistance = ArrayDistance.BETWEEN_2_POINTS
let currentArrayType: ArrayType = ArrayType.LINEAR
let currentArrayQuantity = 3

export const showArrayToolDialogState = atom<boolean>({
  key: "showArrayToolDialogState",
  default: false,
})

const ArrayToolDialog = () => {
  const t = useTranslator()
  const setIsOpen = useSetRecoilState(showArrayToolDialogState)
  const modal = useRef<WeaveModalElement>(null)

  const handleArrayCreate = useCallback(() => {
    const isTotalLength = currentArrayDistance === ArrayDistance.TOTAL
    const isRadial = currentArrayType === ArrayType.RADIAL
    FormIt.Tools.SelectArrayTool(currentArrayQuantity, isTotalLength, true, isRadial)
    setIsOpen(false)
  }, [setIsOpen])

  const onBlurHandler = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target as HTMLInputElement
    let newValue = parseInt(inputEl.value)
    if (!newValue) newValue = 1
    currentArrayQuantity = newValue
    inputEl.value = String(newValue)
  }, [])

  useLayoutEffect(() => {
    if (modal.current) modal.current.show()
  }, [modal])

  return (
    <div>
      <weave-modal width="309px" ref={modal} onClose={() => setIsOpen(false)} class={"no-margin-padding-clear"}>
        <div slot="title">{t(($) => $.wsm.dialogs.arrayTitle)}</div>
        <div slot="content">
          <div>{t(($) => $.wsm.dialogs.arraySubtitleDistance)}</div>
          <weave-radio-button-group>
            <div className={styles.radioGroup}>
              {arrayDistanceOptions.map((o, i) => (
                <weave-radio-button
                  key={i}
                  name="array-length"
                  value={o.value}
                  label={t.getText(o.label)}
                  checked={currentArrayDistance == o.value}
                  onClick={() => (currentArrayDistance = o.value)}
                />
              ))}
            </div>
          </weave-radio-button-group>
          <div>{t(($) => $.wsm.dialogs.arraySubtitleType)}</div>
          <weave-radio-button-group>
            <div className={styles.radioGroup}>
              {arrayTypeOptions.map((o, i) => (
                <weave-radio-button
                  key={i}
                  name="array-type"
                  value={o.value}
                  label={t.getText(o.label)}
                  checked={currentArrayType == o.value}
                  onClick={() => (currentArrayType = o.value as ArrayType)}
                />
              ))}
            </div>
          </weave-radio-button-group>
          <div>{t(($) => $.wsm.dialogs.arraySubtitleQuantity)}</div>
          <weave-input
            type="number"
            min={1}
            value={String(currentArrayQuantity)}
            onBlur={onBlurHandler}
            onFocus={(e) => (e.target as WeaveInputElement).inputEl?.select()}
            onKeyDown={(e: KeyboardEvent) => {
              if (["Enter", "Escape"].includes(e.key)) {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            style={{ width: "46px" }}
          />
        </div>
        <div slot="actions" style={{ gap: "10px" }}>
          <weave-button variant="outlined" onClick={() => setIsOpen(false)}>
            {t(($) => $.wsm.dialogs.arrayButtonCancel)}
          </weave-button>
          <weave-button variant="solid" onClick={handleArrayCreate}>
            {t(($) => $.wsm.dialogs.arrayButtonArray)}
          </weave-button>
        </div>
      </weave-modal>
    </div>
  )
}

export default ArrayToolDialog
