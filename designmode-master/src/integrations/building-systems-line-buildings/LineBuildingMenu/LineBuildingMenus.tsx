import { useRecoilValue } from "recoil"
import { useUpdateParametersOnLineBuildingElement } from "src/integrations/building-systems-line-buildings/quick-draw-selection-hooks"
import { useCallback, useMemo } from "preact/hooks"
import {
  quickDrawTemporaryDumpAtom,
  useLineBuildingToolParams,
  useSetLineBuildingToolParams,
} from "src/integrations/building-systems-line-buildings/quickDrawState"
import { StyledMenu, ToolMenu } from "./StyledMenu"
import { updateGraphOnWidthChange } from "./updateGraphOnWidthChange"
import type { FormaElement } from "@spacemakerai/element-types"
import { getValidLineAlignments } from "src/integrations/building-systems-line-buildings/helpers/lineAlignment"
import { ReleaseHeader } from "./Header"
import { isDefined } from "src/lib/array"
import { useCustomLayouts } from "src/integrations/building-systems-line-buildings/customLayoutsHooks"
import { getUpdatedSectionPropsOnToggleOff } from "./sectionToggling"
import { AnalysisParameters } from "src/integrations/building-systems-analysis-building/parameters"
import type { CustomLayout } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import { type LineBuilding, lineBuildingGenerator } from "@spacemakerai/line-buildings-shared/lineBuilding"
import { selectedPathsInCurrentProposalAsArraySignal } from "src/core/selection/selectionState"
import { getBakedLineBuildingParameters } from "./baking"
import type { DrawSetting, SectionSelection } from "./types"

/////
// Set prop values
///

function updateParamsOnSectionsSelection(params: any, sectionSelection: any, valueName: any, updatedValue: any) {
  let updatedSectionProps = { ...params.sectionProps }
  sectionSelection.activeSectionIds.forEach((sectionID: string) => {
    const localSectionProps = updatedSectionProps[sectionID]
    updatedSectionProps[sectionID] = { ...localSectionProps, [valueName]: updatedValue }
  })
  if (sectionSelection.fullSelection) {
    return { ...params, [valueName]: updatedValue, sectionProps: updatedSectionProps }
  }
  return { ...params, sectionProps: updatedSectionProps }
}

function useEditElementId() {
  const selectedPaths = selectedPathsInCurrentProposalAsArraySignal.value
  return selectedPaths[0]
}

function useSetters(element: FormaElement, sectionSelection: SectionSelection) {
  const dbClickedElementId = useEditElementId()
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(dbClickedElementId)

  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const setWidth = useCallback(
    (updatedValue: number) => {
      const updatedGraph = updateGraphOnWidthChange(params.graph, params.width, updatedValue, params.lineAlignment)
      updateParametersOnBuilding({ ...params, width: updatedValue, graph: updatedGraph })
    },
    [params, updateParametersOnBuilding],
  )

  const setSectionLength = useCallback(
    (updatedValue: number) => {
      const updatedParams = updateParamsOnSectionsSelection(
        params,
        sectionSelection,
        "minSubBuildingLength",
        updatedValue,
      )
      updateParametersOnBuilding(updatedParams)
    },
    [params, sectionSelection, updateParametersOnBuilding],
  )

  const setNumberOfFloors = useCallback(
    (updatedValue: number) => {
      let updatedParams
      if (sectionSelection.unSectioned) {
        updatedParams = { ...params, numberOfFloors: updatedValue }
      } else {
        updatedParams = updateParamsOnSectionsSelection(params, sectionSelection, "numberOfFloors", updatedValue)
      }
      updateParametersOnBuilding(updatedParams)
    },
    [params, sectionSelection, updateParametersOnBuilding],
  )

  const setStoryHeight = useCallback(
    (updatedValue: number) => {
      updateParametersOnBuilding({ ...params, floorHeight: updatedValue })
    },
    [params, updateParametersOnBuilding],
  )

  const setLineAlignment = useCallback(
    (updatedValue: string) => {
      updateParametersOnBuilding({ ...params, lineAlignment: updatedValue })
    },
    [params, updateParametersOnBuilding],
  )

  const setSectionToggle = useCallback(
    (updatedSectionToggle: boolean) => {
      if (updatedSectionToggle) {
        const feature = params.feature
        const numberOfFloors = params.numberOfFloors
        const sectionProps = params.sectionProps
        let updatedSectionProps = { ...sectionProps }
        for (let sectionId of Object.keys(sectionProps)) {
          const sectionProp = sectionProps[sectionId]
          updatedSectionProps[sectionId] = { ...sectionProp, feature, numberOfFloors }
        }
        updateParametersOnBuilding({
          ...params,
          sectionToggle: true,
          sectionProps: updatedSectionProps,
        })
      } else {
        const { feature, numberOfFloors } = getUpdatedSectionPropsOnToggleOff(params.sectionProps)

        updateParametersOnBuilding({
          ...params,
          sectionToggle: false,
          numberOfFloors: numberOfFloors,
          feature: feature,
        })
      }
    },
    [params, updateParametersOnBuilding],
  )

  return { setWidth, setSectionLength, setNumberOfFloors, setStoryHeight, setLineAlignment, setSectionToggle }
}

