// Utility component is to trap focus
import { useEffect, useRef } from "preact/hooks"

export const FOCUS_TRAP_ID = "FOCUS-TRAP"

export default function FocusTrap({ hasFocus }: { hasFocus?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (hasFocus) {
      ref.current?.focus()
      ref.current?.select()
    }
  }, [hasFocus])

  return <input id={FOCUS_TRAP_ID} style={{ position: "absolute", left: "-9999px" }} ref={ref} />
}
