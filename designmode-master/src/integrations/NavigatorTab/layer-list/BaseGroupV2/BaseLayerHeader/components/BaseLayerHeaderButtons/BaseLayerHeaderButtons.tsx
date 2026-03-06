import { EditIcon, SwapIcon } from "src/integrations/NavigatorTab/layer-list/Icons"
import tooltipImage from "./base-tooltip.gif"
import categoryStyles from "src/integrations/NavigatorTab/layer-list/Layer/Category.module.pcss"
import { resetContextRootSignal, resetSelectionSetSignal, scenarioModeSignal } from "src/core/selection/selectionState"
import { scenarioHiddenSignal } from "src/core/hidden"
import {
  HiddenEyeIcon,
  VisibleEyeIcon,
} from "src/integrations/SceneToolsToolbar/tools/VisibilityMenu/VisibilityMenuAssets"
import { useTranslator } from "src/i18n"
import { IfEditAccess } from "src/integrations/EditGuard/IfEditAccess"
import { PendingOperationBlockingOverlay } from "src/integrations/PendingOperation/PendingOperationBlockingOverlay"
import { enterEditBase } from "src/core/useEnterEditBase"
import { useCallback } from "preact/hooks"

export const BaseLayerHeaderButtons = ({ openSwapMenu }: { openSwapMenu: (e: MouseEvent) => unknown }) => {
  const t = useTranslator()
  const isBaseActive = scenarioModeSignal.value
  const baseHidden = scenarioHiddenSignal.value

  const backToProposal = useCallback((e: Event) => {
    e.stopPropagation()
    resetContextRootSignal()
    resetSelectionSetSignal()
  }, [])

  return (
    <PendingOperationBlockingOverlay description={(t) => t(($) => $.tools.pendingBaseProposalSwitchBlockedMessage)}>
      <div className={categoryStyles.Buttons}>
        <IfEditAccess>
          {isBaseActive ? (
            <button onClick={backToProposal} className={categoryStyles.EditButton} style={{ font: "var(--11-medium)" }}>
              {t(($) => $.base.editBaseDoneButton)}
            </button>
          ) : (
            <>
              <weave-tooltip text={t(($) => $.base.swapBaseButton)} nub={"down-center"}>
                <button onClick={openSwapMenu} className={`${categoryStyles.SwapButton}`}>
                  <SwapIcon />
                </button>
              </weave-tooltip>
              <div>
                <button
                  id="edit-base"
                  onClick={enterEditBase}
                  className={`${categoryStyles.EditButton}`}
                  style={{ color: "var(--text-color-light)", font: "var(--11-medium)" }}
                  data-tutorial-target="edit-base-button"
                >
                  <EditIcon />
                </button>
                <forma-expanded-tooltip
                  target-id="edit-base"
                  text={t(($) => $.base.editBaseButton)}
                  position="top"
                  componentPosition="center"
                  loadingduration={600}
                  help-url="https://help.autodeskforma.com/en/articles/7002902-how-to-work-with-bases-in-next-gen-projects-beta"
                >
                  <img src={tooltipImage} alt="Base" />
                  <p>{t(($) => $.navigator.base.descriptionParagraph1)}</p>
                  <p>{t(($) => $.navigator.base.descriptionParagraph2)}</p>
                </forma-expanded-tooltip>
              </div>
            </>
          )}
        </IfEditAccess>
        <weave-tooltip text={baseHidden ? t(($) => $.ui.show) : t(($) => $.ui.hide)} nub={"down-center"}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              scenarioHiddenSignal.value = !baseHidden
            }}
            className={categoryStyles.VisibilityToggle}
          >
            {baseHidden ? <HiddenEyeIcon /> : <VisibleEyeIcon />}
          </button>
        </weave-tooltip>
      </div>
    </PendingOperationBlockingOverlay>
  )
}
