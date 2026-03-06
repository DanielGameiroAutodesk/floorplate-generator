import { WeaveInputComponent, withAccess, withImperial } from "src/lib/components/LengthInput/WeaveInputHelpers"
import { useTranslator } from "src/i18n"

import styles from "src/lib/components/automations/AutomationPropertyPanel.module.pcss"
import type { TreeAreaConfig } from "./area/TreeAreaGenerator"
import type { VNode } from "preact"
import type { TreeLineConfig } from "./lines/TreeLinesGenerator"
import { useCallback, useMemo } from "preact/hooks"
import Spacing16 from "src/lib/components/icons/Spacing16"
import Buffer16 from "src/lib/components/icons/Buffer_16"
import {
  LineAligmentRight16,
  LineAlignmentCenter16,
  LineAlignmentLeft16,
} from "src/lib/components/icons/LineAlignment_16"
import iconButtonStyles from "src/lib/components/icons/IconButton.module.pcss"
import { IconButton } from "src/lib/components/icons/IconButton"
import Height16 from "src/lib/components/icons/Height16"
import { canEditProposalSignal } from "src/core/edit-access-state"
import PropertyPanel from "src/lib/components/PropertyPanel"

const DistanceInput = withAccess(withImperial(WeaveInputComponent))

export type VegetationInputConfig = {
  metricAlignmentMin: number
  metricAlignmentMax: number
  metricAvgSpacingMin: number
  metricAvgSpacingMax: number
  metricHeightMin: number
  metricHeightMax: number
  metricInitialOffset: number
  metricStep: number
  feetStep: number
}

function LineAlignment(props: {
  lineAlignment: "top" | "center" | "bottom"
  setLineAlignment: (lineAlignment: "top" | "center" | "bottom") => void
}) {
  const t = useTranslator()
  return (
    <div className={iconButtonStyles.IconButtonGroup} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
      <IconButton
        text={t(($) => $.vegetation.alignment.center)}
        selected={props.lineAlignment === "center"}
        onClick={() => props.setLineAlignment("center")}
      >
        <LineAlignmentCenter16 />
      </IconButton>
      <IconButton
        text={t(($) => $.vegetation.alignment.left)}
        selected={props.lineAlignment === "top"}
        onClick={() => props.setLineAlignment("top")}
      >
        <LineAlignmentLeft16 />
      </IconButton>
      <IconButton
        text={t(($) => $.vegetation.alignment.right)}
        selected={props.lineAlignment === "bottom"}
        onClick={() => props.setLineAlignment("bottom")}
      >
        <LineAligmentRight16 />
      </IconButton>
      {/*<IconButton
        text={"Double sided"}
        selected={props.lineAlignment === "doubleSided"}
        onClick={() => props.setLineAlignment("doubleSided")}
      >
        <LineAlignmentDoubleSided16 />
      </IconButton>*/}
    </div>
  )
}

