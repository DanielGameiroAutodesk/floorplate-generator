import { useEffect, useState } from "react"

/* Custom hook as a workaround to handle both single and double clicks. Does not fire two (single) clicks in addition
   to a double click when double-clicking. Intended to be used in place of onClick in react components.
   Solution taken from https://stackoverflow.com/a/63891352 */
export default function useSingleAndDoubleClick({
  onClick,
  onDoubleClick,
  delay = 250,
}: {
  onClick: (args?: any) => void
  onDoubleClick: (args?: any) => void
  delay?: number
}) {
  const [click, setClick] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (click === 1) onClick()
      setClick(0)
    }, delay)

    // Delay between click was less than set delay, initiate double click
    if (click === 2) onDoubleClick()

    return () => clearTimeout(timer)
  }, [click, delay, onClick, onDoubleClick])

  return () => setClick((prev) => prev + 1)
}
