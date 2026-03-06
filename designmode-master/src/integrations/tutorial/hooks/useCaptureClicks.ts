import { useEffect } from "react"

const useCaptureClicks = (shouldCapture: boolean) => {
  useEffect(() => {
    if (!shouldCapture) return

    const preventClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (target.closest("#tutorial-overlay-root")) {
        e.stopImmediatePropagation() // Blocks ALL listeners
      }
    }

    window.addEventListener("pointerdown", preventClickOutside, { capture: true })
    window.addEventListener("mousedown", preventClickOutside, { capture: true })

    return () => {
      window.removeEventListener("pointerdown", preventClickOutside, { capture: true })
      window.removeEventListener("mousedown", preventClickOutside, { capture: true })
    }
  }, [shouldCapture])
}

export default useCaptureClicks
