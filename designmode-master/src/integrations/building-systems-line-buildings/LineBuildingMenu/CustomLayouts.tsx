import type { PopupState } from "./CustomLayoutsPopUpMenu/AddCustomLayout"
import { AddFloorPlanPopUP } from "./CustomLayoutsPopUpMenu/AddCustomLayout"
import { useCallback, useEffect } from "preact/compat"
import { ActiveFloorPlans } from "./Features"
import type { CustomLayoutData } from "./LineBuildingMenus"
import { AddContentButton } from "./MenuStyles"
import { useMemo } from "preact/hooks"

import { atom, useRecoilState, useSetRecoilState } from "recoil"
import { ContentHeader } from "./ContentMenu"
import { useTranslator } from "src/i18n"
import { quickDrawTemporaryDumpAtom } from "src/integrations/building-systems-line-buildings/quickDrawState"
import { getLineBuildingEditConfig } from "src/integrations/building-systems-line-buildings/EditLineBuilding"
import { HiddenPaths } from "src/core/hidden"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { selectedPathsInCurrentProposalAsArraySignal } from "src/core/selection/selectionState"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { Sections } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { DrawSetting, SectionSelection } from "./types"

export const CustomLayoutsContent = ({
  customLayoutData,
  sectionSelection,
  lineBuildingParameters,
}: {
  customLayoutData: CustomLayoutData
  sectionSelection: SectionSelection
  lineBuildingParameters: LineBuildingParameters
}) => {
  const activeCustomLayoutCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const activeSectionIds = Object.keys(lineBuildingParameters.sectionProps)
    activeSectionIds.forEach((id) => {
      const feature = lineBuildingParameters.sectionProps[id]?.feature
      if (feature && feature.name === "CustomLayout") {
        const id = feature.customLayoutID
        counts[id] = (counts[id] || 0) + 1
      }
    })
    return counts
  }, [lineBuildingParameters.sectionProps])

  const customLayoutInSelection = useMemo(() => {
    const inSelection: Record<string, boolean | undefined> = {}
    sectionSelection.activeSectionIds.forEach((id) => {
      const feature = lineBuildingParameters.sectionProps[id]?.feature
      if (feature && feature.name === "CustomLayout") {
        const id = feature.customLayoutID
        inSelection[id] = true
      }
    })
    return inSelection
  }, [lineBuildingParameters.sectionProps, sectionSelection.activeSectionIds])

  const showRemove = useMemo(() => {
    return showRemoveButton(lineBuildingParameters, sectionSelection.activeSectionIds)
  }, [lineBuildingParameters, sectionSelection.activeSectionIds])
  const showSwap = true
  const togglePopup = useToggleCustomLayoutsPopup()
  return (
    <>
      <ContentHeader
        headerText={"Floor plans"}
        releaseCallback={undefined}
        swapCallback={
          showSwap
            ? (e: MouseEvent) => {
                togglePopup(e.clientY)
              }
            : undefined
        }
        removeCallback={showRemove ? () => customLayoutData.removeCustomLayout() : undefined}
      />
      <ActiveFloorPlans
        activeCustomLayoutCounts={activeCustomLayoutCounts}
        customLayoutInSelection={customLayoutInSelection}
        customLayoutData={customLayoutData}
        lineBuildingParameters={lineBuildingParameters}
      />
    </>
  )
}
const customLayoutsPopupStateAtom = atom<PopupState | undefined>({
  key: "customLayoutsPopupStateAtom",
  default: undefined,
})

const useToggleEditMode = () => {
  const selection = selectedPathsInCurrentProposalAsArraySignal.value

  return useCallback(
    (toggleOn: boolean) => {
      const editMode = toolAPI.currentToolSignal.peek().id === "editLineBuilding"
      if (toggleOn) {
        if (!editMode) toolAPI.setTool(getLineBuildingEditConfig(selection[0]))
      } else {
        HiddenPaths.resetHiddenPaths()
        exitCurrentTool()
      }
      return editMode
    },
    [selection],
  )
}

