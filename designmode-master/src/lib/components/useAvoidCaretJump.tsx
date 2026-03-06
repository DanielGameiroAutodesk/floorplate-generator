import { useState, useLayoutEffect } from "preact/hooks"
import type { RefObject } from "preact"

/* Helper to avoid the caret jumping to the end of input when value is changing.
 * Inspired by https://github.com/facebook/react/issues/18404#issuecomment-605294038
 * */
export default function useAvoidInputCaretJump(inputRef: RefObject<HTMLInputElement>) {
  const [caretSelection, setCaretSelection] = useState<{ start: number | null; end: number | null } | null>(null)

  useLayoutEffect(() => {
    if (caretSelection && inputRef.current) {
      inputRef.current.selectionStart = caretSelection.start
      inputRef.current.selectionEnd = caretSelection.end
    }
  }, [inputRef, caretSelection])

  return (target: HTMLInputElement) => {
    setCaretSelection({ start: target.selectionStart, end: target.selectionEnd })
  }
}