////
// Get prop values
///

function getSectionValue(params: any, sectionSelection: any, valueName: string) {
  const defaultValue = params[valueName]
  const values = sectionSelection.activeSectionIds.map((sectionID: string) => {
    const localValue = params?.sectionProps?.[sectionID]?.[valueName]
    return localValue !== undefined ? localValue : defaultValue
  })
  const firstValue = values[0]
  if (values.every((value: any) => value === firstValue)) return firstValue
  return undefined
}

export type LineBuildingValues = {
  sectionLength: number
  numberOfFloors: number
  sectionToggle: boolean
  width: number
  storyHeight: number
  lineAlignment: "center" | string
  currentSectionLengths: number[]
}

function useValues(
  params: LineBuildingParameters,
  sectionSelection: SectionSelection,
  lineBuilding: LineBuilding,
): LineBuildingValues {
  return useMemo(() => {
    const width = params.width
    const storyHeight = params.floorHeight
    const numberOfFloors = params.sectionToggle
      ? getSectionValue(params, sectionSelection, "numberOfFloors")
      : params.numberOfFloors
    const sectionLength = getSectionValue(params, sectionSelection, "minSubBuildingLength")
    const lineAlignment = params.lineAlignment
    const sectionToggle = params.sectionToggle

    const currentSectionLengths = sectionSelection.activeSectionIds
      .map((sectionId) => {
        const section = lineBuilding.sections[sectionId]
        if (section?.sectionType !== "Corner") {
          return section?.length
        }
      })
      .filter(isDefined)

    return { width, sectionLength, storyHeight, numberOfFloors, lineAlignment, sectionToggle, currentSectionLengths }
  }, [lineBuilding, params, sectionSelection])
}

export type CustomLayoutData = {
  addCustomLayout: (newCustomLayout: CustomLayout) => void
  updateCustomLayout: (updatedCustomLayout: CustomLayout, keepRevision?: boolean, oldId?: string) => void
  updateCustomLayoutProjectLevel: (updatedCustomLayout: CustomLayout, keepRevision?: boolean, oldId?: string) => void
  removeCustomLayout: (customLayoutID?: string) => void
  deleteCustomLayout: (customLayoutID: string) => void
  deleteCustomLayoutProjectLevel: (customLayoutID: string) => void
  selectCustomLayout: (customLayoutID: string) => void
  selectCustomLayoutProjectLevel: (customLayoutID: string) => void
  updateCustomLayoutSettings: {
    rotate: (layoutIds: string[]) => void
    mirror: (layoutIds: string[]) => void
    flipLeftRight: (layoutIds: string[]) => void
  }
  customLayouts: CustomLayout[]
  projectLevelLayouts: CustomLayout[]
  updateProjectLevelLayouts: (t: CustomLayout[]) => any
  drawSettings: DrawSetting[]
}

/////
// Features
////

