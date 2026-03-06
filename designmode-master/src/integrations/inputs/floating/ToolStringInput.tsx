import type { VNode } from "preact"
import type { ChangeEvent } from "preact/compat"
import { useCallback, useEffect, useState } from "preact/compat"
import { useRef } from "preact/hooks"
import useAvoidInputCaretJump from "src/lib/components/useAvoidCaretJump"
import { useMemo } from "react"
import type { WeaveInputElement } from "src/lib/components/weave-inputs"
import styles from "./FloatingToolInputs/FloatingToolInputs.module.pcss"
import { atom, useRecoilState } from "recoil"
import type { InputOptions } from "./FloatingToolInputs/FloatingToolInputs"
import { domCanvas } from "./FloatingToolInputs/FloatingToolInputs"

type Props = {
  value: any
  change: (value: any) => void
  submit?: (value: any) => void
  icon?: VNode
  active: boolean
  disabled?: boolean
  sharedInputWidthCh?: number
  updateSharedWidthCh?: (newWidth: number) => void
  options?: InputOptions
}

// This allows a separate service (ie WSR) to start a user entered character when
// this input is not already focused
export const toolInputUserStringState = atom<string>({
  key: "toolInputUserStringState",
  default: "",
})

/**
 * This is an input box for strings (originally for dimensions sent to FormIt/WSM)
 *
 * Intended to be used in a tool context where the input floats/follows the cursor.
 */
export const ToolStringInput = ({
  value,
  active,
  disabled,
  change,
  submit,
  icon,
  sharedInputWidthCh,
  updateSharedWidthCh,
  options,
}: Props) => {
  const [internal, setInternal] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isBlurring, setIsBlurring] = useState(options?.blurOnEscapeKey ?? false)
  const [dimUserVal, setDimUserVal] = useRecoilState(toolInputUserStringState)

  const ref = useRef<WeaveInputElement>(null)
  const avoidInputCaretJump = useAvoidInputCaretJump(ref)

  // Focus input if it's not already focused and select contents only if "selectOnFocus" component
  // option is enabled and "noSelect" parameter is false or undefined
  const focusInput = useCallback(
    (noSelect: boolean = false) => {
      const isNotActiveElement = ref.current?.inputEl && document.activeElement !== ref.current?.inputEl
      if (isNotActiveElement) ref.current?.inputEl?.focus()
      if (noSelect || !options?.selectOnFocus) return
      setTimeout(() => ref.current?.inputEl?.select())
    },
    [options?.selectOnFocus],
  )

  // Move the caret to the end (used when input is blurred and user is entering a value)
  const caretAtEnd = useCallback(() => {
    setTimeout(function () {
      const inputEl = ref.current?.inputEl
      if (inputEl) inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length
    })
  }, [])

  useEffect(() => {
    if (!isTyping && active && !isBlurring) {
      focusInput()
    }
  })

  // Only update external value if user is not typing
  useEffect(() => {
    if (!isTyping) {
      setInternal(value as string)
      // Use external user value if input can blur, is active and currently blurring
      if (dimUserVal != "" && options?.blurOnEscapeKey && active && isBlurring) {
        if (dimUserVal.trim() != "") setInternal(dimUserVal)
        setDimUserVal("")
        // Focus input without selecting whole value so user can continue typing at the end
        focusInput(true)
        // Force the caret to the end
        caretAtEnd()
      }
    }
  }, [active, isTyping, value, isBlurring, dimUserVal, setDimUserVal, setIsBlurring, options, focusInput, caretAtEnd])

  // This will trigger updating of internval value from external value
  const onBlur = useCallback(() => {
    setIsTyping(false)
    if (options?.blurOnEscapeKey) setIsBlurring(true)
  }, [setIsTyping, options?.blurOnEscapeKey])

  const onFocus = useCallback(() => {
    setIsTyping(true)
    if (options?.blurOnEscapeKey) setIsBlurring(false)
    if (options?.selectOnFocus) {
      // Selects the whole value by default (for when user clicks the input)
      ref.current?.inputEl?.select()
    }
  }, [options?.selectOnFocus, options?.blurOnEscapeKey, setIsBlurring])

  const keydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isTyping) {
        e.stopPropagation()
      }

      if (submit) {
        submit(internal)
      }

      setIsTyping(false)
    }
    // Blur this field if it can blur and user hits escape or enter
    if (["Enter", "Escape"].includes(e.key) && options?.blurOnEscapeKey) {
      domCanvas.focus()
    }
  }

  // Focus back to canvas on mouse move if typeOnMouseMove option is not set, false or returns false as a callback
  useEffect(() => {
    if (["boolean", "function"].includes(typeof options?.typeOnMouseMove)) {
      const focusDom = () => {
        const resultTypeOnMouseMove =
          typeof options?.typeOnMouseMove === "function" ? options?.typeOnMouseMove() : options?.typeOnMouseMove
        if (isTyping && !resultTypeOnMouseMove) domCanvas.focus()
      }
      window.addEventListener("mousemove", focusDom)
      return () => {
        window.removeEventListener("mousemove", focusDom)
      }
    }
  }, [isTyping, options])

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const changedVal = (e.target as HTMLInputElement).value
    avoidInputCaretJump(e.target as HTMLInputElement)

    setIsTyping(true)
    setInternal(changedVal)
    change(changedVal)
  }

  /* a bit arbitrary, but imperial units with feet, inches, dashes and whitespace (e.g 291'-5 5/16")
     takes up less space per character than metric (e.g 99.02m) */
  const internalInputWidth = useMemo(() => {
    const buffer = 2
    return Math.max((internal ?? "").length + buffer, 6)
  }, [internal])

  useEffect(() => {
    if (updateSharedWidthCh && internalInputWidth > (sharedInputWidthCh || 0)) {
      updateSharedWidthCh(internalInputWidth)
    }
  }, [updateSharedWidthCh, sharedInputWidthCh, internalInputWidth])

  return (
    <>
      <div className={styles.IconWrapper}>
        <span className={styles.Icon}>{icon}</span>
      </div>
      <div className={styles.FloatingInputWrapper}>
        <weave-input
          className={styles.FloatingInput}
          ref={ref}
          value={internal}
          disabled={disabled}
          onChange={onInputChange}
          onKeyDown={keydown}
          onBlur={onBlur}
          style={{ width: `${sharedInputWidthCh ?? internalInputWidth}ch` }}
          onFocus={onFocus}
          autoComplete={"off"}
        />
      </div>
    </>
  )
}
