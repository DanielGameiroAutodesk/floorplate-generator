import styles from "./styles.module.css"

import { elementState } from "src/core/elements/ElementState"
import { ElementSnapshotStatus } from "src/core/elements/ElementSnapshotStatus"
import { useTranslator } from "src/i18n"

export default function ElementStateValidationBanner() {
  const t = useTranslator()
  const snapshot = elementState.currentSnapshotOrUndefinedSignal.value
  if (!snapshot || snapshot.status !== ElementSnapshotStatus.InRecovery) return null

  return (
    <div className={styles.viewModeBanner}>
      <span>{t(($) => $.proposal.errors.downloadElementsFailed)}</span>

      <span>{t(($) => $.proposal.errors.downloadElementsRecovery)}</span>
    </div>
  )
}
