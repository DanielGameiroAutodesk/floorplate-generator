import { useTranslator } from "src/i18n"
import { guidesMeasurementMenuOpenState } from "src/integrations/wsm-tools/wsr/integrated/state"
import { useRecoilState } from "recoil"
import { GuidesAndMeasurementsIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import S from "src/integrations/wsm-tools/wsr/integrated/components/SceneControls/SceneControls.module.pcss"

const GuidesAndMeasurements = () => {
  const t = useTranslator()
  const [isGuidesMeasurementMenuOpen, setIsGuidesMeasurementMenuOpen] = useRecoilState(guidesMeasurementMenuOpenState)

  const buildGuideMeasurementButton = () => (
    <div className={S.SceneToolButton} onClick={() => setIsGuidesMeasurementMenuOpen(!isGuidesMeasurementMenuOpen)}>
      <GuidesAndMeasurementsIcon />
    </div>
  )

  return !isGuidesMeasurementMenuOpen ? (
    <weave-tooltip text={t(($) => $.wsm.guidesAndMeasurements.title)} nub="down-center">
      {buildGuideMeasurementButton()}
    </weave-tooltip>
  ) : (
    buildGuideMeasurementButton()
  )
}

export default GuidesAndMeasurements