function useFeatures(element: FormaElement, sectionSelection: SectionSelection) {
  const dbClickedElementId = useEditElementId()
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(dbClickedElementId)

  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const features = useMemo(() => {
    const features: any = { Custom: {}, Presets: {} }
    if (!params.sectionToggle) {
      const feature = params.feature
      const featureName = feature?.name
      if (featureName) {
        features.Presets[featureName] = { ...feature, count: 1 }
      }
      return features
    }
    const sectionProps = params.sectionProps || {}
    for (let sectionID of sectionSelection.activeSectionIds) {
      const feature = sectionProps?.[sectionID]?.feature
      const featureName = feature?.name
      if (!featureName) continue
      if (featureName === "CustomLayout") {
        const customID = feature.customLayoutID
        if (!features["Custom"][customID]) features["Custom"][customID] = { ...feature, count: 0 }
        features["Custom"][customID].count = features["Custom"][customID].count + 1
      } else {
        if (!features.Presets[featureName]) features.Presets[featureName] = { ...feature, count: 0 }
        features.Presets[featureName].count = features.Presets[featureName].count + 1
      }
    }
    return features
  }, [params, sectionSelection])

  const addFeature = useCallback(
    (feature: any, onlyAddToEmptySections: boolean = false) => {
      if (!params.sectionToggle) {
        const updatedParams = { ...params, feature }
        updateParametersOnBuilding(updatedParams)
        return
      }
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      sectionSelection.activeSectionIds.forEach((sectionID: string) => {
        const props = updatedSectionProps[sectionID]
        if (!onlyAddToEmptySections || !props.feature?.name)
          updatedSectionProps[sectionID] = { ...props, feature: feature }
      })
      let updatedFeatures = { ...params.features }
      if (!updatedFeatures[feature.name]) updatedFeatures[feature.name] = feature
      let updatedParams = { ...params, sectionProps: updatedSectionProps, features: updatedFeatures }
      if (sectionSelection.fullSelection) {
        updatedParams = { ...updatedParams, feature }
      }
      updateParametersOnBuilding(updatedParams)
    },
    [params, sectionSelection, updateParametersOnBuilding],
  )

  const removeFeature = useCallback(
    (featureName: string) => {
      if (!params.sectionToggle) {
        const updatedParams = { ...params, feature: undefined }
        updateParametersOnBuilding(updatedParams)
        return
      }
      let updatedSectionProps = { ...(params.sectionProps || {}) }
      sectionSelection.activeSectionIds.forEach((sectionID: string) => {
        const props = updatedSectionProps[sectionID]
        if (featureName === props?.feature?.name) {
          updatedSectionProps[sectionID] = { ...props, feature: undefined }
        }
      })
      let updatedParams = { ...params, sectionProps: updatedSectionProps }
      if (sectionSelection.fullSelection) {
        updatedParams = { ...updatedParams, feature: undefined }
      }
      updateParametersOnBuilding(updatedParams)
    },
    [params, sectionSelection, updateParametersOnBuilding],
  )

  const updateFeatureSetting = useCallback(
    (featureName: string, property: string, value: any) => {
      if (!params.sectionToggle) {
        const feature = params.feature || {}
        if (featureName !== feature.name) return
        const updatedSetting = { ...feature.settings[property], value }
        const updatedSettings = { ...feature.settings, [property]: updatedSetting }
        const updatedFeature = { ...feature, settings: updatedSettings }
        const updatedParams = { ...params, feature: updatedFeature }
        updateParametersOnBuilding(updatedParams)
        return
      }

      let updatedSectionProps = { ...(params.sectionProps || {}) }
      sectionSelection.activeSectionIds.forEach((sectionID: string) => {
        const props = updatedSectionProps[sectionID]
        if (featureName === props?.feature?.name) {
          const updatedSetting = { ...props.feature.settings[property], value }
          const updatedSettings = { ...props.feature.settings, [property]: updatedSetting }
          const updatedFeature = { ...props.feature, settings: updatedSettings }
          updatedSectionProps[sectionID] = { ...props, feature: updatedFeature }
        }
      })
      const updatedParams = { ...params, sectionProps: updatedSectionProps }
      updateParametersOnBuilding(updatedParams)
    },
    [params, updateParametersOnBuilding, sectionSelection],
  )
  return { features, addFeature, removeFeature, updateFeatureSetting }
}

