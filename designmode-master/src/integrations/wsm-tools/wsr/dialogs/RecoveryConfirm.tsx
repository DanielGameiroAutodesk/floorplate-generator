import { signal, useSignalEffect } from "@preact/signals"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import { useCallback, useEffect, useRef } from "preact/hooks"
import { recoveryConfirmedSignal, recoveryDiscardedSignal } from "src/integrations/wsm-tools/wsr/recovery"
import styles from "./StandardDialog.module.pcss"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"

export const showRecoveryConfirmSignal = signal(false)

// Duration in milliseconds to keep the recoveryDiscardedSignal true before resetting
// This allows other parts of the system to detect that recovery was discarded
const RECOVERY_DISCARDED_SIGNAL_RESET_DELAY_MS = 500

// 3d Sketch Recovery confirmation modal
export const RecoveryConfirm = () => {
  const modalRef = useRef<WeaveModalElement | null>(null)
  useEffect(() => {
    modalRef.current?.show()
  })
  // Timeout handle for resetting the recoveryDiscardedSignal after a delay.
  // When a user discards recovery, we set recoveryDiscardedSignal to true,
  // then reset it to false after a delay to allow the recovery logic to detect
  // the discard action and clear the stored recovery data.
  const recoveryDiscardedResetTimeout = useRef<NodeJS.Timeout | null>(null)

  // Cleanup timeout on component unmount to prevent memory leaks and race conditions
  useEffect(() => {
    return () => {
      if (recoveryDiscardedResetTimeout.current) {
        clearTimeout(recoveryDiscardedResetTimeout.current)
        recoveryDiscardedResetTimeout.current = null
      }
    }
  }, [])

  useSignalEffect(() => {
    if (showRecoveryConfirmSignal.value) {
      Analytics.track(EventName.Use, {
        feature_category: FeatureCategory.DesignTool,
        feature: "3dSketch",
        sub_feature: "Recovery Model Found",
      })
    }
  })
  const onCancel = useCallback((isDiscard: boolean = false) => {
    if (isDiscard) {
      recoveryDiscardedSignal.value = true
      if (recoveryDiscardedResetTimeout.current) {
        clearTimeout(recoveryDiscardedResetTimeout.current)
        recoveryDiscardedResetTimeout.current = null
      }
      recoveryDiscardedResetTimeout.current = setTimeout(() => {
        recoveryDiscardedSignal.value = false
      }, RECOVERY_DISCARDED_SIGNAL_RESET_DELAY_MS)
    }
    // Set confirmed to false and close the modal
    recoveryConfirmedSignal.value = false
    showRecoveryConfirmSignal.value = false
    Analytics.track(EventName.Use, {
      feature_category: FeatureCategory.DesignTool,
      feature: "3dSketch",
      sub_feature: `${isDiscard ? "Discard" : "Cancel"} Recovered Model`,
    })
  }, [])
  const onConfirm = useCallback(() => {
    // Set confirmed to true and close the modal
    recoveryConfirmedSignal.value = true
    showRecoveryConfirmSignal.value = false
    Analytics.track(EventName.Use, {
      feature_category: FeatureCategory.DesignTool,
      feature: "3dSketch",
      sub_feature: "Load Recovered Model",
    })
  }, [])
  const t = useTranslator()
  if (!showRecoveryConfirmSignal.value) return null
  return (
    <weave-modal width="350px" ref={modalRef} onClose={() => onCancel(false)} class={"no-margin-padding-clear"}>
      <h1 slot="title">{t(($) => $.wsm.dialogs.recoveryTitle)}</h1>
      <div slot="content">
        <p>{t(($) => $.wsm.dialogs.recoveryClosedWithoutSaving)}</p>
        <p>{t(($) => $.wsm.dialogs.recoveryQuestion)}</p>
      </div>
      <div slot="actions" className={styles.Actions}>
        <weave-button onClick={() => onCancel(true)} variant="flat">
          Discard
        </weave-button>
        <weave-button onClick={onConfirm} variant="solid">
          Recover
        </weave-button>
      </div>
    </weave-modal>
  )
}
