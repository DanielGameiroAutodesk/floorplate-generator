import { useCallback, useEffect, useMemo } from "preact/hooks"
import { useState } from "preact/compat"
import {
  DrawCornerSection,
  DrawRectangleSection,
  EditCustomSection,
} from "src/integrations/building-systems-line-buildings/LineBuildingMenu/DrawCustomLayout"
import { v4 as uuid } from "uuid"
import type { CustomLayoutData } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/LineBuildingMenus"
import {
  getDrawSettingButtonTitle,
  getDrawSettingId,
  getDrawSettingIdForSection,
  getSortedDrawSettings,
} from "src/integrations/building-systems-line-buildings/LineBuildingMenu/drawSettings"
import { useSetRecoilState } from "recoil"
import { quickDrawTemporaryDumpAtom } from "src/integrations/building-systems-line-buildings/quickDrawState"
import { useTranslator, type Translator } from "src/i18n"
import { LayoutIcon } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/Features"
import { newId, newRevision } from "src/lib/element/urn"
import { SelectedFloorPlanView } from "./SelectedFloorPlanView"
import {
  getLocalCustomLayoutsFilteredByDrawSetting,
  getProjectLevelCustomLayoutsFilteredByDrawSetting,
} from "./customLayoutsHelpers"
import TextInput from "src/integrations/inputs/TextInput"
import { Pencil } from "src/lib/components/icons/pencil"
import { HamburgerIcon } from "src/lib/components/icons/HamburgerIcon"
import { PlusIcon } from "src/lib/components/icons/PlusIcon"
import { icons } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/icons"
import PopUpBox from "src/lib/components/PopUps/PopUpBox"
import { PROJECT_ID } from "src/core/project/project"
import { AnalyticsLegacy } from "src/core/analytics"
import { proposalIdSignal } from "src/core/proposal"

import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { Sections } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { DrawSetting } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/types"
import { useIsImperial } from "src/lib/unitSettings"
import { legacyTrack } from "@spacemakerai/webapp-analytics"

/////
//
///

const FeatureBoxStyle = `
  display: flex;
  height: 40px;
  cursor: pointer;
  box-sizing: border-box;
`

const FeatureBoxTextItemsStyle = (hover: boolean, numberOfIcons: number) => `
  height: 36px;
  min-width: 50px;
  max-width: ${numberOfIcons === 2 ? "134px" : numberOfIcons === 1 ? "162px" : "190px"};
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 10px;
  ${hover ? "background: var(--background-color-ghost-high-hover);" : ""}

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`

const FeatureBoxTitleStyle = `
  font: var(--11-medium);
`

function getCustomLayoutTitle(feature: any) {
  return feature?.name || ""
}

function FloorPlanContextMenu({
  close,
  contextMenuOpenPosition,
  setEditOpen,
  customLayout,
  customLayoutData,
  toggleEditName,
  isProjectLevel,
}: {
  close: () => any
  contextMenuOpenPosition: { top: number; left: number }
  setEditOpen: (k: EditMenuType) => any
  customLayout: CustomLayout
  customLayoutData: CustomLayoutData
  toggleEditName: (t: boolean) => any
  isProjectLevel: boolean
}) {
  const t = useTranslator()
  return (
    <div
      style={`position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100001;`}
      onClick={(e) => {
        close()
        e.stopPropagation()
      }}
    >
      <forma-context-menu-container
        left={contextMenuOpenPosition.left}
        top={contextMenuOpenPosition.top}
        onClose={() => close()}
      >
        <forma-context-menu>
          {!isProjectLevel && (
            <>
              <forma-context-menu-item
                text={t(($) => $.ui.rename)}
                onClick={() => {
                  toggleEditName(true)
                  close()
                }}
              />
              <forma-context-menu-item
                text={t(($) => $.building.floorPlans.addToLibraryButton)}
                onClick={() => {
                  const newPlan = { ...customLayout, id: newId(), revision: newRevision() }
                  customLayoutData.updateProjectLevelLayouts(customLayoutData.projectLevelLayouts.concat([newPlan]))
                  close()
                }}
              />
              <forma-context-menu-item
                text={t(($) => $.ui.edit)}
                onClick={() => {
                  // Don't track this with new tracking schema
                  AnalyticsLegacy.track("Line Building - Open FPS", { fpsMode: "edit" })
                  legacyTrack("Design Mode: Floor plan sketcher - Opened", {
                    projectId: PROJECT_ID,
                    proposalId: proposalIdSignal.peek(),
                    buildingType: "lineBuilding",
                    fpsMode: "edit",
                  })
                  setEditOpen({ type: "edit", customLayout })
                  close()
                }}
              />
              <forma-context-menu-item
                text={t(($) => $.ui.duplicate)}
                onClick={() => {
                  setEditOpen({ type: "duplicate", customLayout })
                  close()
                }}
              />
              <forma-context-menu-item
                text={t(($) => $.ui.delete)}
                onClick={() => {
                  customLayoutData.deleteCustomLayout(customLayout.id)
                  close()
                }}
              />
            </>
          )}
          {isProjectLevel && (
            <>
              <forma-context-menu-item
                text={t(($) => $.ui.rename)}
                onClick={() => {
                  toggleEditName(true)
                  close()
                }}
              />
              <forma-context-menu-item
                text={t(($) => $.ui.duplicate)}
                onClick={() => {
                  // Don't track this with new tracking schema
                  AnalyticsLegacy.track("Line Building - Open FPS", { fpsMode: "duplicate" })
                  legacyTrack("Design Mode: Floor plan sketcher - Opened", {
                    projectId: PROJECT_ID,
                    proposalId: proposalIdSignal.peek(),
                    buildingType: "lineBuilding",
                    fpsMode: "duplicate",
                  })
                  setEditOpen({ type: "duplicate", customLayout })
                  close()
                }}
              />
              <forma-context-menu-item
                text={t(($) => $.ui.delete)}
                onClick={() => {
                  customLayoutData.deleteCustomLayoutProjectLevel(customLayout.id)
                  close()
                }}
              />
            </>
          )}
        </forma-context-menu>
      </forma-context-menu-container>
    </div>
  )
}

