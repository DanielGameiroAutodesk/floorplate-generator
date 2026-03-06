import { Header, StoryHeightAndNumberOfFloors, WidthAndLineAlignment } from "./Header"
import { Sections } from "./Sections"
import type { CustomLayoutData, LineBuildingValues } from "./LineBuildingMenus"
import { LineBuildingParameterBoxStyle } from "./LineBuildingMenus"
import { ContentMenu } from "./ContentMenu"
import { CirculationAddButton, CirculationContent } from "./Circulation"
import { AddCustomLayoutsButton } from "./CustomLayouts"
import { FunctionDropdown } from "src/integrations/AnalysisProperties/FunctionDropdown"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { SectionSelection } from "./types"
import { useTranslator } from "src/i18n"

const Padding_12 = () => {
  return <div style={"height: 12px;"} />
}

const Padding_8 = () => {
  return <div style={"height: 8px;"} />
}

const RulerStyle = `
 width: 100%;
 height: 1px;
 background: var(--border-color-divider-light);
`
const Ruler = () => {
  return <div style={RulerStyle} />
}

export function StyledMenu({
  lineBuildingParameters,
  features,
  addFeature,
  removeFeature,
  updateFeatureSetting,
  values,
  setters,
  disabled,
  sectionSelection,
  customLayoutData,
  bakeFeature,
}: {
  lineBuildingParameters: LineBuildingParameters
  features: any
  addFeature: any
  removeFeature: any
  updateFeatureSetting: any
  values: LineBuildingValues
  setters: any
  disabled: Record<string, boolean>
  sectionSelection: SectionSelection
  customLayoutData: CustomLayoutData
  bakeFeature: any
}) {
  return (
    <>
      <WidthAndLineAlignment
        width={values.width}
        setWidth={setters.setWidth}
        widthDisabled={disabled.width}
        lineAlignment={values.lineAlignment}
        setLineAlignment={setters.setLineAlignment}
        disableLeft={disabled.lineAlignmentLeft}
        disableRight={disabled.lineAlignmentRight}
      />
      <StoryHeightAndNumberOfFloors
        storyHeight={values.storyHeight}
        setStoryHeight={setters.setStoryHeight}
        storyHeightDisabled={disabled.storyHeight}
        numberOfFloors={values.numberOfFloors}
        setNumberOfFloors={setters.setNumberOfFloors}
      />
      <Sections
        sectionToggle={values.sectionToggle}
        setSectionToggle={setters.setSectionToggle}
        sectionLength={values.sectionLength}
        setSectionLength={setters.setSectionLength}
        currentSectionLengths={values.currentSectionLengths}
      />
      <Padding_8 />
      <Ruler />
      <FunctionDropdown />
      <Ruler />
      <ContentMenu
        lineBuildingParameters={lineBuildingParameters}
        features={features}
        addFeature={addFeature}
        removeFeature={removeFeature}
        updateFeatureSetting={updateFeatureSetting}
        values={values}
        sectionSelection={sectionSelection}
        customLayoutData={customLayoutData}
        bakeFeature={bakeFeature}
      />
    </>
  )
}

////////
// Tool menu
////

export function ToolMenu({
  values,
  setters,
  features,
  addFeature,
  updateFeatureSetting,
  removeFeature,
}: {
  values: LineBuildingValues
  setters: any
  features: any
  addFeature: any
  updateFeatureSetting: any
  removeFeature: any
}) {
  const t = useTranslator()
  const haveCirculationContent = !!features?.Presets?.Circulation
  let showAddCirculation = !haveCirculationContent
  return (
    <div style={LineBuildingParameterBoxStyle}>
      <Header />
      <WidthAndLineAlignment
        width={values.width}
        setWidth={setters.setWidth}
        lineAlignment={values.lineAlignment}
        setLineAlignment={setters.setLineAlignment}
        widthDisabled={false}
        disableLeft={false}
        disableRight={false}
      />
      <StoryHeightAndNumberOfFloors
        storyHeight={values.storyHeight}
        numberOfFloors={values.numberOfFloors}
        setStoryHeight={setters.setStoryHeight}
        setNumberOfFloors={setters.setNumberOfFloors}
      />
      <Sections
        sectionToggle={values.sectionToggle}
        setSectionToggle={setters.setSectionToggle}
        sectionLength={values.sectionLength}
        setSectionLength={setters.setSectionLength}
        currentSectionLengths={[values.sectionLength]}
      />
      <Padding_8 />
      <Ruler />
      {haveCirculationContent && (
        <>
          <CirculationContent
            features={features}
            updateFeatureSetting={updateFeatureSetting}
            bakeFeature={undefined}
            removeFeature={removeFeature}
            addFeature={addFeature}
            showAdd={showAddCirculation}
          />
          <Padding_12 />
        </>
      )}
      {!haveCirculationContent && showAddCirculation && <CirculationAddButton addFeature={addFeature} />}
      {!haveCirculationContent && values.sectionToggle && (
        <>
          <Ruler />
          <AddCustomLayoutsButton disabled={true} tooltipText={t(($) => $.building.floorPlans.finishDrawingTooltip)} />
        </>
      )}
      <Padding_12 />
    </div>
  )
}
