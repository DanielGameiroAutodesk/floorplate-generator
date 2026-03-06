import { useZoomToFit } from "src/integrations/SceneToolsToolbar/tools/CameraControls/ZoomToFit"
import { ZoomToFitIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import useCheckSelection from "src/integrations/wsm-tools/wsr/integrated/hooks/useCheckSelection"
import { useTranslator } from "src/i18n"

import S from "./SceneControls.module.pcss"
import { getShortcutFromCommandOrName } from "src/integrations/wsm-tools/wsr/toolMeta"

const ZoomToFit = () => {
  const t = useTranslator()
  const zoomToFit = useZoomToFit()

  const { hasSelectedSomething } = useCheckSelection()

  return (
    <weave-tooltip
      text={hasSelectedSomething ? t(($) => $.wsm.zoom.fitSelection) : t(($) => $.wsm.zoom.fitProposal)}
      nub="down-center"
      shortcutwindows={
        hasSelectedSomething ? getShortcutFromCommandOrName("Zoom Selection") : getShortcutFromCommandOrName("Zoom All")
      }
      shortcutmac={
        hasSelectedSomething ? getShortcutFromCommandOrName("Zoom Selection") : getShortcutFromCommandOrName("Zoom All")
      }
    >
      <div className={S.SceneToolButton} onClick={() => void zoomToFit()}>
        <ZoomToFitIcon />
      </div>
    </weave-tooltip>
  )
}

export default ZoomToFit