function useFeaturesTool() {
  const params = useLineBuildingToolParams()
  const updateParametersOnBuilding = useSetLineBuildingToolParams()

  const features = useMemo(() => {
    const features: any = { Custom: {}, Presets: {} }
    const feature = params.feature
    const featureName = feature?.name
    if (featureName) {
      features.Presets[featureName] = { ...feature, count: 1 }
    }
    return features
  }, [params])

  const addFeature = useCallback(
    (feature: any) => {
      const updatedParams = { ...params, feature }
      updateParametersOnBuilding(updatedParams)
      return
    },
    [params, updateParametersOnBuilding],
  )

  const removeFeature = useCallback(() => {
    const updatedParams = { ...params, feature: undefined }
    updateParametersOnBuilding(updatedParams)
    return
  }, [params, updateParametersOnBuilding])

  const updateFeatureSetting = useCallback(
    (featureName: string, property: string, value: any) => {
      const feature = params.feature || {}
      if (featureName !== feature.name) return
      const updatedParams = {
        ...params,
        feature: {
          ...feature,
          settings: {
            ...feature.settings,
            [property]: { ...feature.settings[property], value },
          },
        },
      }
      updateParametersOnBuilding(updatedParams)
      return
    },
    [params, updateParametersOnBuilding],
  )
  return { features, addFeature, removeFeature, updateFeatureSetting }
}

/////
// Section selection
////

function useSectionSelection(element: FormaElement): SectionSelection {
  const temporaryDumpState = useRecoilValue(quickDrawTemporaryDumpAtom)
  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const allSectionIds: string[] = useMemo(() => {
    return Object.keys(params.sections)
  }, [params])

  const selectedSectionIds = useMemo(() => {
    return temporaryDumpState?.selectedSectionIds
  }, [temporaryDumpState])

  const fullSelection =
    !selectedSectionIds || selectedSectionIds.length === 0 || selectedSectionIds.length === allSectionIds.length
  const activeSectionIds = useMemo(() => {
    if (fullSelection) return allSectionIds
    return selectedSectionIds
  }, [selectedSectionIds, fullSelection, allSectionIds])

  return { selectedSectionIds, fullSelection, allSectionIds, activeSectionIds, unSectioned: !params.sectionToggle }
}

function useDisabled(element: FormaElement, sectionSelection: SectionSelection) {
  const params = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const disableWidth = useMemo(() => {
    return !sectionSelection.fullSelection && !sectionSelection.unSectioned
  }, [sectionSelection.fullSelection, sectionSelection.unSectioned])

  const disableStoryHeight = useMemo(() => {
    return !sectionSelection.fullSelection && !sectionSelection.unSectioned
  }, [sectionSelection.fullSelection, sectionSelection.unSectioned])

  const disabledLineAlignments = useMemo(() => {
    const validLineAlignments = getValidLineAlignments(params.graph, params.width)
    return { lineAlignmentLeft: !validLineAlignments.left, lineAlignmentRight: !validLineAlignments.right }
  }, [params.graph, params.width])

  return { width: disableWidth, storyHeight: disableStoryHeight, ...disabledLineAlignments }
}

function useBakeFeature(path: string, element: FormaElement, sectionSelection: SectionSelection) {
  // const customCornerFlag = useFeatureFlag(URLFlag.LineBuilding)
  const customCornerFlag = true
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(path)

  const params: LineBuildingParameters = useMemo(() => {
    return element?.properties?.generator?.parameters
  }, [element])

  const bakeFeatures = useCallback(() => {
    const updatedParams = getBakedLineBuildingParameters(params, sectionSelection)
    if (updatedParams) {
      updateParametersOnBuilding(updatedParams)
    }
  }, [params, sectionSelection, updateParametersOnBuilding])
  const canBake =
    params.sectionToggle &&
    sectionSelection.activeSectionIds.some((id) => {
      const section = params?.sections[id]
      const feature = params?.sectionProps[id]?.feature
      if (customCornerFlag) {
        return ["Rectangle", "Corner"].includes(section?.sectionType) && feature?.name === "Circulation"
      }
      return section?.sectionType === "Rectangle" && feature?.name === "Circulation"
    })

  return { bake: bakeFeatures, canBake }
}

export const LineBuildingParameterBoxStyle = `
  border: 1px solid var(--border-color-divider-light);
  border-radius: 4px;
  margin-top: 16px;
  padding-left: 12px;
  padding-right: 12px;
`

