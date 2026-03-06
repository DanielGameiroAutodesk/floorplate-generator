import type { RefObject } from "preact"
import { useState, useEffect } from "preact/hooks"

export function useElementWidth<T extends HTMLElement>(ref: RefObject<T> | null): number {
  const [width, setWidth] = useState<number>(0)

  useEffect(() => {
    function handleResize() {
      if (ref?.current) {
        setWidth(ref.current.offsetWidth)
      }
    }

    handleResize()

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [ref])

  return width
}