const FloorPlanTitleStyle = `
  font: var(--11-medium);

  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 100%;
`

function FloorPlanTitle({ customLayout, toggleEdit }: { customLayout: CustomLayout; toggleEdit: (t: boolean) => any }) {
  const title = getCustomLayoutTitle(customLayout)
  return (
    <div
      style={FloorPlanTitleStyle}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={() => toggleEdit(true)}
    >
      {title}
    </div>
  )
}

const FloorPlanTitleEditStyle = `
    font-family: Artifakt Element, sans-serif;
    font-style: normal;
    font-weight: 600;
    font-size: 11px;
    line-height: 14px;
    color: #3C3C3C;

    margin-left: 7px;
    width: 187px;
`

function FloorPlanTitleEdit({
  customLayout,
  customLayoutData,
  edit,
  toggleEdit,
  isProjectLevel,
}: {
  customLayout: CustomLayout
  customLayoutData: CustomLayoutData
  edit: boolean
  toggleEdit: (t: boolean) => any
  isProjectLevel: boolean
}) {
  const title = getCustomLayoutTitle(customLayout)

  return (
    <div style={FloorPlanTitleEditStyle} onKeyDown={(e) => e.stopPropagation()}>
      <TextInput
        initialValue={title}
        onChange={(value) => {
          if (isProjectLevel) {
            customLayoutData.updateCustomLayoutProjectLevel({ ...customLayout, name: value })
          } else {
            customLayoutData.updateCustomLayout({ ...customLayout, name: value })
          }
        }}
        onBlur={(value) => {
          if (isProjectLevel) {
            customLayoutData.updateCustomLayoutProjectLevel({ ...customLayout, name: value })
          } else {
            customLayoutData.updateCustomLayout({ ...customLayout, name: value })
          }
          toggleEdit(false)
        }}
        isSelected={edit}
      />
    </div>
  )
}

const BookmarkStyle = `
  width: 12px;
  height: 12px;
  display: flex;
  position: absolute;
  bottom: -2px;
  right: -7px;
`

