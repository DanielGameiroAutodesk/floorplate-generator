import iconButtonStyles from "src/lib/components/icons/IconButton.module.pcss"
import automationStyles from "src/lib/components/automations/AutomationPropertyPanel.module.pcss"
import { WeaveInputComponent, withAccess, withImperial } from "src/lib/components/LengthInput/WeaveInputHelpers"
import Buffer16 from "src/lib/components/icons/Buffer_16"
import { LineAligmentRight16, LineAlignmentLeft16 } from "src/lib/components/icons/LineAlignment_16"
import type { LineSettings, PlacementSide } from "src/integrations/composition-site-graph/graph-element/types"
import { IconButton } from "src/lib/components/icons/IconButton"
import type { WithIndeterminate, WithIndeterminateValues } from "src/lib/indeterminate"
import indeterminate from "src/lib/indeterminate"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useTranslator } from "src/i18n"

const DistanceInput = withAccess(withImperial(WeaveInputComponent))

function BufferInput(props: { buffer: WithIndeterminate<number>; setBuffer: (buffer: number) => void }) {
  const t = useTranslator()
  return (
    <div className={automationStyles.AutomationInputWithIcon}>
      <label htmlFor="buffer" className={automationStyles.AutomationIconLabel}>
        <weave-tooltip text={t(($) => $.rowhouse.tooltips.buffer)}>
          <Buffer16 />
        </weave-tooltip>
      </label>
      <DistanceInput
        id={"buildingDepth"}
        metricValue={indeterminate.valueOrDefault(props.buffer, undefined)}
        onChangeValue={(newValue) => props.setBuffer(newValue)}
        editAccess={canEditProposalSignal.value}
        metricStep={0.5}
        metricMin={0}
      />
    </div>
  )
}

function LineAlignment(props: {
  lineAlignment: WithIndeterminate<PlacementSide>
  setLineAlignment: (lineAlignment: PlacementSide) => void
}) {
  const t = useTranslator()
  return (
    <div style={{ width: "unset" }} className={iconButtonStyles.IconButtonGroup}>
      <IconButton
        text={t(($) => $.rowhouse.alignment.left)}
        selected={props.lineAlignment.type === "equal" && props.lineAlignment.value === "left"}
        onClick={() => props.setLineAlignment("left")}
      >
        <LineAlignmentLeft16 />
      </IconButton>
      <IconButton
        text={t(($) => $.rowhouse.alignment.right)}
        selected={props.lineAlignment.type === "equal" && props.lineAlignment.value === "right"}
        onClick={() => props.setLineAlignment("right")}
      >
        <LineAligmentRight16 />
      </IconButton>
      {/*<IconButton
        text={t(($) => $.rowhouse.alignment.center)}
        selected={props.lineAlignment === "center"}
        onClick={() => props.setLineAlignment("center")}
      >
        <LineAlignmentCenter16 />
      </IconButton>
      <IconButton
        text={"Double sided"}
        selected={props.lineAlignment === "doubleSided"}
        onClick={() => props.setLineAlignment("doubleSided")}
      >
        <LineAlignmentDoubleSided16 />
      </IconButton>*/}
    </div>
  )
}

export default function CompositionLineSettings(props: {
  setLineSettings: (settings: Partial<LineSettings>) => void
  lineSettings: WithIndeterminateValues<LineSettings>
}) {
  return (
    <div className={automationStyles.AutomationRow} style={{ marginBottom: "10px" }}>
      <BufferInput buffer={props.lineSettings.buffer} setBuffer={(buffer) => props.setLineSettings({ buffer })} />
      <LineAlignment
        setLineAlignment={(placementSide) => props.setLineSettings({ placementSide })}
        lineAlignment={props.lineSettings.placementSide}
      />
    </div>
  )
}
