import type { TreeAreaConfig } from "./TreeAreaGenerator"
import { PopoutProperty } from "src/lib/components/PopoutProperty/PopoutProperty"
import treesImage from "./trees.png"
import styles from "src/integrations/basic-elements/trees/TreePlacerGeneratorProperties.module.pcss"
import FormatLength from "src/lib/components/FormatLength"
import SliderGrid from "src/lib/components/SliderLengthInput/SliderGrid"
import { SliderLengthInput } from "src/integrations/inputs/SliderLengthInput"
import { useTranslator } from "src/i18n"

export function TreeAreaPropertyPopout({
  currentConfig,
  inputConfigs,
  onUpdateAvgSpacing,
  onUpdateHeight,
}: {
  currentConfig: TreeAreaConfig
  inputConfigs: {
    metricInitialOffset: number
    metricAlignmentMax: number
    metricStep: number
    metricAlignmentMin: number
    metricAvgSpacingMax: number
    metricHeightMin: number
    metricAvgSpacingMin: number
    feetStep: number
    metricHeightMax: number
  }
  onUpdateAvgSpacing: (value: number) => void
  onUpdateHeight: (value: number) => void
}) {
  const t = useTranslator()
  return (
    <PopoutProperty
      title={t(($) => $.vegetation.trees)}
      imgSrc={treesImage}
      summary={
        <span>
          <div className={styles.treePanel}>
            <span>{t(($) => $.vegetation.alignment.spacing)}</span>
            <span>
              <FormatLength metricLength={currentConfig.avgSpacing} />
            </span>
          </div>
          <div className={styles.treePanel}>
            <span>{t(($) => $.properties.height)}</span>
            <span>
              <FormatLength metricLength={currentConfig.height} />
            </span>
          </div>
        </span>
      }
      form={
        <SliderGrid>
          <SliderLengthInput
            key={"avgSpacing"}
            label={t(($) => $.vegetation.alignment.spacing)}
            metricMin={inputConfigs.metricAvgSpacingMin}
            metricMax={inputConfigs.metricAvgSpacingMax}
            metricStep={inputConfigs.metricStep}
            feetStep={inputConfigs.feetStep}
            id={"avgSpacing"}
            metricValue={currentConfig.avgSpacing}
            onSubmit={onUpdateAvgSpacing}
            tooltip={t(($) => $.vegetation.tooltips.averageDistanceLabel)}
          />
          <SliderLengthInput
            key={"height"}
            label={t(($) => $.properties.height)}
            metricMin={inputConfigs.metricHeightMin}
            metricMax={inputConfigs.metricHeightMax}
            metricStep={inputConfigs.metricStep}
            feetStep={inputConfigs.feetStep}
            id={"height"}
            metricValue={currentConfig.height}
            onSubmit={onUpdateHeight}
            tooltip={t(($) => $.vegetation.tooltips.heightLabel)}
          />
        </SliderGrid>
      }
    />
  )
}