const FloorPlanItem = ({
  customLayout,
  isPlanInUse,
  customLayoutData,
  setEditOpen,
  isProjectLevel,
}: {
  customLayout: CustomLayout
  isPlanInUse: boolean
  customLayoutData: CustomLayoutData
  setEditOpen: (k: EditMenuType) => any
  isProjectLevel: boolean
}) => {
  const t = useTranslator()
  const [hover, setHover] = useState(false)
  const [hoverIcon, setHoverIcon] = useState(false)
  const [editName, setEditName] = useState(false)

  const [contextMenuOpenPosition, setContextMenuOpenPosition] = useState<undefined | { top: number; left: number }>(
    undefined,
  )
  const projectLevelMisMatch = false

  useEffect(() => {
    if (!contextMenuOpenPosition) setHover(false)
  }, [contextMenuOpenPosition])

  const showTitleHoverEffect = hover && !editName && !hoverIcon && contextMenuOpenPosition === undefined
  const showContextMenuIcon = hover && !editName
  const showEditPlanIcon = hover && !editName && !isProjectLevel
  const numberOfIcons = showEditPlanIcon && showContextMenuIcon ? 2 : showContextMenuIcon ? 1 : 0
  return (
    <div
      style={FeatureBoxStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        if (isProjectLevel) {
          customLayoutData.selectCustomLayoutProjectLevel(customLayout.id)
        } else {
          customLayoutData.selectCustomLayout(customLayout.id)
        }
      }}
      onContextMenu={(e) => {
        setContextMenuOpenPosition({ top: e.clientY, left: e.clientX })
        e.preventDefault()
      }}
    >
      <div style={`display: flex; justify-content: space-between; width: 100%; align-items: center`}>
        <div style={`display: flex; align-items: center;`}>
          <div style={`position: relative;`}>
            <LayoutIcon customLayout={customLayout} borderColor={isPlanInUse ? "#0E8FE5" : undefined} />
            {isProjectLevel && <div style={BookmarkStyle}>{icons.bookmark}</div>}
          </div>
          {!editName && (
            <div style={FeatureBoxTextItemsStyle(showTitleHoverEffect, numberOfIcons)}>
              <FloorPlanTitle
                toggleEdit={projectLevelMisMatch ? () => undefined : setEditName}
                customLayout={customLayout}
              />
              {projectLevelMisMatch && (
                <div style={"color: red; padding-left: 3px;"}>{t(($) => $.building.lineBuilding.outdatedLabel)}</div>
              )}
            </div>
          )}
          {editName && (
            <FloorPlanTitleEdit
              customLayout={customLayout}
              customLayoutData={customLayoutData}
              edit={editName}
              toggleEdit={setEditName}
              isProjectLevel={isProjectLevel}
            />
          )}
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
          {showEditPlanIcon && (
            <div style={"width: 28px;"}>
              <weave-icon-button
                onClick={(e) => {
                  e.stopPropagation()
                  // Don't track this with new tracking schema
                  AnalyticsLegacy.track("Line Building - Open FPS", { fpsMode: "edit" })
                  legacyTrack("Design Mode: Floor plan sketcher - Opened", {
                    projectId: PROJECT_ID,
                    proposalId: proposalIdSignal.peek(),
                    buildingType: "lineBuilding",
                    fpsMode: "edit",
                  })
                  setEditOpen({ type: "edit", customLayout })
                }}
              >
                <Pencil />
              </weave-icon-button>
            </div>
          )}
          {showContextMenuIcon && (
            <div style={"width: 28px;"}>
              <weave-icon-button
                onClick={(e) => {
                  setContextMenuOpenPosition({ top: e.clientY, left: e.clientX })
                  e.stopPropagation()
                }}
              >
                <HamburgerIcon />
              </weave-icon-button>
            </div>
          )}
        </div>
      </div>
      {contextMenuOpenPosition && (
        <FloorPlanContextMenu
          close={() => setContextMenuOpenPosition(undefined)}
          contextMenuOpenPosition={contextMenuOpenPosition}
          setEditOpen={setEditOpen}
          customLayout={customLayout}
          customLayoutData={customLayoutData}
          toggleEditName={setEditName}
          isProjectLevel={isProjectLevel}
        />
      )}
    </div>
  )
}

const EmptyPromptBoxStyle = `
  display: flex;
  align-items: center;
  justify-content: center;
`

const EmptyFloorPlanListPrompt = () => {
  return <div style={EmptyPromptBoxStyle} />
}

const FloorPlanListStyle = `
  width: 100%;
  max-height: 182px;
  box-sizing: border-box;
  padding-left: 16px;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
`

const FloorPlanListInnerStyle = `
  width: 226px;
  padding-bottom: 14px;
`

