import { icons } from "./icons"
import { useMemo } from "preact/hooks"
import type { FormaElement } from "@spacemakerai/element-types"
import { useTranslator } from "src/i18n"
import { useState } from "preact/compat"
import releaseToBasicGif from "src/integrations/building-systems-line-buildings/assets/release-to-basic.gif"
import { ExpandedTooltip } from "src/lib/components/ExpandedTooltip"
import { feetToMeter } from "src/lib/measurementSystem"
import { METER_TO_FEET } from "@spacemakerai/forma-units"
import { Unlink } from "src/lib/components/icons/Unlink"
import {
  LineAligmentRight16,
  LineAlignmentCenter16,
  LineAlignmentLeft16,
} from "src/lib/components/icons/LineAlignment_16"
import { useReleaseLineBuildingToBasicBuilding } from "src/integrations/building-systems-common/buildingMigrations/migrateToNewBasicBuilding/releaseLineBuildingToBasicBuilding"
import { AnalyticsLegacy } from "src/core/analytics"
import InputWithIcon from "src/integrations/InputWithIcon/InputWithIcon"
import { exitCurrentTool } from "src/core/toolsState"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useIsImperial } from "src/lib/unitSettings"
import { EventName } from "@spacemakerai/webapp-analytics"
import { dispatchBuildingEvent } from "src/core/events/buildingEvents"

const HeaderBoxStyle = `
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const HeaderTitleStyle = `
  font: var(--12-bold);
`

const AutomationTextStyle = `
  margin-left: 4px;
  font-family: Artifakt Element, sans-serif;
  font-style: normal;
  font-weight: 700;
  font-size: 12px;
  line-height: 16px;
  color: rgba(60, 60, 60, 0.4);
`

function roundUpToClosestFootInMetric(metric: number): number {
  if (metric === 0) return 0
  return feetToMeter(Math.ceil(metric * METER_TO_FEET))
}

const ReleaseIconBasicBuilding = ({ element, elementPath }: { element: FormaElement; elementPath: string }) => {
  const t = useTranslator()
  const canEdit = canEditProposalSignal.value
  const releaseToBasicBuildings = useReleaseLineBuildingToBasicBuilding()

  return (
    <div>
      <weave-icon-button
        disabled={!canEdit}
        id="release-basic-building"
        onClick={() => {
          dispatchBuildingEvent("line_building", EventName.Update, undefined, {
            sub_feature: "release",
            update_type: "basic_building",
          })
          AnalyticsLegacy.track("Line Building - Release to new basicBuildings")
          exitCurrentTool()
          return releaseToBasicBuildings(element, elementPath)
        }}
      >
        <Unlink />
      </weave-icon-button>
      <ExpandedTooltip
        title={(t) => t(($) => $.building.tooltips.releaseToBasicButton)}
        bodyText={(t) => t(($) => $.building.lineBuilding.releaseToBasicExplanation)}
        target={"release-basic-building"}
        position="bottom"
        icon={
          <img
            src={releaseToBasicGif}
            alt={t(($) => $.building.lineBuilding.releaseToBasicAnimationAlt)}
            height="110"
            width="196"
            loading="lazy"
          />
        }
      />
    </div>
  )
}

export const ReleaseHeader = ({ element, elementPath }: { element: FormaElement; elementPath: string }) => {
  const t = useTranslator()
  return (
    <div style={HeaderBoxStyle}>
      <div style={"display: flex;"}>
        <div style={HeaderTitleStyle}>{t(($) => $.building.lineBuilding.headerTitle)}</div>
        <div style={AutomationTextStyle}> AUTOMATION</div>
      </div>
      <ReleaseIconBasicBuilding element={element} elementPath={elementPath} />
    </div>
  )
}

export const Header = () => {
  const t = useTranslator()
  return (
    <div style={HeaderBoxStyle}>
      <div style={"display: flex;"}>
        <div style={HeaderTitleStyle}>{t(($) => $.building.lineBuilding.headerTitle)}</div>
        <div style={AutomationTextStyle}> AUTOMATION</div>
      </div>
    </div>
  )
}

////
// Line alignment

const LineAlignmentBoxStyle = `
  height: 36px;
  width: 84px;
  display: flex;
  align-items: center;
  // justify-content: space-between;
`

const LineAlignmentIconBoxStyle = `
  width: 16px;
  height: 16px;
  cursor: pointer;
  padding-left: 12px;
`

const LineAlignmentIconBoxDisabledStyle = `
  width: 16px;
  height: 16px;
  margin-left: 16px;
