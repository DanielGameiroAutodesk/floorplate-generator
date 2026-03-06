import { useTranslator } from "src/i18n"
import { save3dSketch } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

export const Save3DSketchButton = () => {
  const t = useTranslator()
  return (
    <weave-tooltip text={t(($) => $.wsm.actions.updateProperties)} nub="down-center">
      <weave-icon-button
        onClick={(e) => {
          save3dSketch()
          e.stopPropagation()
          Analytics.track(EventName.Use, {
            feature_category: FeatureCategory.DesignTool,
            feature: "3dSketch",
            sub_feature: "Update area metrics",
          })
        }}
        style="padding-top: 4px;"
        id="i3dsSaveButton"
      >
        <forma-refresh-16 />
      </weave-icon-button>
    </weave-tooltip>
  )
}
export default Save3DSketchButton
