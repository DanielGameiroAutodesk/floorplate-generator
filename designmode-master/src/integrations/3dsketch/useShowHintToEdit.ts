import { useSetRecoilState } from "recoil"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import type { I18nStringProvider } from "src/i18n"
import {
  isElementEditableIn3DSketchSignal,
  isElementEditableIn3DSketchWithIntegratedCheckSignal,
} from "./3dsketch-selection-state"
import { featureFlagSignalFamily, URLFlag } from "src/lib/featureToggling"
import { useSignalEffect } from "@preact/signals"
import { isAppInitializedSignal } from "src/core/app-initialized"
import { in3DSketchSignal } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"

const useShowHintToEdit = () => {
  const setGuideText = useSetRecoilState(guideTextAtom)

  useSignalEffect(() => {
    if (!isAppInitializedSignal.value || in3DSketchSignal.value) return

    const editAllIntegrate = featureFlagSignalFamily(URLFlag.EditAllIntegrate).value
    const isElementEditableWithIntegratedCheck = isElementEditableIn3DSketchWithIntegratedCheckSignal.value
    const isElementEditableWithCurrentCheck = isElementEditableIn3DSketchSignal.value
    const isElementEditableIn3DSketch = editAllIntegrate
      ? isElementEditableWithIntegratedCheck
      : isElementEditableWithCurrentCheck

    setGuideText(
      (): I18nStringProvider => (t) =>
        isElementEditableIn3DSketch ? t(($) => $.wsm.actions.howToStartEditingMessage) : "",
    )
  })
}

export default useShowHintToEdit