export const useToggleCustomLayoutsPopup = () => {
  const [state, setState] = useRecoilState(customLayoutsPopupStateAtom)
  const setTempState = useSetRecoilState(quickDrawTemporaryDumpAtom)

  const toggleEditMode = useToggleEditMode()
  return useCallback(
    (top: number, drawSetting?: DrawSetting, updatedSectionSelection?: string[]) => {
      const editMode = toggleEditMode(true)
      if (state) {
        setState({ ...state, top, drawSetting: drawSetting || state.drawSetting })
      } else {
        setState({ top, editModeOnOpen: editMode, drawSetting })
      }
      if (updatedSectionSelection) {
        setTempState((cur) => ({ ...cur, selectedSectionIds: updatedSectionSelection }))
      }
    },
    [setState, setTempState, state, toggleEditMode],
  )
}

export function showAddButton(
  lineBuildingParameters: LineBuildingParameters,
  activeSectionIds: string[],
  customCornerFlag: boolean = true,
) {
  const sections = lineBuildingParameters.sections
  return activeSectionIds
    .filter(
      (id) => sections[id]?.sectionType === "Rectangle" || (customCornerFlag && sections[id]?.sectionType === "Corner"),
    )
    .some((id) => !lineBuildingParameters.sectionProps?.[id]?.feature?.name)
}

export function showRemoveButton(lineBuildingParameters: LineBuildingParameters, activeSectionIds: string[]) {
  for (const activeSectionId of activeSectionIds) {
    const name = lineBuildingParameters.sectionProps?.[activeSectionId]?.feature?.name
    if (name !== undefined) return true
  }
  return false
}

export const AddCustomLayoutsButton = ({ disabled, tooltipText }: { disabled?: boolean; tooltipText?: string }) => {
  const t = useTranslator()
  const toggle = useToggleCustomLayoutsPopup()
  return (
    <AddContentButton
      title={t(($) => $.building.floorPlans.popupTitle)}
      addCallback={
        disabled
          ? undefined
          : (e: MouseEvent) => {
              toggle(e.clientY)
            }
      }
      tooltipText={tooltipText}
    />
  )
}
export const CustomLayoutsPopupWrapper = ({
  features,
  customLayoutData,
  sections,
  activeSectionIds,
  width,
}: {
  features: any
  customLayoutData: CustomLayoutData
  sections: Sections
  activeSectionIds: string[]
  width: number
}) => {
  const editMode = toolAPI.currentToolSignal.value.id === "editLineBuilding"
  const toggleEditMode = useToggleEditMode()
  const [popupState, setPopupState] = useRecoilState(customLayoutsPopupStateAtom)

  useEffect(() => {
    if (popupState && !editMode) setPopupState(undefined)
  }, [editMode, popupState, setPopupState])

  const closePopup = useCallback(() => {
    setPopupState(undefined)
    if (!popupState?.editModeOnOpen) toggleEditMode(false)
  }, [popupState?.editModeOnOpen, setPopupState, toggleEditMode])

  const activeFloorPlanIds = useMemo(
    () =>
      Object.values(features.Custom)
        .map((f: any) => f.customLayoutID as string)
        .filter((id) => customLayoutData.customLayouts.some((customLayout: CustomLayout) => customLayout.id === id)),
    [customLayoutData.customLayouts, features.Custom],
  )

  useEffect(() => {
    const keyup = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePopup()
      }
    }
    window.addEventListener("keyup", keyup)
    return () => window.removeEventListener("keyup", keyup)
  }, [closePopup])

  return (
    <>
      {editMode && popupState && (
        <AddFloorPlanPopUP
          state={popupState}
          close={closePopup}
          customLayoutData={customLayoutData}
          sections={sections}
          activeSectionIds={activeSectionIds}
          width={width}
          activeFloorPlanIds={activeFloorPlanIds}
        />
      )}
    </>
  )
}
