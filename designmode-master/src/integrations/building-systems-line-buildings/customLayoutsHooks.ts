import { useRecoilValue } from "recoil"
import { useCallback, useMemo } from "preact/hooks"
import { useUpdateParametersOnLineBuildingElement } from "./quick-draw-selection-hooks"
import { getDrawSettingFromSection, getDrawSettingId } from "./LineBuildingMenu/drawSettings"
import type { CustomLayoutData } from "./LineBuildingMenu/LineBuildingMenus"

import { projectLevelFloorPlansSelector, useUpdateProjectLevelFloorPlans } from "./projectLevelFloorPlans"
import type { FormaElement } from "@spacemakerai/element-types"
import { newId, newRevision } from "src/lib/element/urn"
import type { Section } from "@spacemakerai/line-buildings-shared/lineBuildingGenerator/lib/graphBuilding3000"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { DrawSetting } from "./LineBuildingMenu/types"

function doesLayoutFitSection(section: Section, customLayout: CustomLayout, width: number) {
  if (!section) return false
  if (section.sectionType === "Rectangle" && customLayout.sectionType === "Rectangle") {
    if (Math.abs(width - customLayout.width) > 1e-5) return false
    return Math.abs(section.length - customLayout.length) < 1e-5
  }
  if (section.sectionType === "Corner" && customLayout.sectionType === "Corner") {
    if (Math.abs(width - customLayout.width) > 1e-5) return false
    const longestLeg = Math.max(section.startLeg, section.endLeg)
    const shortestLeg = Math.min(section.startLeg, section.endLeg)
    const positiveAngle = Math.abs(section.angle)

    if (Math.abs(longestLeg - customLayout.startLeg) > 1e-5) return false
    if (Math.abs(shortestLeg - customLayout.endLeg) > 1e-5) return false
    return Math.abs(positiveAngle - customLayout.angle) < 1e-5
  }
  return false
}

/////
//
///

function useAddCustomLayout(element: FormaElement, elementId: string, activeSectionIds: string[]) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  return useCallback(
    (customLayout: CustomLayout) => {
      const feature = { name: "CustomLayout", customLayoutID: customLayout.id }
      const sections = params.sections
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      for (let sectionID of activeSectionIds) {
        const section = sections[sectionID]
        if (!doesLayoutFitSection(section, customLayout, params.width)) continue
        const props = updatedSectionProps[sectionID]
        updatedSectionProps[sectionID] = { ...props, feature: feature }
      }

      const updatedCustomLayouts = [...params.customLayouts, customLayout]
      let updatedParams = {
        ...params,
        sectionProps: updatedSectionProps,
        customLayouts: updatedCustomLayouts,
      }

      updateParametersOnBuilding(updatedParams)
    },
    [params, updateParametersOnBuilding, activeSectionIds],
  )
}

function useDeleteCustomLayout(element: FormaElement, elementId: string) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const params: LineBuildingParameters = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  return useCallback(
    (customLayoutID: string) => {
      if (params.customLayouts.some((l) => l.id === customLayoutID)) {
        const updatedCustomLayouts = params.customLayouts.filter(
          (customLayout: CustomLayout) => customLayout.id !== customLayoutID,
        )
        let updatedSectionProps = { ...(params?.sectionProps || {}) }
        for (let sectionID of Object.keys(updatedSectionProps)) {
          const props = updatedSectionProps[sectionID]
          if (props?.feature?.name === "CustomLayout" && props?.feature.customLayoutID === customLayoutID) {
            updatedSectionProps[sectionID] = { ...props }
            delete updatedSectionProps[sectionID].feature
          }
        }

        let updatedParams = { ...params, customLayouts: updatedCustomLayouts, sectionProps: updatedSectionProps }
        if (params?.feature?.customLayoutID === customLayoutID) {
          updatedParams = { ...updatedParams, feature: undefined }
        }

        updateParametersOnBuilding(updatedParams)
      }
    },
    [params, updateParametersOnBuilding],
  )
}

