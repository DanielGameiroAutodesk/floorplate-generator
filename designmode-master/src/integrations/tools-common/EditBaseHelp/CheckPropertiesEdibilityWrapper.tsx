import styles from "./EditBaseHelp.module.pcss"
import {
  selectedBasePathsInProposalContextSignal,
  selectedPathsInCurrentProposalSignal,
} from "src/core/selection/selectionState"
import EditBaseIcon from "./EditBaseIcon"
import { enterEditBase } from "src/core/useEnterEditBase"
import type { ComponentChildren } from "preact"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useTranslator } from "src/i18n"

/* Disables children properties when selected element(s) are not in current context, more specifically if a Base
   element is selected while editing the proposal */
export default function CheckPropertiesEdibilityWrapper({ children }: { children: ComponentChildren }) {
  const t = useTranslator()
  const canEdit = canEditProposalSignal.value

  const selection = selectedPathsInCurrentProposalSignal.value
  const selectedBasePathsInProposalContext = selectedBasePathsInProposalContextSignal.value

  if (selectedBasePathsInProposalContext.size > 0 && selectedBasePathsInProposalContext.size !== selection.size) {
    return (
      <div className={styles.MixedMessage}>
        <span>{t(($) => $.base.editBaseRightMenuMixedSelectionMessage)}</span>
      </div>
    )
  }

  if (selectedBasePathsInProposalContext.size > 0 && selectedBasePathsInProposalContext.size === selection.size) {
    return (
      <>
        {canEdit && (
          <button className={styles.BaseLayerHelp} onClick={enterEditBase}>
            <EditBaseIcon />
            <div>{t(($) => $.base.editBaseRightMenuMessage)}</div>
          </button>
        )}
        <div
          inert
          className={styles.DisabledProperties}
          onKeyDownCapture={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          {children}
        </div>
      </>
    )
  }

  return <>{children}</>
}
