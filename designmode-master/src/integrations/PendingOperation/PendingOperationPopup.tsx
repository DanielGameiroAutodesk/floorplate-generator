import { useMemo, useState } from "preact/hooks"
import { useEffect } from "preact/compat"
import { pendingOperationPreventedActionSignal, pendingOperationSignal } from "src/core/pending-operation"
import { useTranslator } from "src/i18n"

const hideAfter = 5000
const DEFAULT_ELEMENT_ID = "category-header"
export const PendingOperationPopup = () => {
  const [visible, setVisible] = useState(false)
  const operation = pendingOperationSignal.value
  const preventedAction = pendingOperationPreventedActionSignal.value
  const t = useTranslator()
  const defaultDescription = t(($) => $.pendingOperation.defaultDescription)

  useEffect(() => {
    if (visible) return
    const show = preventedAction && Date.now() < preventedAction.timestamp + hideAfter
    if (show) {
      setVisible(true)
      setTimeout(() => setVisible(false), hideAfter)
    }
  }, [preventedAction, visible])

  const position = useMemo(() => {
    if (operation && visible) {
      const elm =
        (operation.elementId && document.getElementById(operation.elementId)) ||
        document.getElementById(DEFAULT_ELEMENT_ID)
      const rect = elm?.getBoundingClientRect()
      if (rect) {
        return {
          x: rect.left,
          y: rect.top,
        }
      }
    }
  }, [visible, operation])

  if (!operation || !preventedAction) return null
  return (
    <div
      style={{
        position: "fixed",
        textIndent: "-24px",
        opacity: visible ? "1" : "0",
        transition: "opacity 250ms",
        zIndex: "var(--z-dialog)",
        top: position ? position.y : undefined,
        left: position ? position.x : undefined,
        height: 0,
      }}
    >
      <weave-flyout style="padding: 8px; text-indent: 0" nub="right-center" open={true}>
        {`${(preventedAction?.description ? t.getText(preventedAction.description) : undefined) || defaultDescription}`}
      </weave-flyout>
    </div>
  )
}