function useDeleteCustomLayoutProjectLevel() {
  const projectLevel = useRecoilValue(projectLevelFloorPlansSelector)
  const updateProjectLevel = useUpdateProjectLevelFloorPlans()

  return useCallback(
    (customLayoutID: string) => {
      if (projectLevel.some((l) => l.id === customLayoutID)) {
        updateProjectLevel(projectLevel.filter((l) => l.id !== customLayoutID))
      }
    },
    [projectLevel, updateProjectLevel],
  )
}

function useUpdateCustomLayout(element: FormaElement, elementId: string) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const params: LineBuildingParameters = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  return useCallback(
    (_updatedCustomLayout: CustomLayout, keepRevision: boolean = false, _oldId: string | undefined = undefined) => {
      const updatedCustomLayout = keepRevision
        ? _updatedCustomLayout
        : { ..._updatedCustomLayout, revision: newRevision() }
      const customLayouts = params.customLayouts
      const oldId = _oldId || updatedCustomLayout.id
      if (customLayouts.some((l) => l.id === oldId)) {
        const updatedCustomLayouts = customLayouts.map((customLayout: CustomLayout) => {
          if (customLayout.id !== oldId) return customLayout
          return updatedCustomLayout
        })
        const updatedParams = { ...params, customLayouts: updatedCustomLayouts }
        if (oldId !== updatedCustomLayout.id) {
          // flip sections to new id
          const updatedSectionProps = { ...(params?.sectionProps || {}) }
          for (let sectionID of Object.keys(updatedSectionProps)) {
            const props = updatedSectionProps[sectionID]
            if (props?.feature?.name === "CustomLayout" && props?.feature.customLayoutID === oldId) {
              updatedSectionProps[sectionID] = {
                ...props,
                feature: { ...props.feature, customLayoutID: updatedCustomLayout.id },
              }
            }
          }
          updatedParams.sectionProps = updatedSectionProps
        }
        updateParametersOnBuilding(updatedParams)
      }
    },
    [params, updateParametersOnBuilding],
  )
}

function useUpdateCustomLayoutProjectLevel() {
  const projectLevel = useRecoilValue(projectLevelFloorPlansSelector)
  const updateProjectLevel = useUpdateProjectLevelFloorPlans()

  return useCallback(
    (_updatedCustomLayout: CustomLayout, keepRevision: boolean = false, _oldId: string | undefined = undefined) => {
      const updatedCustomLayout = keepRevision
        ? _updatedCustomLayout
        : { ..._updatedCustomLayout, revision: newRevision() }
      const oldId = _oldId || updatedCustomLayout.id

      if (projectLevel.some((l) => l.id === oldId)) {
        updateProjectLevel(projectLevel.map((l) => (l.id === oldId ? updatedCustomLayout : l)))
      }
    },
    [projectLevel, updateProjectLevel],
  )
}

function useRemoveCustomLayoutFromSelection(element: FormaElement, elementId: string, activeSectionIds: string[]) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  return useCallback(
    (customLayoutID: string | undefined) => {
      let updatedSectionProps = { ...(params?.sectionProps || {}) }
      for (let sectionID of activeSectionIds) {
        const props = updatedSectionProps[sectionID]
        if (props?.feature?.customLayoutID === customLayoutID || customLayoutID === undefined) {
          updatedSectionProps[sectionID] = { ...props, feature: undefined }
        }
      }

      let updatedParams = { ...params, sectionProps: updatedSectionProps }

      updateParametersOnBuilding(updatedParams)
    },
    [params, activeSectionIds, updateParametersOnBuilding],
  )
}

function useApplyCustomLayoutToSelection(element: FormaElement, elementId: string, activeSectionIds: string[]) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  return useCallback(
    (customLayoutID: string) => {
      const feature = { name: "CustomLayout", customLayoutID: customLayoutID }
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      const customLayouts = params.customLayouts
      const customLayout = customLayouts.find((customLayout: CustomLayout) => customLayout.id === customLayoutID)
      if (!customLayout) return
      for (let sectionID of activeSectionIds) {
        const section = params.sections[sectionID]
        if (!doesLayoutFitSection(section, customLayout, params.width)) continue
        const props = updatedSectionProps[sectionID]
        updatedSectionProps[sectionID] = { ...props, feature: feature }
      }
      const updatedParams = {
        ...params,
        sectionProps: updatedSectionProps,
      }
      updateParametersOnBuilding(updatedParams)
    },
    [params, updateParametersOnBuilding, activeSectionIds],
  )
}