export function VegetationLineProperties({
  vegetationProperties,
  onUpdateVegetationProperties,
  inputConfig,
}: {
  vegetationProperties: TreeLineConfig
  onUpdateVegetationProperties: (newCfg: TreeLineConfig) => void
  inputConfig: VegetationInputConfig
}) {
  const t = useTranslator()
  const areaProps = useMemo(() => {
    return {
      avgSpacing: vegetationProperties.spacing,
      height: vegetationProperties.height,
    }
  }, [vegetationProperties.height, vegetationProperties.spacing])
  const updateAreaProps = useCallback(
    (newAreaCfg: TreeAreaConfig) => {
      onUpdateVegetationProperties({
        ...vegetationProperties,
        height: newAreaCfg.height,
        spacing: newAreaCfg.avgSpacing,
      })
    },
    [onUpdateVegetationProperties, vegetationProperties],
  )
  return (
    <>
      <div className={styles.AutomationRow}>
        <div className={styles.AutomationInputWithIcon}>
          <label htmlFor="offset" className={styles.AutomationIconLabel}>
            <weave-tooltip text={t(($) => $.vegetation.properties.offsetTooltip)}>
              <Buffer16 />
            </weave-tooltip>
          </label>
          <DistanceInput
            id={"offset"}
            disabled={vegetationProperties.alignment === "center"}
            metricValue={vegetationProperties.offset}
            onChangeValue={(offset) => onUpdateVegetationProperties({ ...vegetationProperties, offset })}
            editAccess={canEditProposalSignal.value}
            metricStep={inputConfig.metricStep}
            metricMin={inputConfig.metricAvgSpacingMin}
            metricMax={inputConfig.metricAvgSpacingMax}
            feetStep={inputConfig.feetStep}
          />
        </div>
        <LineAlignment
          lineAlignment={vegetationProperties.alignment}
          setLineAlignment={(alignment) =>
            onUpdateVegetationProperties({
              ...vegetationProperties,
              alignment,
              offset:
                alignment === "center"
                  ? 0
                  : vegetationProperties.offset === 0
                    ? inputConfig.metricInitialOffset
                    : vegetationProperties.offset,
            })
          }
        />
      </div>
      <VegetationAreaProperties
        vegetationProperties={areaProps}
        onUpdateVegetationProperties={updateAreaProps}
        inputConfig={inputConfig}
      />
    </>
  )
}

export function VegetationAreaProperties({
  vegetationProperties,
  onUpdateVegetationProperties,
  inputConfig,
}: {
  vegetationProperties: TreeAreaConfig
  onUpdateVegetationProperties: (newCfg: TreeAreaConfig) => void
  inputConfig: VegetationInputConfig
}) {
  const t = useTranslator()

  function setTreeHeight(treeHeight: number) {
    onUpdateVegetationProperties({ ...vegetationProperties, height: treeHeight })
  }

  function setSpacing(spacing: number) {
    onUpdateVegetationProperties({ ...vegetationProperties, avgSpacing: spacing })
  }

  return (
    <div className={styles.AutomationRow}>
      <div className={styles.AutomationInputWithIcon}>
        <label htmlFor="treeHeight" className={styles.AutomationIconLabel}>
          <weave-tooltip text={t(($) => $.vegetation.properties.heightTooltip)}>
            <Height16 />
          </weave-tooltip>
        </label>
        <DistanceInput
          id={"treeHeight"}
          metricValue={vegetationProperties.height}
          onChangeValue={setTreeHeight}
          editAccess={canEditProposalSignal.value}
          metricStep={inputConfig.metricStep}
          metricMin={inputConfig.metricHeightMin}
          metricMax={inputConfig.metricHeightMax}
          feetStep={inputConfig.feetStep}
        />
      </div>
      <div className={styles.AutomationInputWithIcon}>
        <label htmlFor="treeSpacing" className={styles.AutomationIconLabel}>
          <weave-tooltip text={t(($) => $.vegetation.alignment.spacing)}>
            <Spacing16 />
          </weave-tooltip>
        </label>
        <DistanceInput
          id={"treeSpacing"}
          metricValue={vegetationProperties.avgSpacing}
          onChangeValue={setSpacing}
          editAccess={canEditProposalSignal.value}
          metricStep={inputConfig.metricStep}
          metricMin={inputConfig.metricAvgSpacingMin}
          metricMax={inputConfig.metricAvgSpacingMax}
          feetStep={inputConfig.feetStep}
        />
      </div>
    </div>
  )
}

export function VegetationAutomationPropertyPanel({ children }: { children?: VNode | VNode[] }) {
  const t = useTranslator()
  return (
    <PropertyPanel.BorderContainer>
      <PropertyPanel.AutomationHeader
        editAccess={canEditProposalSignal.value}
        title={t(($) => $.vegetation.title)}
        release={undefined}
      />
      {children}
    </PropertyPanel.BorderContainer>
  )
}
