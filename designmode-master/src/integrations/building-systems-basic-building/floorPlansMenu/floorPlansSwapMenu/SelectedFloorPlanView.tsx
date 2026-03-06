import { useMemo, useState } from "preact/compat"
import type { FootPrint } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/footPrints"
import type { SpaceUnits } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { LayoutIcon } from "src/integrations/building-systems-basic-building/floorPlansMenu/SvgComponents/LayoutsIcon"

const FloorPlanIconStyle = `
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
`

const FloorView = ({ floorPlans }: { floorPlans: SpaceUnits[] }) => {
  return (
    <div style={FloorPlanIconStyle}>
      <LayoutIcon spaceUnits={floorPlans[0]} width={120} height={120} background={"transparent"} />
    </div>
  )
}

///
// Empty Selection
///

const EmptyOfMixedSelectionTextStyle = `
  position: absolute;
  display: flex;
  align-items: center;
  text-align: center;
  font: var(--11-regular);
`

const EmptySelection = () => {
  return <div style={EmptyOfMixedSelectionTextStyle}>{"No floor plan in selection"}</div>
}

///
// Mixed selection
///

const FloorNumberSelectorWrapperStyle = `
  position: absolute;
  left: 16px;
`

const DotStyle = `
  width: 8px;
  height: 8px;
  margin-bottom: 8px;
  background: rgba(128, 128, 128, 0.2);
  border-radius: 4px;
  cursor: pointer;
`

const DotSelectedStyle =
  DotStyle +
  `
  background: rgba(6, 150, 215, 0.5);
`

const FloorNumberSelector = ({
  selectedFloorNumber,
  setSelectedFloorNumber,
  numberOfFloors,
}: {
  selectedFloorNumber: number
  setSelectedFloorNumber: any
  numberOfFloors: number
}) => {
  const floorNumbers = new Array(numberOfFloors).fill(0).map((_, i) => {
    return numberOfFloors - i - 1
  })
  return (
    <div style={FloorNumberSelectorWrapperStyle}>
      {floorNumbers.map((index) => {
        const selected = index === selectedFloorNumber
        const key = index.toString() + selected
        return (
          <div
            key={key}
            style={selected ? DotSelectedStyle : DotStyle}
            onClick={() => {
              setSelectedFloorNumber(index)
            }}
          />
        )
      })}
    </div>
  )
}

const FloorPlanWrapperStyle = `
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
`

const MixedSelection = ({ floorPlans }: { floorPlans: any }) => {
  const [selectedFloorNumber, setSelectedFloorNumber] = useState(0)
  const numberOfFloors = floorPlans.length

  const spaceUnits = floorPlans[selectedFloorNumber % numberOfFloors]
  return (
    <div style={FloorPlanWrapperStyle}>
      <FloorNumberSelector
        numberOfFloors={numberOfFloors}
        setSelectedFloorNumber={setSelectedFloorNumber}
        selectedFloorNumber={selectedFloorNumber % numberOfFloors}
      />
      <div style={FloorPlanIconStyle}>
        <LayoutIcon spaceUnits={spaceUnits} width={120} height={120} background={"transparent"} />
      </div>
    </div>
  )
}
// "Mixed floor plans selected"

///
// SelectedFloorPlanView
///

const SelectedFloorPlanViewStyle = `
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 180px;
  background: var(--background-color-surface-200);
  mix-blend-mode: normal;
`

export const SelectedFloorPlanView = ({
  outerShapesInSelection,
  selectedOuterShapeIndex,
  selectedFloorPlansByOuterShape,
}: {
  outerShapesInSelection: FootPrint[]
  selectedOuterShapeIndex: number
  selectedFloorPlansByOuterShape: SpaceUnits[][]
}) => {
  const floorPlans = useMemo(() => {
    const numberOfOuterShapes = outerShapesInSelection.length
    return selectedFloorPlansByOuterShape[selectedOuterShapeIndex % numberOfOuterShapes]
  }, [selectedOuterShapeIndex, selectedFloorPlansByOuterShape, outerShapesInSelection])

  return (
    <div style={SelectedFloorPlanViewStyle}>
      {(floorPlans === undefined || floorPlans.length === 0) && <EmptySelection />}
      {floorPlans && floorPlans.length === 1 && <FloorView floorPlans={floorPlans} />}
      {floorPlans && floorPlans.length > 1 && <MixedSelection floorPlans={floorPlans} />}
    </div>
  )
}