export function SelectedLineBuildingMenu({ element, elementPath }: { element: FormaElement; elementPath: string }) {
  const sectionSelection = useSectionSelection(element)
  const bakeFeature = useBakeFeature(elementPath, element, sectionSelection)
  const parameters = element?.properties?.generator?.parameters as LineBuildingParameters
  const lineBuilding = lineBuildingGenerator.generate(parameters.graph, parameters, [])
  const values = useValues(parameters, sectionSelection, lineBuilding)
  const disabled = useDisabled(element, sectionSelection)
  const setters = useSetters(element, sectionSelection)
  const { features, addFeature, removeFeature, updateFeatureSetting } = useFeatures(element, sectionSelection)
  const editElementId = useEditElementId()
  const customLayoutData: CustomLayoutData = useCustomLayouts(element, sectionSelection, editElementId)
  const analysisBuilding = new URLSearchParams(window.location.search).has("analysisBuilding")
  const updateParametersOnBuilding = useUpdateParametersOnLineBuildingElement(editElementId)
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={(e) => {
        e.stopPropagation()
      }}
      onMouseUp={(e) => {
        e.stopPropagation()
      }}
      style={LineBuildingParameterBoxStyle}
    >
      <ReleaseHeader element={element} elementPath={elementPath} />
      <StyledMenu
        features={features}
        addFeature={addFeature}
        removeFeature={removeFeature}
        updateFeatureSetting={updateFeatureSetting}
        values={values}
        setters={setters}
        disabled={disabled}
        sectionSelection={sectionSelection}
        customLayoutData={customLayoutData}
        lineBuildingParameters={parameters}
        bakeFeature={bakeFeature}
      />
      {analysisBuilding && (
        <AnalysisParameters lineBuildingParameters={parameters} updateParameters={updateParametersOnBuilding} />
      )}
    </div>
  )
}

///////
// ApartmentBuilding tool menu
///

function useToolsSetters() {
  const setLineBuildingToolParams = useSetLineBuildingToolParams()
  const updateValue = useCallback(
    (name: string, value: any) => {
      setLineBuildingToolParams({ [name]: value })
    },
    [setLineBuildingToolParams],
  )
  const setWidth = useCallback(
    (value: number) => {
      updateValue("width", value)
    },
    [updateValue],
  )

  const setSectionLength = useCallback(
    (value: number) => {
      updateValue("minSubBuildingLength", value)
    },
    [updateValue],
  )

  const setStoryHeight = useCallback(
    (value: number) => {
      updateValue("floorHeight", value)
    },
    [updateValue],
  )

  const setNumberOfFloors = useCallback(
    (value: number) => {
      updateValue("numberOfFloors", value)
    },
    [updateValue],
  )

  const setLineAlignment = useCallback(
    (value: string) => {
      updateValue("lineAlignment", value)
    },
    [updateValue],
  )

  const setSectionToggle = useCallback(
    (value: string) => {
      updateValue("sectionToggle", value)
    },
    [updateValue],
  )
  return { setWidth, setSectionLength, setStoryHeight, setNumberOfFloors, setLineAlignment, setSectionToggle }
}

function useToolsValues() {
  const lineBuildingToolParams = useLineBuildingToolParams()
  return useMemo(() => {
    const params = lineBuildingToolParams
    const width = params.width
    const sectionLength = params.minSubBuildingLength
    const numberOfFloors = params.numberOfFloors
    const storyHeight = params.floorHeight
    const lineAlignment = params.lineAlignment
    const sectionToggle = params.sectionToggle
    const currentSectionLengths: number[] = []

    return { width, sectionLength, numberOfFloors, storyHeight, lineAlignment, sectionToggle, currentSectionLengths }
  }, [lineBuildingToolParams])
}

export function DrawLineBuildingMenu() {
  const values = useToolsValues()
  const setters = useToolsSetters()
  const { features, addFeature, updateFeatureSetting, removeFeature } = useFeaturesTool()

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
      }}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={(e) => {
        e.stopPropagation()
      }}
    >
      <ToolMenu
        values={values}
        setters={setters}
        features={features}
        addFeature={addFeature}
        updateFeatureSetting={updateFeatureSetting}
        removeFeature={removeFeature}
      />
    </div>
  )
}
