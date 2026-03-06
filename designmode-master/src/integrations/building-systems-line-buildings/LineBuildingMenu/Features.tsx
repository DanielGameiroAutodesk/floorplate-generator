import { icons } from "./icons"
import type { CustomLayoutData } from "./LineBuildingMenus"
import { useRef } from "preact/hooks"
import { memo, useMemo, useState } from "preact/compat"
import { SingleFloorIcon } from "./FloorIcons/FloorIcons"
import { useToggleCustomLayoutsPopup } from "./CustomLayouts"
import { EditCustomSection } from "./DrawCustomLayout"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { DrawSetting } from "./types"

////
// Features

const TileButtonsStyle = `
  display: flex;
  cursor: pointer;
`

const FeatureBodyBoxStyle = `
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  `

const FeatureBodyTextItemsStyle = (hover: boolean, showPencilIcon: boolean, showCrossIcon: boolean) => `
  height: 100%;
  width: calc(200px - 36px${showPencilIcon ? " - 28px" : ""} ${showCrossIcon ? " - 28px" : ""});
  box-sizing: border-box;
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  padding-right: 10px;
  ${hover ? "background: var(--background-color-ghost-high-hover);" : ""}

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`

const NameTextStyle = `
  font: var(--11-medium);

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
`

const PropsTextStyle = `
  margin-left: 4px;
  font: var(--11-medium);
  color: rgba(60, 60, 60, 0.4);
`

///////
// Custom feature
///

function getCustomLayoutTitle(customLayout: CustomLayout) {
  const { id, name } = customLayout
  if (name) return name
  return "Custom " + id
}

const InnerTileStyle = `
  display: flex;
  align-items: center;
  height: 36px;
  cursor: pointer;

`
const IconStyle = (
  background: string = "rgba(128, 128, 128, 0.1)",
  borderColor: string = "rgba(128, 128, 128, 0.0)",
) => `
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${background};
  border: 1px solid ${borderColor};
`
export const LayoutIcon = memo(
  ({
    customLayout,
    background,
    borderColor,
  }: {
    customLayout: CustomLayout
    background?: string
    borderColor?: string
  }) => {
    return (
      <div style={IconStyle(background, borderColor)}>
        <SingleFloorIcon
          floor={customLayout.floors.find((f) => f.name === "middleFloor") || customLayout.floors[0]}
          width={28}
        />
      </div>
    )
  },
)

function getDrawSettingFromCustomLayout(customLayout: CustomLayout): DrawSetting {
  return customLayout.sectionType === "Rectangle"
    ? { sectionType: "Rectangle", width: customLayout.width, length: customLayout.length }
    : customLayout.sectionType === "Corner"
      ? {
          sectionType: "Corner",
          width: customLayout.width,
          angle: customLayout.angle,
          endLeg: customLayout.endLeg,
          startLeg: customLayout.startLeg,
        }
      : { sectionType: customLayout.sectionType }
}

const FloorPlanTile = ({
  remove,
  customLayout,
  count,
  inSelection,
  customLayoutData,
  lineBuildingParameters,
}: {
  remove: () => any
  customLayout: CustomLayout
  count: number
  inSelection: boolean
  customLayoutData: CustomLayoutData
  lineBuildingParameters: LineBuildingParameters
}) => {
  const title = getCustomLayoutTitle(customLayout)
  const togglePopup = useToggleCustomLayoutsPopup()
  const ref = useRef<HTMLDivElement>(null)

  const [hover, setHover] = useState(false)
  const [hoverIcon, setHoverIcon] = useState(false)
  const [editOpen, setEditOpen] = useState<boolean>(false)

  const showTextHoverEffect = hover && !hoverIcon
  const showIcons = !!hover

  const showDelete = showIcons && inSelection

  const sectionsWithLayout = useMemo(() => {
    return Object.keys(lineBuildingParameters.sectionProps).filter((sectionId) => {
      const feature = lineBuildingParameters.sectionProps[sectionId]?.feature
      return feature && feature.name === "CustomLayout" && feature.customLayoutID === customLayout.id
    })
  }, [customLayout.id, lineBuildingParameters.sectionProps])
  return (
    <div style={FeatureBodyBoxStyle} ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div
        style={InnerTileStyle}
        onClick={(e) => {
          e.stopPropagation()
          setEditOpen(true)
        }}
      >
        <LayoutIcon customLayout={customLayout} />
        <div style={FeatureBodyTextItemsStyle(showTextHoverEffect, showIcons, showDelete)}>
          <span style={NameTextStyle}>{title}</span>
          <span style={PropsTextStyle}>({count})</span>
        </div>
      </div>
      <div
        style={"display: flex;"}
        onMouseEnter={() => {
          setHoverIcon(true)
        }}
        onMouseLeave={() => {
          setHoverIcon(false)
        }}
      >
        {hover && (
          <div style={TileButtonsStyle}>
            <weave-icon-button
              onClick={(e) => {
                const boundingRect = ref.current?.getBoundingClientRect()
                togglePopup(
                  boundingRect?.top || e.clientY,
                  getDrawSettingFromCustomLayout(customLayout),
                  sectionsWithLayout.length ? sectionsWithLayout : undefined,
                )
              }}
            >
              {icons.swap}
            </weave-icon-button>
          </div>
        )}
        {showDelete && (
          <div style={TileButtonsStyle}>
            <weave-icon-button
              onClick={(e) => {
                e.stopPropagation()
                remove()
              }}
            >
              {icons.cross}
            </weave-icon-button>
          </div>
        )}
      </div>
      {editOpen && (
        <EditCustomSection
          setOpen={setEditOpen}
          customLayout={{ ...customLayout }}
          updateCustomLayout={(updatedCustomLayout: CustomLayout) => {
            setHover(false)
            customLayoutData.updateCustomLayout(updatedCustomLayout)
          }}
          editType={"edit"}
        />
      )}
    </div>
  )
}

const FeaturesWrapperOuterStyle = `
  max-height: 240px;
  overflow: auto;
  width: calc(100% + 13px);
  box-sizing: border-box;
`

const FeaturesWrapperInnerStyle = `
  width: 200px;
`
export const ActiveFloorPlans = ({
  activeCustomLayoutCounts,
  customLayoutInSelection,
  customLayoutData,
  lineBuildingParameters,
}: {
  activeCustomLayoutCounts: Record<string, number>
  customLayoutInSelection: Record<string, boolean | undefined>
  customLayoutData: CustomLayoutData
  lineBuildingParameters: LineBuildingParameters
}) => {
  return (
    <div style={FeaturesWrapperOuterStyle}>
      <div style={FeaturesWrapperInnerStyle}>
        {Object.entries(activeCustomLayoutCounts).map(([planId, count]) => {
          return (
            <FloorPlanTile
              key={planId}
              remove={() => customLayoutData.removeCustomLayout(planId)}
              customLayoutData={customLayoutData}
              customLayout={
                customLayoutData.customLayouts.find(
                  (customLayout: CustomLayout) => customLayout.id === planId,
                ) as CustomLayout
              }
              count={count}
              inSelection={!!customLayoutInSelection[planId]}
              lineBuildingParameters={lineBuildingParameters}
            />
          )
        })}
      </div>
    </div>
  )
}
