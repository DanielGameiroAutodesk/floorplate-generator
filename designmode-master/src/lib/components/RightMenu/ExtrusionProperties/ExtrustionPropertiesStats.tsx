import LengthInput from "src/lib/components/LengthInput/LengthInput"
import { metricMinDefault } from "src/lib/components/LengthInput/formaUnitUtils"
import { labelClassName } from "src/lib/components/RightMenu/RightMenuLabel"
import { ElevationIcon } from "./ElevationIcon"
import { HeightIcon } from "./HeightIcon"
import { useTranslator } from "src/i18n"

import { RightMenuGridPanel } from "src/lib/components/RightMenu/RightMenuGridPanel"
import { useIsImperial } from "src/lib/unitSettings"

const ELEVATION_ID = "extrusion-elevation"
const HEIGHT_ID = "extrusion-height"

export const ExtrusionPropertiesStats = ({
  elevation,
  height,
  onElevationSubmit,
  onHeightSubmit,
  canEditProposal,
}: {
  elevation?: number
  height?: number
  onElevationSubmit?: (newElevation: number) => void
  onHeightSubmit?: (newHeight: number) => void
  canEditProposal: boolean
}) => {
  const t = useTranslator()
  const isImperial = useIsImperial()
  return (
    <>
      <RightMenuGridPanel>
        <weave-tooltip text={t(($) => $.properties.elevation)} style={{ gridColumn: "1/2" }} nub="right-center">
          <label className={labelClassName} htmlFor={ELEVATION_ID}>
            <ElevationIcon />
          </label>
        </weave-tooltip>
        <LengthInput
          style={{ gridColumn: "2/3" }}
          metricValue={elevation}
          onBlur={onElevationSubmit ?? (() => {})}
          id={ELEVATION_ID}
          isMixed={elevation === undefined}
          accessAware={true}
          disabled={!onElevationSubmit}
          editAccess={canEditProposal}
        />
        <weave-tooltip text={t(($) => $.properties.height)} style={{ gridColumn: "4/5" }} nub="right-center">
          <label className={labelClassName} htmlFor={HEIGHT_ID}>
            <HeightIcon />
          </label>
        </weave-tooltip>
        <LengthInput
          style={{ gridColumn: "5/6" }}
          metricValue={height}
          onBlur={onHeightSubmit ?? (() => {})}
          id={HEIGHT_ID}
          isMixed={height === undefined}
          accessAware={true}
          metricMin={metricMinDefault(isImperial)}
          disabled={!onHeightSubmit}
          editAccess={canEditProposal}
        />
      </RightMenuGridPanel>
    </>
  )
}
