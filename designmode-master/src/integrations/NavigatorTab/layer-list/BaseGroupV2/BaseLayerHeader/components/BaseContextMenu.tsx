import type { FormaElement } from "@spacemakerai/element-types"
import { scenarioHiddenSignal } from "src/core/hidden"
import useBaseUtils from "src/core/useBaseUtils"
import { enterEditBase } from "src/core/useEnterEditBase"
import { useTranslator } from "src/i18n"

type Props = {
  position: { x: number; y: number }
  base: FormaElement
  closeMenus: () => void
  initiateChangeName: () => void
  initiateChangeIndicator: () => void
  openSwapMenu: (e: MouseEvent) => void
  setLoading: (loading: boolean) => void
}

export default function BaseContextMenu(props: Props) {
  const t = useTranslator()
  const { position, base, closeMenus, initiateChangeName, initiateChangeIndicator, openSwapMenu, setLoading } = props
  const { duplicateBase, swapBase } = useBaseUtils()
  const baseHidden = scenarioHiddenSignal.value

  return (
    <forma-context-menu-container onClose={closeMenus} left={position.x} top={position.y}>
      <forma-context-menu>
        <forma-context-menu-item text={t(($) => $.base.editBaseButton)} onClick={(e) => enterEditBase(e, false)} />
        <forma-context-menu-item text={t(($) => $.ui.rename)} onClick={initiateChangeName} />
        <forma-context-menu-item text={t(($) => $.base.changeIndicatorLabel)} onClick={initiateChangeIndicator} />
        <forma-context-menu-item
          text={t(($) => $.ui.duplicate)}
          onClick={() => {
            setLoading(true)
            void duplicateBase(base).then((duplicatedBase) => {
              if (duplicatedBase) {
                void swapBase(duplicatedBase).then(() => {
                  setLoading(false)
                  initiateChangeName()
                })
              } else {
                setLoading(false)
              }
            })
          }}
        />
        <forma-context-menu-item
          text={baseHidden ? t(($) => $.ui.show) : t(($) => $.ui.hide)}
          onClick={() => {
            scenarioHiddenSignal.value = !baseHidden
          }}
        />
        <forma-context-menu-item text={t(($) => $.base.swapButton)} onClick={openSwapMenu} />
      </forma-context-menu>
    </forma-context-menu-container>
  )
}