function useApplyCustomLayoutToSelectionProjectLevel(
  element: FormaElement,
  elementId: string,
  activeSectionIds: string[],
) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const projectLevelPlans = useRecoilValue(projectLevelFloorPlansSelector)
  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  return useCallback(
    (customLayoutID: string) => {
      const projectCustomLayout = projectLevelPlans.find((l) => l.id === customLayoutID)
      if (!projectCustomLayout) return

      const localCustomLayout = params.customLayouts.find((customLayout: CustomLayout) => {
        return (
          customLayout.libraryId === projectCustomLayout.id && customLayout.revision === projectCustomLayout.revision
        )
      })

      if (localCustomLayout) {
        const newLayoutId = localCustomLayout.id
        const feature = { name: "CustomLayout", customLayoutID: newLayoutId }

        let updatedSectionProps = { ...(params.sectionProps || {}) }

        for (let sectionID of activeSectionIds) {
          const section = params.sections[sectionID]
          if (!doesLayoutFitSection(section, localCustomLayout, params.width)) continue
          const props = updatedSectionProps[sectionID]
          updatedSectionProps[sectionID] = { ...props, feature: feature }
        }

        const updatedParams = {
          ...params,
          sectionProps: updatedSectionProps,
        }
        updateParametersOnBuilding(updatedParams)
      } else {
        const newLayoutId = newId()
        const feature = { name: "CustomLayout", customLayoutID: newLayoutId }

        let updatedSectionProps = { ...(params.sectionProps || {}) }

        for (let sectionID of activeSectionIds) {
          const section = params.sections[sectionID]
          if (!doesLayoutFitSection(section, projectCustomLayout, params.width)) continue
          const props = updatedSectionProps[sectionID]
          updatedSectionProps[sectionID] = { ...props, feature: feature }
        }
        const customLayoutWithNewId: CustomLayout = {
          ...projectCustomLayout,
          id: newLayoutId,
          libraryId: projectCustomLayout.id,
        }

        const updatedParams = {
          ...params,
          sectionProps: updatedSectionProps,
          customLayouts: [...params.customLayouts, customLayoutWithNewId],
        }
        updateParametersOnBuilding(updatedParams)
      }
    },
    [params, projectLevelPlans, updateParametersOnBuilding, activeSectionIds],
  )
}

function useUpdateCustomLayoutSettings(element: FormaElement, elementId: string, activeSectionIds: string[]) {
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(elementId)
  const params: LineBuildingParameters = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const rotate = useCallback(
    (layoutIds: string[]) => {
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      activeSectionIds.forEach((sectionID: string) => {
        const props = updatedSectionProps[sectionID]
        const feature = props?.feature
        if (feature?.name === "CustomLayout" && layoutIds.includes(feature.customLayoutID)) {
          const oldFlipX = feature.settings?.flipX
          const oldFlipY = feature.settings?.flipY
          const updatedSettings = { ...feature.settings, flipX: !oldFlipX, flipY: !oldFlipY }
          const updatedFeature = { ...feature, settings: updatedSettings }
          updatedSectionProps[sectionID] = { ...props, feature: updatedFeature }
        }
      })
      const updatedParams = { ...params, sectionProps: updatedSectionProps }
      updateParametersOnBuilding(updatedParams)
    },
    [params, updateParametersOnBuilding, activeSectionIds],
  )

  const mirror = useCallback(
    (layoutIds: string[]) => {
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      activeSectionIds.forEach((sectionID: string) => {
        const props = updatedSectionProps[sectionID]
        const feature = props?.feature
        if (feature?.name === "CustomLayout" && layoutIds.includes(feature.customLayoutID)) {
          const oldFlipY = feature.settings?.flipY
          const updatedSettings = { ...feature.settings, flipY: !oldFlipY }
          const updatedFeature = { ...feature, settings: updatedSettings }
          updatedSectionProps[sectionID] = { ...props, feature: updatedFeature }
        }
      })
      const updatedParams = { ...params, sectionProps: updatedSectionProps }
      updateParametersOnBuilding(updatedParams)
    },
    [params, updateParametersOnBuilding, activeSectionIds],
  )

  const flipLeftRight = useCallback(
    (layoutIds: string[]) => {
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      activeSectionIds.forEach((sectionID: string) => {
        const props = updatedSectionProps[sectionID]
        const feature = props?.feature
        if (feature?.name === "CustomLayout" && layoutIds.includes(feature.customLayoutID)) {
          const oldFlipX = feature.settings?.flipX
          const updatedSettings = { ...feature.settings, flipX: !oldFlipX }
          const updatedFeature = { ...feature, settings: updatedSettings }
          updatedSectionProps[sectionID] = { ...props, feature: updatedFeature }
        }
      })
      const updatedParams = { ...params, sectionProps: updatedSectionProps }
      updateParametersOnBuilding(updatedParams)
    },
    [params, updateParametersOnBuilding, activeSectionIds],
  )

  return { rotate, mirror, flipLeftRight }
}