const FloorPlanList = ({
  customLayoutData,
  drawSetting,
  setEditOpen,
  activeFloorPlanIds,
}: {
  customLayoutData: CustomLayoutData
  drawSetting: DrawSetting | undefined
  setEditOpen: (k: EditMenuType) => any
  activeFloorPlanIds: string[]
}) => {
  const { customLayoutsProjectLevel, customLayoutsLocalLevel } = useMemo(() => {
    const customLayoutsProjectLevel = getProjectLevelCustomLayoutsFilteredByDrawSetting(customLayoutData, drawSetting)
    const customLayoutsLocalLevel = getLocalCustomLayoutsFilteredByDrawSetting(customLayoutData, drawSetting)
    return { customLayoutsProjectLevel, customLayoutsLocalLevel }
  }, [drawSetting, customLayoutData])

  const showEmptyFloorPlanListPrompt = customLayoutsProjectLevel.length === 0 && customLayoutsLocalLevel.length === 0
  return (
    <>
      {customLayoutsLocalLevel.map((customLayout: CustomLayout) => {
        return (
          <FloorPlanItem
            key={customLayout.id}
            customLayout={customLayout}
            isPlanInUse={activeFloorPlanIds.includes(customLayout.id)}
            customLayoutData={customLayoutData}
            setEditOpen={setEditOpen}
            isProjectLevel={false}
          />
        )
      })}
      {customLayoutsProjectLevel.map((customLayout: CustomLayout) => {
        return (
          <FloorPlanItem
            key={customLayout.id}
            customLayout={customLayout}
            isPlanInUse={false}
            customLayoutData={customLayoutData}
            setEditOpen={setEditOpen}
            isProjectLevel={true}
          />
        )
      })}
      {showEmptyFloorPlanListPrompt && <EmptyFloorPlanListPrompt />}
    </>
  )
}

/////
// Draw new custom layout
////

const DrawNewCustomLayoutWrapperStyle = `
  width: 100%;
  box-sizing: border-box;
  padding-left: 16px;
  padding-right: 16px;
  padding-top: 6px;
  min-height: 48px;

  display: flex;
  flex-wrap: wrap;
  align-items: center;
`

const DrawSettingsButtonStyle = `
  display: flex;
  justify-content: center;
  align-items: center;


  border: none;
  box-sizing: border-box;

  height: 24px;

  cursor: pointer;
  margin-right: 15px;
  margin-bottom: 8px;

  background: transparent;

  font: var(--12-regular);
  text-align: center;
`

const HoveredDrawSettingsButtonStyle = `
  background: rgba(205, 234, 247, 0.6);
`

const SelectedDrawSettingsButtonStyle = `
  font-weight: 700;
  box-shadow: inset 0px -2px 0px #0696D7, inset 0px -1px 0px rgba(128, 128, 128, 0.35);
`

const SelectDrawSetting = ({
  customLayoutData,
  drawSetting: selectedDrawSetting,
  setDrawSetting,
  sections,
  activeSectionIds,
  width,
}: {
  customLayoutData: CustomLayoutData
  drawSetting: DrawSetting | undefined
  setDrawSetting: (drawSetting: DrawSetting | undefined) => void
  sections: Sections
  activeSectionIds: string[]
  width: number
}) => {
  const setQuickDrawState = useSetRecoilState(quickDrawTemporaryDumpAtom)
  useEffect(() => {
    const selectedId = selectedDrawSetting ? getDrawSettingId(selectedDrawSetting) : undefined
    const hoverIds = activeSectionIds.filter((sectionId) => {
      const drawSettingId = getDrawSettingIdForSection(sections[sectionId], width)
      return drawSettingId === selectedId
    })
    setQuickDrawState((old) => ({ ...old, hoverSectionIds: hoverIds }))
    return () => setQuickDrawState((old) => ({ ...old, hoverSectionIds: [] }))
  }, [activeSectionIds, sections, selectedDrawSetting, setQuickDrawState, width])

  const imperialFlag = useIsImperial()

  const drawSettings = customLayoutData.drawSettings
  const [hoverButton, setHoverButton] = useState<undefined | string>(undefined)

  const sortedDrawSettings = useMemo(() => {
    return getSortedDrawSettings(drawSettings, imperialFlag)
  }, [drawSettings, imperialFlag])

  useEffect(() => {
    const inSelection = sortedDrawSettings.some((drawSetting) => {
      return selectedDrawSetting && getDrawSettingId(drawSetting) === getDrawSettingId(selectedDrawSetting)
    })
    if (!inSelection) {
      setDrawSetting(sortedDrawSettings[0])
    }
  }, [selectedDrawSetting, sortedDrawSettings, setDrawSetting])

  const showTabs = sortedDrawSettings.length > 1

  return (
    <>
      {showTabs && (
        <div style={DrawNewCustomLayoutWrapperStyle}>
          {sortedDrawSettings.map((drawSetting: DrawSetting) => {
            const drawSettingId = getDrawSettingId(drawSetting)
            const buttonTitle = getDrawSettingButtonTitle(drawSetting, imperialFlag)
            const selected = selectedDrawSetting && getDrawSettingId(selectedDrawSetting) === drawSettingId
            const hovered = hoverButton === drawSettingId
            // const numberOfSections = numberOfSectionsMap[drawSettingId] || 0
            return (
              <button
                key={drawSettingId}
                style={
                  DrawSettingsButtonStyle +
                  (selected ? SelectedDrawSettingsButtonStyle : "") +
                  (hovered ? HoveredDrawSettingsButtonStyle : "")
                }
                onClick={() => {
                  setDrawSetting(drawSetting)
                }}
                onMouseEnter={() => {
                  setHoverButton(drawSettingId)
                }}
                onMouseLeave={() => {
                  setHoverButton(undefined)
                }}
              >
                <span style={""}>{buttonTitle}</span>
              </button>
            )
          })}
        </div>
      )}
      {!showTabs && <div style={"height: 14px;"} />}
    </>
  )
}

