import { useEffect, useRef, useState } from "preact/hooks"
import { useElementWidth } from "./useElementSize"
import styles from "./styles.module.pcss"

export type RangeFilter = {
  lowerIndex: number
  upperIndex: number
}
const RangeBorder = (rangeFilter: RangeFilter, steps: number, transition: number) => `
  position: relative;
  border: 1px solid var(--color-scheme-border-base, rgba(128, 128, 128, 0.5));
  border-radius: 4px 4px 0 0;
  z-index: 2;
  width: 100%;
  margin-left: ${(100 * rangeFilter.lowerIndex) / steps}%;
  border-radius: ${steps - rangeFilter.lowerIndex == steps ? "4px" : "0"} ${
    rangeFilter.lowerIndex - steps == 0 ? "4px" : "0"
  } 0 0;
  margin-right: ${100 * (1 - rangeFilter.upperIndex / steps)}%;
  transition: margin ${transition}s ease 0s;
`

const LeftBar = (rangeFilter: RangeFilter, steps: number, transition: number) => `
  width: ${(100 * rangeFilter.lowerIndex) / steps}%;
  transition: width ${transition}s ease 0s;
  height: 22px;
`

const RightBar = (rangeFilter: RangeFilter, steps: number, transition: number) => `
  width: ${100 * (1 - rangeFilter.upperIndex / steps)}%;
  transition: width ${transition}s ease 0s;
  height: 22px;
`

function calculateTransition(rangeFilter: RangeFilter, previousRangeFilter: RangeFilter, steps: number) {
  const transition =
    ((Math.abs(previousRangeFilter.upperIndex - rangeFilter.upperIndex) +
      Math.abs(previousRangeFilter.lowerIndex - rangeFilter.lowerIndex)) /
      steps) *
    0.7
  return transition < 0.05 ? 0 : transition
}

const RangeSlider = ({
  rangeFilter,
  setRangeFilter,
  steps,
  activeRenderScope,
}: {
  rangeFilter: RangeFilter
  setRangeFilter: (rangeFilter: RangeFilter) => void
  steps: number
  activeRenderScope: string
}) => {
  const ref = useRef<HTMLDivElement>(null)
  const [isMovingMouse, setIsMovingMouse] = useState(false)
  const colorbarWidth = useElementWidth(ref)
  const [transition, setTransition] = useState(0)

  useEffect(() => {
    setTransition(0)
  }, [activeRenderScope])

  const updateWindowPosition = (offsetX: number) => {
    const target = offsetX / (colorbarWidth / steps)
    const targetRounded = Math.round(target)
    if (Math.abs(rangeFilter.lowerIndex - target) < Math.abs(rangeFilter.upperIndex - target)) {
      if (rangeFilter.lowerIndex !== targetRounded) {
        const transition = calculateTransition(
          {
            ...rangeFilter,
            lowerIndex: targetRounded,
          },
          rangeFilter,
          steps,
        )
        setTransition(transition)
        setRangeFilter({
          ...rangeFilter,
          lowerIndex: targetRounded,
        })
      }
    } else {
      if (rangeFilter.upperIndex !== targetRounded) {
        const transition = calculateTransition(
          {
            ...rangeFilter,
            upperIndex: targetRounded,
          },
          rangeFilter,
          steps,
        )
        setTransition(transition)
        setRangeFilter({
          ...rangeFilter,
          upperIndex: targetRounded,
        })
      }
    }
  }

  return (
    <>
      <div
        className={styles.trigger}
        ref={ref}
        onMouseDown={() => {
          setIsMovingMouse(true)
        }}
        onMouseLeave={() => {
          setIsMovingMouse(false)
        }}
        onMouseUp={(e) => {
          setIsMovingMouse(false)
          updateWindowPosition(e.offsetX)
        }}
        onMouseMoveCapture={(e) => {
          if (!isMovingMouse) return
          updateWindowPosition(e.offsetX)
        }}
      />
      <div className={styles.borderOverlay}>
        <div className={styles.leftBar} style={LeftBar(rangeFilter, steps, transition)} />
        <div className={styles.rangeBorder} style={RangeBorder(rangeFilter, steps, transition)} />
        <div className={styles.rightBar} style={RightBar(rangeFilter, steps, transition)} />
      </div>
    </>
  )
}

export default RangeSlider
