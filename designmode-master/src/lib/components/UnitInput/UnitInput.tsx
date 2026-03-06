import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import styles from "./UnitInput.module.pcss"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import { sanitizeComma } from "src/lib/components/LengthInput/formaUnitUtils"
import { useMemo } from "react"
import { useTranslator } from "src/i18n"

export type UnitInputProps = {
  step?: number
  min?: number
  max?: number
  value?: number
  unit?: string
  isMixed?: boolean
  onChange?: (newValue: number) => void
  onBlur?: (newValue: number) => void
  disabled?: boolean
  id?: string
  style?: { [key: string]: string }
  /** When true, disables this field if users doesn't have edit access to the proposal */
  accessAware?: boolean
}

function formatValue(value: number | undefined, isMixed: boolean | undefined) {
  return value === undefined || isNaN(value) || isMixed ? "" : `${parseFloat(value.toFixed(2))}`
}

function getValueWithinLimits(value: number, min: number, max: number) {
  if (value > max) return max
  if (value < min) return min
  return value
}

export default function UnitInput(props: UnitInputProps & { editAccess?: boolean }) {
  const t = useTranslator()
  const {
    value,
    min = -Infinity,
    max = Infinity,
    step,
    unit,
    onChange,
    onBlur,
    isMixed = false,
    disabled = false,
    id,
    style,
    accessAware,
    editAccess,
  } = props

  const inputRef = useRef<WeaveInputElement>(null)

  const [internal, setInternal] = useState(formatValue(value, isMixed))
  const readOnly = useMemo(() => !editAccess && accessAware, [accessAware, editAccess])

  /* Needed to update this input's value when an outside component updates the value, e.g slider input */
  useEffect(() => {
    if (document.activeElement === inputRef.current) return
    setInternal(formatValue(value, isMixed))
  }, [value, isMixed])

  const changeHandler = useCallback(
    (event: Event) => {
      const strValue = (event.target as HTMLInputElement).value
      setInternal(strValue)

      const newValue = parseFloat(sanitizeComma(strValue))
      if (Number.isNaN(newValue)) return

      const valueWithinLimits = getValueWithinLimits(newValue, min, max)
      setInternal(`${valueWithinLimits}`)

      onChange?.(valueWithinLimits)
    },
    [max, min, onChange],
  )

  const blurHandler = useCallback(
    (event: Event) => {
      const newValue = parseFloat((event.target as HTMLInputElement).value)

      if (Number.isNaN(newValue)) {
        setInternal(formatValue(value, isMixed))
        return
      }
      const valueWithinLimits = getValueWithinLimits(newValue, min, max)
      setInternal(`${valueWithinLimits}`)
      onBlur?.(valueWithinLimits)
    },
    [isMixed, max, min, onBlur, value],
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (["Enter", "Escape"].includes(e.key)) {
      e.preventDefault()
      inputRef.current?.blur()
    }
  }

  return (
    <div className={styles.UnitInput} style={style}>
      <weave-input
        ref={inputRef}
        type="number"
        onKeyDown={onKeyDown}
        value={internal}
        onChange={changeHandler}
        onBlur={blurHandler}
        disabled={disabled || readOnly}
        onFocus={() => inputRef.current?.inputEl?.select()}
        id={id}
        placeholder={isMixed ? t(($) => $.properties.mixed) : undefined}
        autoComplete="off"
        readOnly={readOnly}
        step={step}
        max={max}
        min={min}
      />
      <span className={styles.Unit}>{unit}</span>
    </div>
  )
}