////////////

//////
// Custom Layouts
///

export function useCustomLayouts(
  element: FormaElement,
  sectionSelection: any,
  editElementId: string,
): CustomLayoutData {
  const addCustomLayout = useAddCustomLayout(element, editElementId, sectionSelection.activeSectionIds)
  const deleteCustomLayout = useDeleteCustomLayout(element, editElementId)
  const deleteCustomLayoutProjectLevel = useDeleteCustomLayoutProjectLevel()
  const updateCustomLayout = useUpdateCustomLayout(element, editElementId)
  const updateCustomLayoutProjectLevel = useUpdateCustomLayoutProjectLevel()
  const selectCustomLayout = useApplyCustomLayoutToSelection(element, editElementId, sectionSelection.activeSectionIds)
  const selectCustomLayoutProjectLevel = useApplyCustomLayoutToSelectionProjectLevel(
    element,
    editElementId,
    sectionSelection.activeSectionIds,
  )
  const removeCustomLayout = useRemoveCustomLayoutFromSelection(
    element,
    editElementId,
    sectionSelection.activeSectionIds,
  )
  const projectLevelLayouts = useRecoilValue(projectLevelFloorPlansSelector)
  const updateProjectLevelLayouts = useUpdateProjectLevelFloorPlans()

  const updateCustomLayoutSettings = useUpdateCustomLayoutSettings(
    element,
    editElementId,
    sectionSelection.activeSectionIds,
  )

  const params: LineBuildingParameters = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const customLayouts = useMemo(() => {
    return params.customLayouts
  }, [params])

  const drawSettings = useMemo(() => {
    if (!params.sectionToggle) return []
    const width = params.width
    const drawSettings: { [key: string]: DrawSetting } = {}
    for (let sectionId of sectionSelection.activeSectionIds) {
      const section = params.sections[sectionId]
      const featureName = params.sectionProps[sectionId]?.feature?.name
      const customOrEmptySection = featureName === undefined || featureName === "CustomLayout"
      const drawSetting = getDrawSettingFromSection(section, width)
      if (!customOrEmptySection || drawSetting === undefined) continue
      const drawSettingId = getDrawSettingId(drawSetting)
      drawSettings[drawSettingId] = drawSetting
    }
    return Object.values(drawSettings)
  }, [sectionSelection, params])

  return {
    drawSettings,
    customLayouts,
    addCustomLayout,
    updateCustomLayout,
    deleteCustomLayout,
    selectCustomLayout,
    removeCustomLayout,
    updateCustomLayoutSettings,
    //
    updateCustomLayoutProjectLevel,
    deleteCustomLayoutProjectLevel,
    selectCustomLayoutProjectLevel,
    projectLevelLayouts,
    updateProjectLevelLayouts,
  }
}