`

const selectedColor = "#0696D7"
const baseColor = "#808080"
const hoverColor = "#000000"

const LineAlignment = ({
  lineAlignment,
  setLineAlignment,
  disableLeft,
  disableRight,
}: {
  lineAlignment: string
  setLineAlignment: (lineAlignment: string) => void
  disableLeft?: boolean
  disableRight?: boolean
}) => {
  const t = useTranslator()
  const canEdit = canEditProposalSignal.value
  disableLeft = !canEdit
  disableRight = !canEdit
  const [hover, setHover] = useState<string | undefined>(undefined)
  const colors = useMemo(() => {
    const center = lineAlignment === "center" ? selectedColor : hover === "center" ? hoverColor : baseColor
    const right = lineAlignment === "right" ? selectedColor : hover === "right" ? hoverColor : baseColor
    const left = lineAlignment === "left" ? selectedColor : hover === "left" ? hoverColor : baseColor
    return { center, right, left }
  }, [hover, lineAlignment])

  return (
    <div style={LineAlignmentBoxStyle}>
      <weave-tooltip text={t(($) => $.alignment.center)} nub="down-center">
        <div
          style={`
          ${LineAlignmentIconBoxStyle}
          color: ${colors.center};`}
          onClick={() => {
            canEdit && setLineAlignment("center")
          }}
          onMouseEnter={() => setHover("center")}
          onMouseLeave={() => setHover(undefined)}
        >
          <LineAlignmentCenter16 />
        </div>
      </weave-tooltip>
      <weave-tooltip text={t(($) => $.alignment.left)} nub="down-center">
        <div
          style={
            disableLeft
              ? LineAlignmentIconBoxDisabledStyle
              : `${LineAlignmentIconBoxStyle}
            color: ${colors.left};`
          }
          onClick={() => {
            disableLeft || (canEdit && setLineAlignment("left"))
          }}
          onMouseEnter={() => setHover("left")}
          onMouseLeave={() => setHover(undefined)}
        >
          <LineAlignmentLeft16 />
        </div>
      </weave-tooltip>
      <weave-tooltip text={t(($) => $.alignment.right)} nub="down-center">
        <div
          style={
            disableRight
              ? LineAlignmentIconBoxDisabledStyle
              : `${LineAlignmentIconBoxStyle}
            color: ${colors.right};`
          }
          onClick={() => {
            disableRight || (canEdit && setLineAlignment("right"))
          }}
          onMouseEnter={() => setHover("right")}
          onMouseLeave={() => setHover(undefined)}
        >
          <LineAligmentRight16 />
        </div>
      </weave-tooltip>
    </div>
  )
}

const ParametersRowStyle = `
 height: 36px;
 display: flex;
 align-items: center;
 justify-content: space-between;
`

const WidthParameter = ({ width, setWidth, widthDisabled }: any) => {
  const t = useTranslator()
  const canEdit = canEditProposalSignal.value
  const imperialFlag = useIsImperial()

  return (
    <div style={ParametersRowStyle}>
      <InputWithIcon
        id={t(($) => $.building.lineBuilding.apartmentBuildingWidth)}
        icon={icons.width}
        label={t(($) => $.building.properties.widthLabel)}
        unit={"length"}
        value={parseFloat(width)}
        onChange={(value) => {
          setWidth(value)
        }}
        disabled={!canEdit || widthDisabled}
        metricStep={0.1}
        feetStep={0.5}
        metricMin={imperialFlag ? feetToMeter(25) : 8}
        metricMax={imperialFlag ? feetToMeter(150) : 50}
      />
    </div>
  )
}

export const WidthAndLineAlignment = ({
  lineAlignment,
  setLineAlignment,
  disableLeft,
  disableRight,
  width,
  setWidth,
  widthDisabled,
}: {
  lineAlignment: string
  setLineAlignment: (lineAlignment: string) => void
  disableLeft?: boolean
  disableRight?: boolean
  width: number
  setWidth: (w: number) => any
  widthDisabled: boolean
}) => {
  return (
    <div style={ParametersRowStyle}>
      <WidthParameter width={width} setWidth={setWidth} widthDisabled={widthDisabled} />
      <LineAlignment
        lineAlignment={lineAlignment}
        setLineAlignment={setLineAlignment}
        disableLeft={disableLeft}
        disableRight={disableRight}
      />
    </div>
  )
}

export const StoryHeightAndNumberOfFloors = ({
  storyHeight,
  setStoryHeight,
  storyHeightDisabled,
  numberOfFloors,
  setNumberOfFloors,
}: any) => {
  const t = useTranslator()
  const canEdit = canEditProposalSignal.value
  const imperialFlag = useIsImperial()
  return (
    <div style={ParametersRowStyle}>
      <InputWithIcon
        id={t(($) => $.building.lineBuilding.apartmentBuildingStories)}
        icon={icons.stories}
        label={t(($) => $.building.properties.numberOfFloorsLabel)}
        unit={"count"}
        min={1}
        max={100}
        value={numberOfFloors !== undefined ? parseFloat(numberOfFloors) : undefined}
        onChange={(value) => {
          setNumberOfFloors(value)
        }}
        disabled={!canEdit}
      />
      <InputWithIcon
        id={t(($) => $.building.lineBuilding.apartmentBuildingStoryHeight)}
        icon={icons.story_height}
        label={t(($) => $.building.properties.storyHeightLabel)}
        unit={"length"}
        value={parseFloat(storyHeight)}
        onChange={(value) => {
          setStoryHeight(value)
        }}
        disabled={!canEdit || storyHeightDisabled}
        metricMin={imperialFlag ? roundUpToClosestFootInMetric(1) : 1}
        metricMax={imperialFlag ? roundUpToClosestFootInMetric(20) : 20}
        metricStep={0.1}
        feetStep={0.5}
      />
    </div>
  )
}
