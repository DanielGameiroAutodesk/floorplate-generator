import { useEffect, useRef } from "preact/hooks"
import styles from "./NoiseInput.module.pcss"
import { useTranslator } from "src/i18n"

type StringUnit = "ft" | "m" | "%" | "°" | "" | "mph" | "km/h"
type unitInputProps = {
  step?: number
  min?: number
  max?: number
  value?: number
  unit?: StringUnit
  isMixed?: boolean
  onChange?: (newValue: number | undefined) => void
  // Usage of onBlur permits newValue to be undefined, meaning the value would be unset
  // TODO: Figure out if we should implement that
  onBlur?: (newValue: number) => void
  disabled?: boolean
  id?: string
  style?: JSX.CSSProperties
}

export function UnitInput({
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
}: unitInputProps) {
  const t = useTranslator()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) {
      if (document.activeElement === inputRef.current) return
      inputRef.current.value = value === undefined ? "" : `${parseFloat(value.toFixed(2))}`
    }
  }, [value])

  const changeHandler = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.currentTarget.value)
    onChange?.(Number.isNaN(newValue) ? undefined : newValue)
  }

  const blurHandler = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    let newValue = parseFloat(e.currentTarget.value)
    if (Number.isNaN(newValue)) return
    if (newValue < min || newValue > max) {
      newValue = Math.min(max, Math.max(min, newValue))
      e.currentTarget.value = `${newValue}`
    }
    if (newValue !== value) onBlur?.(newValue)
  }

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (["Enter", "Escape"].includes(e.key)) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  // input event is not cancelable, so this doesn't do anything
  // TODO: Rework this
  const onInputEvent = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.currentTarget.value)
    if (Number.isNaN(newValue)) return
    if (newValue > max || newValue < min) {
      e.preventDefault()
    }
  }

  return (
    <div className={styles.NoiseInput} style={style}>
      <input
        ref={inputRef}
        type="number"
        className={styles.NumericalInput}
        step={step}
        min={min}
        max={max}
        onChange={changeHandler}
        onKeyDown={onKeyDown}
        onInput={onInputEvent}
        onBlur={blurHandler}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        id={id}
        placeholder={isMixed ? t(($) => $.properties.mixed) : undefined}
      />
      <span className={styles.Unit}>{unit}</span>
    </div>
  )
}
