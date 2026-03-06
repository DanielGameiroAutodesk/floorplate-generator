import { icons } from "./icons"
import { feetToMeter, toFeetIfImperial } from "src/lib/measurementSystem"

import { METER_TO_FEET } from "@spacemakerai/forma-units"
import InputWithIcon from "src/integrations/InputWithIcon/InputWithIcon"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useIsImperial } from "src/lib/unitSettings"
import { useTranslator } from "src/i18n"

const ParameterStyle = `
 height: 36px;
 display: flex;
 align-items: center;
 justify-content: space-between;
`

const SectionsHeaderBoxStyle = `
  height: 36px;
  display: flex;
  align-items: center;
`

const SectionsHeaderCheckboxStyle = `
  margin-right: 10px;
  padding-left: 2px;
`

const SectionsHeaderTitleStyle = `
  display: flex;
  align-items: center;
  font: var(--11-regular);
`

function roundUpToClosestFootInMetric(metric: number): number {
  if (metric === 0) return 0
  return feetToMeter(Math.ceil(metric * METER_TO_FEET))
}

export const Sections = ({
  sectionToggle,
  setSectionToggle,
  sectionLength,
  setSectionLength,
  currentSectionLengths,
}: {
  sectionToggle: boolean
  setSectionToggle: (value: boolean) => void
  sectionLength: number | undefined
  setSectionLength: (length: number) => void
  currentSectionLengths: number[]
}) => {
  const t = useTranslator()
  const canEdit = canEditProposalSignal.value
  const imperialFlag = useIsImperial()
  let currentSectionValue =
    currentSectionLengths.length > 0 && currentSectionLengths.every((length, i, l) => Math.abs(length - l[0]) < 1e-5)
      ? toFeetIfImperial(currentSectionLengths[0], imperialFlag)
      : undefined

  return (
    <>
      <div style={`display:flex; justify-content: space-between;`}>
        <div style={SectionsHeaderBoxStyle}>
          <weave-checkbox
            disabled={!canEdit}
            style={SectionsHeaderCheckboxStyle}
            checked={sectionToggle}
            onChange={() => {
              setSectionToggle(!sectionToggle)
            }}
          />
          <div style={SectionsHeaderTitleStyle}>{"Sections"}</div>
        </div>
        {sectionToggle && (
          <div style={ParameterStyle + " width: 96px;"}>
            <InputWithIcon
              id={t(($) => $.building.lineBuilding.targetSectionLength)}
              icon={icons.section_length}
              label={t(($) => $.building.tooltips.targetSectionLengthLabel)}
              unit={"length"}
              value={sectionLength}
              onChange={(value) => {
                setSectionLength(value)
              }}
              disabled={!canEdit || !currentSectionLengths.length}
              feetStep={1}
              metricStep={0.5}
              metricMin={imperialFlag ? feetToMeter(10) : 3}
              metricMax={imperialFlag ? roundUpToClosestFootInMetric(1000) : 1000}
            />
          </div>
        )}
      </div>
      {currentSectionValue &&
        sectionLength &&
        currentSectionValue !== toFeetIfImperial(sectionLength, imperialFlag) && (
          <div style={"color: red; font-style: italic; font-size: 11px"}>
            Current section: {currentSectionValue} {imperialFlag ? "ft" : "m"}
          </div>
        )}
    </>
  )
}
