import { CirculationAddButton, CirculationContent } from "./Circulation"
import { AddCustomLayoutsButton, CustomLayoutsContent, CustomLayoutsPopupWrapper, showAddButton } from "./CustomLayouts"
import type { CustomLayoutData, LineBuildingValues } from "./LineBuildingMenus"
import { useMemo } from "preact/compat"
import { icons } from "./icons"
import { Unlink } from "src/lib/components/icons/Unlink"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { SectionSelection } from "./types"

const Padding_12 = () => {
  return <div style={"height: 12px;"} />
}

const RulerStyle = `
 width: 100%;
 height: 1px;
 background: var(--border-color-divider-light);
`
const Ruler = () => {
  return <div style={RulerStyle} />
}

const ContentHeaderStyle = `
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`
const ContentHeaderTextStyle = `
  font: var(--11-medium);
`

export function ContentHeader({
  headerText,
  releaseCallback,
  addCallback,
  swapCallback,
  removeCallback,
  releaseTooltip,
}: {
  headerText: string
  releaseCallback: undefined | (() => void)
  addCallback?: undefined | ((e: MouseEvent) => any)
  swapCallback?: undefined | ((e: MouseEvent) => any)
  removeCallback?: undefined | ((e: MouseEvent) => any)
  releaseTooltip?: JSX.Element
}) {
  return (
    <div style={ContentHeaderStyle}>
      <div style={ContentHeaderTextStyle}>{headerText}</div>
      <div>
        {releaseCallback && (
          <>
            <weave-icon-button id="release-to-floor-plan-header-icon-button" onClick={releaseCallback}>
              <Unlink />
            </weave-icon-button>
            {releaseTooltip}
          </>
        )}
        {swapCallback && <weave-icon-button onClick={swapCallback}>{icons.swap}</weave-icon-button>}
        {removeCallback && <weave-icon-button onClick={removeCallback}>{icons.cross}</weave-icon-button>}
        {addCallback && <weave-icon-button onClick={addCallback}>{icons.addFeature}</weave-icon-button>}
      </div>
    </div>
  )
}

export const ContentMenu = ({
  lineBuildingParameters,
  features,
  addFeature,
  removeFeature,
  updateFeatureSetting,
  values,
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
  sectionSelection: SectionSelection
  customLayoutData: CustomLayoutData
  bakeFeature: any
}) => {
  const customCornerFlag = true
  const showCustomLayouts = useMemo(
    () =>
      values.sectionToggle &&
      showAddButton(lineBuildingParameters, sectionSelection.activeSectionIds, customCornerFlag),
    [customCornerFlag, lineBuildingParameters, sectionSelection.activeSectionIds, values.sectionToggle],
  )

  const haveCustomLayoutsContent = useMemo(() => {
    return Object.values(lineBuildingParameters.sectionProps).some((sectionProp) => {
      return sectionProp.feature?.name === "CustomLayout"
    })
  }, [lineBuildingParameters.sectionProps])

  const haveCirculationContent = useMemo(() => {
    const sectionFeatures = sectionSelection.activeSectionIds.map(
      (id) => lineBuildingParameters.sectionProps?.[id]?.feature?.name,
    )
    const { feature, sectionToggle } = lineBuildingParameters
    if (!sectionToggle) return feature?.name === "Circulation"
    return sectionFeatures.some((n) => n === "Circulation")
  }, [lineBuildingParameters, sectionSelection])

  const haveContent = haveCirculationContent || haveCustomLayoutsContent

  const showAddCirculation = useMemo(() => {
    if (!values.sectionToggle) return !lineBuildingParameters.feature?.name
    const selectedSectionIds = sectionSelection.activeSectionIds
    const sectionFeatures = selectedSectionIds.map((id) => lineBuildingParameters.sectionProps?.[id]?.feature?.name)
    return sectionFeatures.some((n) => !n)
  }, [
    values.sectionToggle,
    lineBuildingParameters.feature?.name,
    lineBuildingParameters.sectionProps,
    sectionSelection.activeSectionIds,
  ])

  const activeSectionIdsWithoutOtherFeatures = useMemo(() => {
    return sectionSelection.activeSectionIds.filter((id) => {
      const featureName = lineBuildingParameters.sectionProps?.[id]?.feature?.name
      return featureName === undefined || featureName === "CustomLayout"
    })
  }, [lineBuildingParameters.sectionProps, sectionSelection.activeSectionIds])

  return (
    <>
      {haveCirculationContent && (
        <>
          <CirculationContent
            features={features}
            updateFeatureSetting={updateFeatureSetting}
            bakeFeature={bakeFeature}
            removeFeature={removeFeature}
            addFeature={addFeature}
            showAdd={showAddCirculation}
          />
          <Padding_12 />
        </>
      )}
      {haveCustomLayoutsContent && (
        <>
          {haveCirculationContent && <Ruler />}
          <CustomLayoutsContent
            lineBuildingParameters={lineBuildingParameters}
            sectionSelection={sectionSelection}
            customLayoutData={customLayoutData}
          />
          <Padding_12 />
        </>
      )}
      {!haveCirculationContent && showAddCirculation && (
        <>
          {haveContent && <Ruler />}
          <CirculationAddButton addFeature={addFeature} />
        </>
      )}
      {!haveCustomLayoutsContent && showCustomLayouts && (
        <>
          <Ruler />
          <AddCustomLayoutsButton />
        </>
      )}
      <Padding_12 />
      <CustomLayoutsPopupWrapper
        customLayoutData={customLayoutData}
        features={features}
        sections={lineBuildingParameters.sections}
        activeSectionIds={activeSectionIdsWithoutOtherFeatures}
        width={values.width}
      />
    </>
  )
}
