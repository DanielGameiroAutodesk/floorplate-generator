import { CaretIcon, SelectionMenuIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import { useTranslator } from "src/i18n"

import S from "src/integrations/wsm-tools/wsr/integrated/components/SceneControls/SceneControls.module.pcss"
import { selectionMenuOpenState } from "src/integrations/wsm-tools/wsr/integrated/state"
import { useRecoilState } from "recoil"

const SelectionMenuControl = () => {
  const t = useTranslator()
  const [isSelectionMenuOpen, setIsSelectionMenuOpen] = useRecoilState(selectionMenuOpenState)

  const buildSelectionMenuButton = () => (
    <div
      className={S.SceneToolButton}
      onClick={() => setIsSelectionMenuOpen(!isSelectionMenuOpen)}
      style={{ position: "relative" }}
    >
      <SelectionMenuIcon />
      <div style={{ position: "absolute", top: "0px", right: "6px" }}>
        <CaretIcon />
      </div>
    </div>
  )

  return !isSelectionMenuOpen ? (
    <weave-tooltip text={t(($) => $.wsm.selection.selection)} nub="down-center">
      {buildSelectionMenuButton()}
    </weave-tooltip>
  ) : (
    buildSelectionMenuButton()
  )
}

export default SelectionMenuControl
