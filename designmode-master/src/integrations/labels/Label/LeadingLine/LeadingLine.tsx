import styles from "./LeadingLine.module.pcss"

const DOT_DIAMETER = 4
const BORDER_WIDTH = 1

/* Draw a line from the label to the position it is attached to */
export default function LeadingLine({ labelOffset }: { labelOffset: { x: number; y: number } }) {
  const updateLeaderStyles = (div: HTMLDivElement | null) => {
    if (!div) return
    const parent = div.parentElement
    if (!parent) return
    const labelWidth = parent.offsetWidth
    const labelHeight = parent.offsetHeight

    // horizontal line needs to only extend to the actual border of the label, but only if the label overlaps the horizontal leader
    const labelOverlapsHorizontalLeader = labelOffset.y < 0 && -labelOffset.y < labelHeight
    const horizontalLeaderWidth = labelOverlapsHorizontalLeader
      ? Math.abs(labelOffset.x) - labelWidth / 2
      : Math.abs(labelOffset.x)
    const horizontalLeaderLeft = labelOverlapsHorizontalLeader && labelOffset.x < 0 ? labelWidth / 2 : 0

    // set css variables
    div.style.setProperty("--leader-width", `${horizontalLeaderWidth}px`)
    div.style.setProperty("--leader-left", `${horizontalLeaderLeft}px`)
  }

  return (
    <>
      <div
        className={styles.LeadingLineVertical}
        style={{
          top: labelOffset.y < 0 ? "100%" : 0,
          height: `calc(${Math.abs(labelOffset.y)}px - ${labelOffset.y < 0 ? "100%" : "0px"})`,
          transform: `translate(0, calc(${Math.min(0, -labelOffset.y)}px))`,
        }}
      />
      <div
        ref={updateLeaderStyles}
        className={styles.LeadingLineHorizontal}
        style={{
          top: `calc(${-labelOffset.y}px)`,
          width: `var(--leader-width)`,
          transform: `translate(calc(${Math.min(0, -labelOffset.x) + BORDER_WIDTH / 2}px + var(--leader-left)), -${
            BORDER_WIDTH / 2
          }px)`,
        }}
      />
      <div
        className={styles.LeadingLineDot}
        style={{
          top: `calc(${-labelOffset.y}px - ${DOT_DIAMETER / 2}px)`,
          left: `calc(50% + ${-labelOffset.x}px - ${DOT_DIAMETER / 2}px)`,
          width: `${DOT_DIAMETER}px`,
          height: `${DOT_DIAMETER}px`,
        }}
      />
    </>
  )
}
