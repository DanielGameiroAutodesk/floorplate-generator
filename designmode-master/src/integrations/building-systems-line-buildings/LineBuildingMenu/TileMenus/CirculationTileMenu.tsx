import { useCallback, useMemo } from "preact/hooks"
import { useTranslator } from "src/i18n"
import { getCorridorType } from "src/integrations/building-systems-line-buildings/LineBuildingMenu/CirculationTile"
import { feetToMeter, toFeetIfImperial, toMetersIfImperial } from "src/lib/measurementSystem"
import { useState } from "preact/compat"
import {
  LineAligmentRight16,
  LineAlignmentCenter16,
  LineAlignmentLeft16,
} from "src/lib/components/icons/LineAlignment_16"
import InputWithIcon from "src/integrations/InputWithIcon/InputWithIcon"
import { useIsImperial } from "src/lib/unitSettings"

/////
// Generic styles
///

const GenericBoxStyle = `
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const GenericBoxWithSliderStyle = `
  display: flex;
  flex-direction: column;
`

const GenericTitleStyle = `
  font: var(--11-regular);
`

////
// Corridor alignment

const CorridorAlignmentIconsBoxStyle = `
  display: flex;
`

const AlignmentIconBoxStyle = `
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin-left: 12px;
`

const selectedColor = "#0696D7"
const baseColor = "#808080"
const hoverColor = "#000000"

const CorridorAlignment = ({ corridorAlignment, setCorridorAlignment }: any) => {
  const t = useTranslator()
  const [hover, setHover] = useState<string | undefined>(undefined)
  const colors = useMemo(() => {
    const center = corridorAlignment === "center" ? selectedColor : hover === "center" ? hoverColor : baseColor
    const right = corridorAlignment === "right" ? selectedColor : hover === "right" ? hoverColor : baseColor
    const left = corridorAlignment === "left" ? selectedColor : hover === "left" ? hoverColor : baseColor
    return { center, right, left }
  }, [hover, corridorAlignment])

  return (
    <div style={GenericBoxStyle}>
      <div style={GenericTitleStyle}>{"Corridor alignment"}</div>
      <div style={CorridorAlignmentIconsBoxStyle}>
        <weave-tooltip text={t(($) => $.alignment.center)} nub="down-center">
          <div
            style={`
            ${AlignmentIconBoxStyle}
            color: ${colors.center};`}
            onClick={() => {
              setCorridorAlignment("center")
            }}
            onMouseEnter={() => setHover("center")}
            onMouseLeave={() => setHover(undefined)}
          >
            <LineAlignmentCenter16 />
          </div>
        </weave-tooltip>
        <weave-tooltip text={t(($) => $.alignment.left)} nub="down-center">
          <div
            style={`
            ${AlignmentIconBoxStyle}
            color: ${colors.left};`}
            onClick={() => {
              setCorridorAlignment("left")
            }}
            onMouseEnter={() => setHover("left")}
            onMouseLeave={() => setHover(undefined)}
          >
            <LineAlignmentLeft16 />
          </div>
        </weave-tooltip>
        <weave-tooltip text={t(($) => $.alignment.right)} nub="down-center">
          <div
            style={`
            ${AlignmentIconBoxStyle}
            color: ${colors.right};`}
            onClick={() => {
              setCorridorAlignment("right")
            }}
            onMouseEnter={() => setHover("right")}
            onMouseLeave={() => setHover(undefined)}
          >
            <LineAligmentRight16 />
          </div>
        </weave-tooltip>
      </div>
    </div>
  )
}

/////
// Width
///

const Width = ({ corridorWidth, setCorridorWidth }: any) => {
  const imperialFlag = useIsImperial()
  const t = useTranslator()
  return (
    <div style={GenericBoxWithSliderStyle}>
      <div style={GenericBoxStyle}>
        <div style={GenericTitleStyle}>{t(($) => $.building.lineBuilding.circulation.widthLabel)}</div>
        <div style={"width: 100px;"}>
          <InputWithIcon
            id={t(($) => $.building.lineBuilding.circulation.widthLabel)}
            icon={" "}
            label={t(($) => $.building.lineBuilding.circulation.widthLabel)}
            unit={"length"}
            value={parseFloat(corridorWidth)}
            onChange={(value) => {
              setCorridorWidth(value)
            }}
            metricStep={0.1}
            feetStep={0.5}
            metricMin={imperialFlag ? feetToMeter(1) : 0.5}
            metricMax={imperialFlag ? feetToMeter(20) : 6}
          />
        </div>
      </div>
      <weave-slider
        step={(imperialFlag ? 0.5 : 0.1).toFixed(2)}
        min={(imperialFlag ? 1 : 0.5).toFixed(2)}
        max={(imperialFlag ? 20 : 6).toFixed(2)}
        value={toFeetIfImperial(parseFloat(corridorWidth), imperialFlag).toFixed(2)}
        onChange={(e) => {
          setCorridorWidth(toMetersIfImperial(parseFloat(e.detail), imperialFlag))
        }}
      />
    </div>
  )
}

///
//

const RulerStyle = `
  height: 1px;
  width: 100%;
  background: var(--border-color-divider-light);
`

const HeaderStyle = `
  height: 40px;
  display: flex;
  align-items: center;

  font: var(--12-medium);
`

const FeatureTilePopUpBoxStyle = (top: number) => `
  position: fixed;
  z-index: 100000;
  right: 290px;
  top: ${top}px;
  width: 250px;
  box-sizing: border-box;

  background: var(--background-color-surface-100);
  box-shadow: 0px 0px 16px rgba(0, 0, 0, 0.2);
  border-radius: 4px;

  cursor: default;
`
const StyledMenu = ({ values, setters, close, top }: any) => {
  return (
    <div
      style={`position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100001;`}
      onClick={(e) => {
        close()
        e.stopPropagation()
      }}
    >
      <div
        style={FeatureTilePopUpBoxStyle(top)}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div style={"padding-left: 16px"}>
          <div style={HeaderStyle}>{getCorridorType(values.corridorAlignment)}</div>
        </div>
        <div style={RulerStyle} />
        <div style={"padding: 10px 10px 10px 16px; "}>
          <CorridorAlignment
            corridorAlignment={values.corridorAlignment}
            setCorridorAlignment={setters.setCorridorAlignment}
          />
          <Width corridorWidth={values.corridorWidth} setCorridorWidth={setters.setCorridorWidth} />
        </div>
      </div>
    </div>
  )
}

////
//
//

function useSetters(feature: any, updateFeatureSetting: any) {
  const setCorridorWidth = useCallback(
    (value: number) => {
      updateFeatureSetting(feature.name, "corridorWidth", value)
    },
    [feature, updateFeatureSetting],
  )
  const setCorridorAlignment = useCallback(
    (value: string) => {
      updateFeatureSetting(feature.name, "corridorAlignment", value)
    },
    [feature, updateFeatureSetting],
  )
  return { setCorridorWidth, setCorridorAlignment }
}

function useValues(feature: any) {
  return useMemo(() => {
    const corridorWidth = feature.settings["corridorWidth"].value
    const corridorAlignment = feature.settings["corridorAlignment"].value
    return { corridorWidth, corridorAlignment }
  }, [feature])
}

export function CirculationTileMenu({ top, feature, updateFeatureSetting, close }: any) {
  const values = useValues(feature)
  const setters = useSetters(feature, updateFeatureSetting)
  return <StyledMenu values={values} setters={setters} close={close} top={top} />
}
