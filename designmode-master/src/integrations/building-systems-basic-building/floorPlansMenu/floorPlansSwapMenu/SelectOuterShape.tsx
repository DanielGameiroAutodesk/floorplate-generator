import { useMemo, useState } from "preact/compat"
import * as formaUnits from "@spacemakerai/forma-units"
import { UnitType } from "@spacemakerai/forma-units"
import type { FootPrint } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import {
  filterZeroEdgesAndAngles,
  getEdgeLengthsInPolygon,
  isPolygonRectangle,
} from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import { round } from "src/integrations/building-systems-basic-building/lib/utils"
import { useIsImperial } from "src/lib/unitSettings"

const TabItemStyle = `
  display: flex;
  justify-content: center;
  align-items: center;


  border: none;
  box-sizing: border-box;

  height: 24px;

  cursor: pointer;
  font: var(--12-regular);
  letter-spacing: 1px;
`

const HoveredSelectedTabItemStyle =
  TabItemStyle +
  `
  background: rgba(205, 234, 247, 0.6);
`

const SelectedTabItemStyle =
  TabItemStyle +
  `
  font-weight: 700;
  box-shadow: inset 0px -2px 0px #0696D7, inset 0px -1px 0px rgba(128, 128, 128, 0.35);
`

const TabItem = ({
  title,
  floorCount,
  selected,
  hovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  title: string
  floorCount: number
  selected: boolean
  hovered: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) => {
  return (
    <div
      style={selected ? SelectedTabItemStyle : hovered ? HoveredSelectedTabItemStyle : TabItemStyle}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {`${title} (${floorCount})`}
    </div>
  )
}

////
//
////

const SelectShapeOuterWrapperStyle = `
  position: relative;
  box-sizing: border-box;
  overflow-y: hidden;
  overflow-x: hidden;
  width: 100%;
  min-height: 48px;
  padding-bottom: 12px;
  padding-top: 12px;

  display:flex;
  flex-wrap: wrap;
  gap: 9px;
`

function getTitleForRect(length: number, width: number, imperialFlag: boolean) {
  if (imperialFlag) {
    const feetInchesWidth = formaUnits.formatMetricLengthAs(width, UnitType.ImperialFeetInches)
    const feetInchesLength = formaUnits.formatMetricLengthAs(length, UnitType.ImperialFeetInches)

    return `${feetInchesWidth}x${feetInchesLength}`
  }

  const roundedLength = round(length, 2)
  const roundedWidth = round(width, 2)
  const tildeLength = Math.abs(roundedLength - length) > 1e-4
  const tildeWidth = Math.abs(roundedWidth - width) > 1e-4

  const lengthString = tildeLength ? "~" + `${roundedLength}` : `${roundedLength}`
  const widthString = tildeWidth ? "~" + `${roundedWidth}` : `${roundedWidth}`
  return lengthString + "x" + widthString
}
function getTitleForOuterShape(outerShape: FootPrint, imperialFlag: boolean) {
  if (outerShape.length !== 1) return "Freeform"
  if (outerShape[0].holes.length !== 0) return "Freeform"

  const polygon = filterZeroEdgesAndAngles(outerShape[0].polygon)
  const isRect = isPolygonRectangle(polygon)

  if (!isRect) return "Freeform"

  const edgeLengths = getEdgeLengthsInPolygon(polygon)
  const [l0, l1] = edgeLengths

  if (l0 > l1) {
    return getTitleForRect(l0, l1, imperialFlag)
  } else {
    return getTitleForRect(l1, l0, imperialFlag)
  }
}

export const SelectOuterShape = ({
  outerShapesInSelection,
  selectedOuterShapeIndex,
  setOuterShapeIndex,
  numberOfFloorsPerOuterShape,
}: {
  outerShapesInSelection: FootPrint[]
  selectedOuterShapeIndex: number
  setOuterShapeIndex: (outerShape: number) => void
  numberOfFloorsPerOuterShape: number[]
}) => {
  const imperialFlag = useIsImperial()
  const [hoverIndex, setHoverIndex] = useState<number | undefined>()
  const numberOfShapes = outerShapesInSelection.length

  const titles = useMemo(() => {
    return outerShapesInSelection.map((outerShape) => getTitleForOuterShape(outerShape, imperialFlag))
  }, [outerShapesInSelection, imperialFlag])

  return (
    <>
      <div style={SelectShapeOuterWrapperStyle}>
        {outerShapesInSelection.map((outerShape, index) => {
          const selected = index === selectedOuterShapeIndex % numberOfShapes

          const key = JSON.stringify(outerShape) + index
          const title = titles[index]
          const floorCount = numberOfFloorsPerOuterShape[index]
          return (
            <TabItem
              key={key}
              title={title}
              floorCount={floorCount}
              selected={selected}
              hovered={hoverIndex === index}
              onClick={() => {
                setOuterShapeIndex(index)
              }}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(undefined)}
            />
          )
        })}
      </div>
    </>
  )
}