////
// Draw new Button and name input
///

const DrawNewWrapperStyle = `
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  display: flex;
  align-items: center;
`

const DrawNewButtonStyle = `
  height: 36px;
  width: 100%;
  display: flex;
  cursor: pointer;
`

const DrawNewButtonIconStyle = `
  width: 36px;
  height: 36px;
  background: var(--background-color-surface-200);
  display: flex;
  align-items: center;
  justify-content: center;
`

const DrawNewButtonTextStyle = `
  height: 36px;
  width: calc(100% - 36px);
  box-sizing: border-box;
  padding-left: 12px;
  display: flex;
  align-items: center;

  font: var(--11-medium);
`

const DrawNewButtonTextHoverStyle =
  DrawNewButtonTextStyle +
  `
   background: var(--background-color-ghost-high-hover);
`

function getDrawNewButtonText(t: Translator, drawSetting: DrawSetting | undefined, customCornerFlag?: boolean) {
  if (drawSetting?.sectionType === "Rectangle") return t(($) => $.building.lineBuilding.addNewFloorPlan)
  if (drawSetting?.sectionType === "Split") return t(($) => $.building.floorPlans.cannotDrawSplitDescription)
  if (drawSetting?.sectionType === "Corner") {
    if (customCornerFlag) return t(($) => $.building.lineBuilding.addNewFloorPlan)
    return t(($) => $.building.floorPlans.cannotDrawCornerDescription)
  }
  return ""
}

const DrawNewLayout = ({
  drawSetting,
  customLayoutData,
}: {
  drawSetting: DrawSetting | undefined
  customLayoutData: CustomLayoutData
}) => {
  const customCornerFlag = true
  const [open, setOpen] = useState(false)
  const [hoverButton, setHoverButton] = useState(false)
  const newLayoutName = useMemo(() => {
    const counter = customLayoutData.customLayouts.reduce((acc, floorPlan) => {
      if (floorPlan.name?.startsWith("Floor plan")) {
        const counter = floorPlan.name?.split(" ")[2]
        if (counter) {
          return Math.max(acc, parseInt(counter))
        }
      }
      return acc
    }, 0)
    return "Floor plan " + (counter + 1)
  }, [customLayoutData.customLayouts])
  let disabled = drawSetting?.sectionType !== "Rectangle"
  if (customCornerFlag) {
    disabled = drawSetting?.sectionType === "Split"
  }
  const onClick = useCallback(() => {
    if (disabled) return
    // Don't track this with new tracking schema
    AnalyticsLegacy.track("Line Building - Open FPS", { fpsMode: "draw new" })
    legacyTrack("Design Mode: Floor plan sketcher - Opened", {
      projectId: PROJECT_ID,
      proposalId: proposalIdSignal.peek(),
      buildingType: "lineBuilding",
      fpsMode: "draw new",
    })
    setOpen(true)
  }, [disabled])

  const t = useTranslator()

  const buttonText = getDrawNewButtonText(t, drawSetting, customCornerFlag)
  return (
    <div style={DrawNewWrapperStyle + FeatureBoxTitleStyle}>
      {!disabled && (
        <div
          style={DrawNewButtonStyle}
          onMouseEnter={() => {
            setHoverButton(true)
          }}
          onMouseLeave={() => setHoverButton(false)}
          onClick={() => {
            setOpen(true)
          }}
        >
          <div style={DrawNewButtonIconStyle}>
            <PlusIcon />
          </div>
          <div style={hoverButton || open ? DrawNewButtonTextHoverStyle : DrawNewButtonTextStyle} onClick={onClick}>
            {buttonText}
          </div>
        </div>
      )}
      {disabled && <div>{buttonText}</div>}
      {open && drawSetting?.sectionType === "Rectangle" && (
        <DrawRectangleSection
          width={drawSetting.width}
          length={drawSetting.length}
          storyHeight={3}
          setOpen={setOpen}
          addCustomLayout={(customLayout: CustomLayout) => {
            customLayoutData.addCustomLayout({ ...customLayout, name: newLayoutName })
          }}
        />
      )}
      {open && drawSetting?.sectionType === "Corner" && (
        <DrawCornerSection
          startLeg={drawSetting.startLeg}
          endLeg={drawSetting.endLeg}
          width={drawSetting.width}
          angle={drawSetting.angle}
          storyHeight={3}
          setOpen={setOpen}
          addCustomLayout={(customLayout: CustomLayout) => {
            customLayoutData.addCustomLayout({ ...customLayout, name: newLayoutName })
          }}
        />
      )}
    </div>
  )
}

