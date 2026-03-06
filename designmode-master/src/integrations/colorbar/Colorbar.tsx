import { useRef } from "preact/hooks"
import type { LabelPosition, ColorbarDefinition } from "./ColorbarAPI"
import styles from "./styles.module.pcss"
import type { RangeFilter } from "./RangeSlider"
import RangeSlider from "./RangeSlider"
import { useCallback } from "preact/compat"
import type { SetterOrUpdater } from "recoil"
import { DesignModeEvents } from "src/core/events/events"

const Container = `
  position: relative;
  -webkit-user-select: none; /* Safari */
  -ms-user-select: none; /* IE 10 and IE 11 */
  user-select: none; /* Standard syntax */
`

const RangeItem = `
  height: 24px;
`

const RangeSubLabel = `
  margin: 0;
  padding: 0;
  font-size: 10px;
  line-height: 14px;
  letter-spacing: 0.01em;
`

const CenteredRangeSubLabel = `
  width: 100%;
  text-align: center;
  overflow: hidden;
  ${RangeSubLabel}
`

const NonCenteredRangeSubLabel = `
  width: fit-content;
  transform: translateX(-50%);
  ${RangeSubLabel}
`

const Bar = (color: string, isLeftCorner: boolean, isRightCorner: boolean) => `
  background: ${color};
  height: 22px;
  flex: 1 0 100%;
  border-radius: 0 0 0 0;
  border: 0;
  ${isLeftCorner ? "border-radius: 4px 0 0 0;" : ""}
  ${isRightCorner ? "border-radius: 0 4px 0 0;" : ""}
`

const Label = ({ labels, index, labelPosition }: { labels: string[]; index: number; labelPosition: LabelPosition }) => {
  switch (labelPosition) {
    case "center":
      if (!labels[index]) return null
      return <div style={CenteredRangeSubLabel}>{labels[index]}</div>
    case "edge":
      // Label is left aligned. Need to access index-1
      if (index === 0 || !labels[index - 1]) return null
      return <div style={NonCenteredRangeSubLabel}>{labels[index - 1]}</div>
    default:
      return null
  }
}

export const Colorbar = ({
  colorbarDefinition,
  setColorbarDefinition,
  activeRenderScope,
}: {
  colorbarDefinition: ColorbarDefinition
  setColorbarDefinition: SetterOrUpdater<ColorbarDefinition | undefined>
  activeRenderScope: string
}) => {
  const { colors, isInteractive, unit, labelPosition, labels, rangeFilter } = colorbarDefinition

  const ref = useRef<HTMLDivElement>(null)

  const setRangeSlider = useCallback(
    (rangeFilter: RangeFilter) => {
      setColorbarDefinition((prev) => prev && { ...prev, rangeFilter })
      DesignModeEvents.dispatch("colorbar.range.changed", { renderScope: activeRenderScope, rangeFilter })
    },
    [setColorbarDefinition, activeRenderScope],
  )

  return (
    <div style={Container}>
      <div className={styles.itemsContainer} ref={ref} id={"analysis-color-bar"}>
        {colors.map((color, index) => (
          <div style={RangeItem} key={index}>
            <div style={Bar(color, index === 0, index === colors.length - 1)} />
            {labels && labelPosition && <Label labels={labels} index={index} labelPosition={labelPosition} />}
          </div>
        ))}
        <div className={styles.labelPosition}>
          <weave-tooltip nub="down-center" text={unit}>
            <div className={styles.label}>{unit}</div>
          </weave-tooltip>
        </div>
      </div>
      {isInteractive && (
        <RangeSlider
          rangeFilter={rangeFilter}
          setRangeFilter={setRangeSlider}
          steps={colors.length}
          activeRenderScope={activeRenderScope}
        />
      )}
    </div>
  )
}
