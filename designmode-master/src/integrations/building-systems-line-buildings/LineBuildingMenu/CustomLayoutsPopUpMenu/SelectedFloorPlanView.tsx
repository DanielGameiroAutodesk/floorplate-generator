import type { CustomLayoutData } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/LineBuildingMenus"
import { useEffect, useMemo, useState } from "preact/hooks"
import { getLocalCustomLayoutsFilteredByDrawSetting } from "./customLayoutsHelpers"
import { SingleFloorIconCappedHeight } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/FloorIcons/FloorIcons"
import { icons } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/icons"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { DrawSetting } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/types"
import { useTranslator } from "src/i18n"

///
//

const MirrorAndRotateWrapperStyle = `
  position: absolute;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const MirrorAndRotateIconStyle = `
  width: 16px;
  height: 16px;
  cursor: pointer;
`

const MirrorAndRotate = ({
  customLayoutIds,
  customLayoutData,
}: {
  customLayoutIds: string[]
  customLayoutData: CustomLayoutData
}) => {
  return (
    <div style={MirrorAndRotateWrapperStyle}>
      <div
        style={MirrorAndRotateIconStyle}
        onClick={() => {
          customLayoutData.updateCustomLayoutSettings.rotate(customLayoutIds)
        }}
      >
        {icons.rotate}
      </div>
      <div
        style={MirrorAndRotateIconStyle}
        onClick={() => {
          customLayoutData.updateCustomLayoutSettings.mirror(customLayoutIds)
        }}
      >
        {icons.flipTopDown}
      </div>
      <div
        style={MirrorAndRotateIconStyle}
        onClick={() => {
          customLayoutData.updateCustomLayoutSettings.flipLeftRight(customLayoutIds)
        }}
      >
        {icons.flipLeftRight}
      </div>
    </div>
  )
}

///
///

const FloorPlanWrapperStyle = `
  position: relative;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
`

const FloorPlanUpperBoxStyle = `
    position: absolute;
    top: 16px;
    width: 100%;
    height: 120px;
    padding-left: 16px;
    padding-right: 16px;

    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
`

const FloorPlanTitleStyle = `
  position: absolute;
  bottom: 16px;
  font: var(--12-regular);
  text-align: center;
`

const FloorPlanIconStyle = `
  position: absolute;
  width: 120px;
  height: 120px;
`

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
  const floorNumbers = [2, 1, 0].filter((index) => index < numberOfFloors)
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

const FloorPlan = ({
  customLayout,
  customLayoutData,
}: {
  customLayout: CustomLayout
  customLayoutData: CustomLayoutData
}) => {
  const middleFloorIndex = useMemo(() => {
    const middleFloorIndex = customLayout.floors.findIndex((floor) => floor.name === "middleFloor")
    if (middleFloorIndex !== -1) return middleFloorIndex
    return customLayout.floors.length - 1
  }, [customLayout])

  const [selectedFloorNumber, setSelectedFloorNumber] = useState(middleFloorIndex)

  useEffect(() => {
    setSelectedFloorNumber(middleFloorIndex)
  }, [middleFloorIndex, customLayout.id])

  const floors = useMemo(() => {
    return customLayout.floors
  }, [customLayout])

  const showMirrorRotate = useMemo(() => {
    return customLayout.sectionType === "Rectangle"
  }, [customLayout])

  const numberOfFloors = customLayout.floors.length
  const showFloorSelector = numberOfFloors > 1

  return (
    <div style={FloorPlanWrapperStyle}>
      <div style={FloorPlanUpperBoxStyle}>
        {showFloorSelector && (
          <FloorNumberSelector
            selectedFloorNumber={selectedFloorNumber}
            setSelectedFloorNumber={setSelectedFloorNumber}
            numberOfFloors={numberOfFloors}
          />
        )}
        <div style={FloorPlanIconStyle}>
          <SingleFloorIconCappedHeight
            floors={floors}
            selectedFloorNumber={selectedFloorNumber}
            width={120}
            height={120}
            padding={0}
          />
        </div>
        {showMirrorRotate && (
          <MirrorAndRotate customLayoutIds={[customLayout.id]} customLayoutData={customLayoutData} />
        )}
      </div>
      <div style={FloorPlanTitleStyle}>{customLayout.name}</div>
    </div>
  )
}

////
// Empty and Mixed
///

const EmptyOfMixedSelectionTextStyle = `
  position: absolute;
  display: flex;
  align-items: center;
  text-align: center;

  font: var(--11-regular);
`

const MixedSelection = ({
  customLayouts,
  customLayoutData,
}: {
  customLayouts: CustomLayout[]
  customLayoutData: CustomLayoutData
}) => {
  const t = useTranslator()
  return (
    <div style={FloorPlanWrapperStyle}>
      <div style={EmptyOfMixedSelectionTextStyle}>{t(($) => $.building.floorPlans.mixedSelectionDescription)}</div>
      <div style={FloorPlanUpperBoxStyle}>
        <MirrorAndRotate
          customLayoutIds={customLayouts.map((customLayout) => customLayout.id)}
          customLayoutData={customLayoutData}
        />
      </div>
    </div>
  )
}

////
//
////

const EmptySelection = () => {
  const t = useTranslator()
  return <div style={EmptyOfMixedSelectionTextStyle}>{t(($) => $.building.floorPlans.noSelectionDescription)}</div>
}

///
//

const SelectedFloorPlanViewWrapperStyle = `
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 180px;
  background: var(--background-color-surface-200);
  mix-blend-mode: normal;
`

export const SelectedFloorPlanView = ({
  activeFloorPlanIds,
  customLayoutData,
  drawSetting,
}: {
  activeFloorPlanIds: string[]
  customLayoutData: CustomLayoutData
  drawSetting: DrawSetting | undefined
}) => {
  const customLayouts = useMemo(() => {
    return getLocalCustomLayoutsFilteredByDrawSetting(customLayoutData, drawSetting).filter(
      (customLayout: CustomLayout) => activeFloorPlanIds.includes(customLayout.id),
    )
  }, [drawSetting, customLayoutData, activeFloorPlanIds])

  const emptySelection = customLayouts.length === 0
  const mixedSelection = customLayouts.length > 1
  const singleSelection = customLayouts.length === 1

  return (
    <div style={SelectedFloorPlanViewWrapperStyle}>
      {emptySelection && <EmptySelection />}
      {mixedSelection && <MixedSelection customLayouts={customLayouts} customLayoutData={customLayoutData} />}
      {singleSelection && <FloorPlan customLayout={customLayouts[0]} customLayoutData={customLayoutData} />}
    </div>
  )
}
