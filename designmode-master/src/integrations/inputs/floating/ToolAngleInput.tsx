import { round } from "src/lib/math/round"
import { useCallback, useEffect, useState } from "preact/compat"
import { useRef } from "preact/hooks"
import type { VNode } from "preact"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import styles from "./FloatingToolInputs/FloatingToolInputs.module.pcss"
import type { ChangeEvent } from "react"
import { to360Degrees } from "src/lib/geometry/geometryUtils"

const formatAngle = (angle: number): string => (angle < 100 ? round(angle, 2).toString() : round(angle, 1).toString())

type Props = {
  value: number
  onSubmit?: (value: number | undefined) => void
  onChange: (value: number | undefined) => void
  icon?: VNode
  active: boolean
  step?: number
  disabled?: boolean
  sharedInputWidthCh?: number
}

export const ToolAngleInput = ({
  value,
  onChange,
  onSubmit,
  icon,
  active = false,
  step = 1,
  disabled,
  sharedInputWidthCh,
}: Props) => {
  const [isTyping, setIsTyping] = useState(false)
  const [valueStr, setValueStr] = useState("")
  const ref = useRef<WeaveInputElement>(null)

  const onChangeInternal = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const stringValue = (e.target as HTMLInputElement).value
      setValueStr(stringValue)

      if (stringValue === "") {
        setValueStr("")
        onChange(undefined)
        setIsTyping(false)
        return
      }

      setIsTyping(true)

      if (stringValue === "-") {
        setValueStr(stringValue)
        return
      }

      const nonCommaNumber = stringValue.replace(",", ".")
      const numberValue = parseFloat(nonCommaNumber)
      if (isNaN(numberValue)) return

      if ("1234567890,.-".includes(stringValue.slice(-1))) {
        setValueStr(stringValue)
        onChange(numberValue)
      }
    },
    [onChange],
  )

  useEffect(() => {
    if (!isTyping && active) {
      ref.current?.inputEl?.focus()
      ref.current?.inputEl?.select()
    }
  }, [valueStr, active, isTyping, value])

  // Only update external value if user is not typing
  useEffect(() => {
    if (!isTyping) {
      const deg360 = to360Degrees(value)
      setValueStr(formatAngle(deg360))
    }
  }, [active, isTyping, value])

  // This will trigger updating of internval value from external value
  const onBlur = useCallback(() => {
    setIsTyping(false)
  }, [])

  // Hack-ish way to update internal value with external value when user starts moving the mouse
  useEffect(() => {
    if (isTyping) {
      const setIsTypingFalse = () => setIsTyping(false)
      window.addEventListener("mousemove", setIsTypingFalse)
      return () => {
        window.removeEventListener("mousemove", setIsTypingFalse)
      }
    }
  }, [isTyping])

  const keydown = useCallback(
    (e: KeyboardEvent, currentVal: string) => {
      switch (e.key) {
        case "Enter":
          if (isTyping) {
            e.stopPropagation()
          }

          if (onSubmit) {
            const val = parseFloat(currentVal)
            onSubmit(val)
          }

          setIsTyping(false)
          break
        case "ArrowUp": {
          e.preventDefault()
          const stepUp = round(parseFloat(currentVal) + step, 0)
          setValueStr(`${stepUp}`)
          onChange(stepUp)
          break
        }
        case "ArrowDown": {
          e.preventDefault()
          const stepDown = round(parseFloat(currentVal) - step, 0)
          setValueStr(`${stepDown}`)
          onChange(stepDown)
          break
        }
      }
    },
    [onChange, isTyping, step, onSubmit],
  )

  return (
    <>
      <div className={styles.IconWrapper}>
        <span className={styles.Icon}>{icon}</span>
      </div>
      <div className={styles.FloatingInputWrapper}>
        <weave-input
          className={styles.FloatingInput}
          ref={ref}
          value={valueStr}
          disabled={disabled}
          onChange={onChangeInternal}
          onKeyDown={(e) => keydown(e, valueStr)}
          onBlur={onBlur}
          style={{ width: `${sharedInputWidthCh ?? 7}ch` }}
          autoComplete={"off"}
        />
      </div>
      <span className={styles.Unit}>{"°"}</span>
    </>
  )
}
