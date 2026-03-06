import { useCallback, useEffect, useRef, useState } from "react"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"

export type TextInputProps = {
  initialValue: string
  onChange?: (value: string) => void
  onBlur?: (value: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  name?: string
  /* Makes consumer take control of input and initiate select */
  isSelected?: boolean
}

export default function TextInput(props: TextInputProps & { editAccess?: boolean }) {
  const { label, onChange, onBlur, initialValue, disabled, placeholder, name, isSelected, editAccess } = props

  const [valueStr, setValueStr] = useState(initialValue)
  const ref = useRef<WeaveInputElement>(null)

  useEffect(() => {
    setValueStr(initialValue)
  }, [initialValue])

  useEffect(() => {
    if (isSelected) ref.current?.inputEl?.select()
  }, [isSelected])

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== "Escape") {
      e.stopPropagation()
      return
    }
    ref.current?.inputEl?.blur()
  }, [])

  const onChangeInternal = useCallback(
    (e: JSX.TargetedEvent<HTMLInputElement, Event>) => {
      const value = (e.target as HTMLInputElement).value
      setValueStr(value)
      if (onChange) onChange(value)
    },
    [onChange],
  )

  const onBlurInternal = useCallback(() => {
    if (onBlur) onBlur(valueStr)
  }, [onBlur, valueStr])

  return (
    <weave-input
      ref={ref}
      label={label}
      showlabel={!!label}
      type="text"
      value={valueStr}
      disabled={!editAccess || disabled}
      unit=""
      placeholder={placeholder}
      onChange={onChangeInternal}
      onBlur={onBlurInternal}
      onKeyDown={onKeyDown}
      name={name}
    />
  )
}
