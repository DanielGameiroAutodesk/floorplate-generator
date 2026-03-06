import type { JSX } from "preact"
import { useEffect, useRef } from "preact/hooks"
import type { CSSProperties } from "react"

type Props = {
  onClickOutside: (e?: MouseEvent) => void
  children?: JSX.Element | JSX.Element[]
  style?: CSSProperties
  useCapture?: boolean
}

export const ClickOutside = ({ children, onClickOutside, style, useCapture }: Props) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && (!(event.target instanceof Node) || !ref.current.contains(event.target))) onClickOutside(event)
    }

    window.addEventListener("click", handleClickOutside, useCapture)
    return () => {
      window.removeEventListener("click", handleClickOutside, useCapture)
    }
  }, [ref, onClickOutside, useCapture])

  return (
    <div ref={ref} style={{ display: "flex", ...style }}>
      {children}
    </div>
  )
}