//////
// PopUP
///

const MainBodyStyle = `
  width: 260px;
  display: flex;
  flex-direction: column;
`

export type PopupState = {
  top: number
  editModeOnOpen?: boolean
  drawSetting?: DrawSetting | undefined
  customId?: string | undefined
}

type EditMenuType = { type: "edit" | "duplicate"; customLayout: CustomLayout }
export const AddFloorPlanPopUP = ({
  state,
  customLayoutData,
  close,
  sections,
  activeSectionIds,
  width,
  activeFloorPlanIds,
}: {
  state: PopupState
  customLayoutData: CustomLayoutData
  close: () => void
  sections: Sections
  activeSectionIds: string[]
  width: number
  activeFloorPlanIds: string[]
}) => {
  const t = useTranslator()
  const [drawSetting, setDrawSetting] = useState<undefined | DrawSetting>(undefined)

  useEffect(() => setDrawSetting(state?.drawSetting), [state?.drawSetting])

  const top = useMemo(() => {
    return Math.min(state?.top || 0, window.innerHeight - 516)
  }, [state?.top])

  const [editOpen, setEditOpen] = useState<undefined | EditMenuType>(undefined)
  const haveActiveSections = activeSectionIds.length > 0
  return (
    <>
      <PopUpBox.Container
        top={top}
        header={<PopUpBox.DefaultHeader onClose={close} title={t(($) => $.building.floorPlans.popupTitle)} />}
        id={"line_buildings_floor_plans_box"}
      >
        <SelectedFloorPlanView
          activeFloorPlanIds={activeFloorPlanIds}
          customLayoutData={customLayoutData}
          drawSetting={drawSetting}
        />
        <div style={MainBodyStyle}>
          {haveActiveSections && (
            <SelectDrawSetting
              customLayoutData={customLayoutData}
              drawSetting={drawSetting}
              setDrawSetting={setDrawSetting}
              sections={sections}
              activeSectionIds={activeSectionIds}
              width={width}
            />
          )}
          {!haveActiveSections && (
            <div style={"padding: 16px;"}>{t(($) => $.building.floorPlans.selectSectionsDescription)}</div>
          )}
          {haveActiveSections && (
            <div style={FloorPlanListStyle}>
              <div style={FloorPlanListInnerStyle}>
                <DrawNewLayout customLayoutData={customLayoutData} drawSetting={drawSetting} />
                <FloorPlanList
                  customLayoutData={customLayoutData}
                  drawSetting={drawSetting}
                  setEditOpen={setEditOpen}
                  activeFloorPlanIds={activeFloorPlanIds}
                />
              </div>
            </div>
          )}
        </div>
      </PopUpBox.Container>
      {editOpen && (
        <EditCustomSection
          setOpen={() => {
            setEditOpen(undefined)
          }}
          customLayout={{ ...editOpen.customLayout }}
          updateCustomLayout={(updatedCustomLayout: CustomLayout) => {
            if (editOpen.type === "duplicate") {
              const customID = uuid().slice(0, 6)
              customLayoutData.addCustomLayout({ ...updatedCustomLayout, id: customID })
            } else {
              customLayoutData.updateCustomLayout(updatedCustomLayout)
            }
          }}
          editType={editOpen.type}
        />
      )}
    </>
  )
}
