import { useEffect, useRef } from "preact/hooks"
import type { RefObject, VNode } from "preact"
import { cloneElement } from "preact"

// TODO: This lived in src/components before. It already existed in lib. Consider a cleanup or renaming.

/*
  Example usage:
  ```
  const hello = () => { alert("hello")}
  <ClickOutside onClickOutside={hello}>
    <div>Stuff inside</div>
  </ClickOutside>
  ```

  Warning:
  Might need not be guarded well with react Portals. Can do this check
  document.body.contains(event.target as Node) to check that it's mounted.
 */

export function ClickOutside(props: { onClickOutside: () => void; children: VNode<any> }) {
  const ref = useRef<HTMLElement | null>(null)
  useClickOutside(ref, props.onClickOutside)

  return cloneElement(props.children, { ref })
}

function useClickOutside(ref: RefObject<HTMLElement> | null, onClickOutside: () => void) {
  useEffect(() => {
    if (!ref?.current) return
    const htmlElement = ref.current

    const onClickElement = (event: MouseEvent) => {
      event.stopPropagation()
    }

    const onClickWindow = () => {
      onClickOutside()
    }

    htmlElement.addEventListener("click", onClickElement)
    htmlElement.addEventListener("contextmenu", onClickElement)
    window.addEventListener("click", onClickWindow)
    window.addEventListener("contextmenu", onClickWindow)

    return () => {
      htmlElement.removeEventListener("click", onClickElement)
      htmlElement.removeEventListener("contextmenu", onClickElement)
      window.removeEventListener("click", onClickWindow)
      window.removeEventListener("contextmenu", onClickWindow)
    }
  }, [onClickOutside, ref])
}
