import { useTranslator } from "src/i18n"
import styles from "./FinalModal.module.pcss"
import { CloseIcon } from "src/lib/components/icons/CloseIcon"
import BuildingIcon from "src/lib/components/icons/building/BuildingIcon"
import { ImportIcon } from "src/integrations/import/ImportIcon"
import { CompareIcon } from "src/lib/components/icons/Compare"
import { useCallback, useEffect } from "preact/hooks"
import { Analytics } from "src/core/analytics"
import { EventName } from "@spacemakerai/webapp-analytics"
import type { ComponentChild } from "preact"
import { EXPERIMENT_ID, FinalModalTracking } from "./analytics"

interface SuggestedActionProps {
  icon: ComponentChild
  header: string
  body: string
}

function SuggestedAction({ icon, header, body }: SuggestedActionProps) {
  return (
    <div className={styles.SuggestedAction}>
      <div className={styles.IconContainer}>{icon}</div>
      <div>
        <h2 className={styles.SuggestedActionHeader}>{header}</h2>
        <p>{body}</p>
      </div>
    </div>
  )
}

export default function FinalModal({ onClose }: { onClose: () => void }) {
  const t = useTranslator()

  useEffect(() => {
    Analytics.track(EventName.ExperimentDone, FinalModalTracking.eventProperties, {
      experiment_id: EXPERIMENT_ID,
      experiment_cohort: "treatment",
    })
  }, [])

  const setModalRef = useCallback((element: HTMLDialogElement | null) => {
    if (element && !element.open) {
      element.showModal()
    }
  }, [])

  const handleClose = (action: string) => {
    Analytics.track(EventName.Close, FinalModalTracking.eventProperties, { action, experiment_id: EXPERIMENT_ID })
    onClose()
  }

  const handleShowMeMore = () => {
    Analytics.track(EventName.Select, FinalModalTracking.eventProperties, {
      action: FinalModalTracking.Action.SHOW_ME_MORE_CLICKED,
      experiment_id: EXPERIMENT_ID,
    })
    window.Intercom("showSpace", "help")
    onClose()
  }

  // Intercom isn't available immediately upon load, so this check needs polling to be robust,
  // but since this modal is never shown before the user has spent some time in the app, that's unecessary in this case
  const hasIntercom = window.Intercom != null

  return (
    <dialog ref={setModalRef} className={styles.Modal}>
      <button
        className={styles.CloseButton}
        onClick={() => handleClose(FinalModalTracking.Action.CLOSE_BUTTON_CLICKED)}
      >
        <CloseIcon />
      </button>
      <h1 className={styles.Header}>{t(($) => $.automatedOnboarding.finalModal.title)}</h1>
      <p className={styles.Body}>{t(($) => $.automatedOnboarding.finalModal.subTitle)}</p>
      <div className={styles.Content}>
        <SuggestedAction
          icon={<BuildingIcon />}
          header={t(($) => $.automatedOnboarding.finalModal.suggestedAction1.header)}
          body={t(($) => $.automatedOnboarding.finalModal.suggestedAction1.body)}
        />
        <SuggestedAction
          icon={<ImportIcon />}
          header={t(($) => $.automatedOnboarding.finalModal.suggestedAction2.header)}
          body={t(($) => $.automatedOnboarding.finalModal.suggestedAction2.body)}
        />
        <SuggestedAction
          icon={<CompareIcon />}
          header={t(($) => $.automatedOnboarding.finalModal.suggestedAction3.header)}
          body={t(($) => $.automatedOnboarding.finalModal.suggestedAction3.body)}
        />
      </div>
      <div className={styles.Footer}>
        {hasIntercom && (
          <weave-button variant="flat" density="medium" onClick={handleShowMeMore}>
            {t(($) => $.automatedOnboarding.finalModal.showMeHow)}
          </weave-button>
        )}
        <weave-button
          variant="solid"
          onClick={() => handleClose(FinalModalTracking.Action.GOT_IT_BUTTON_CLICKED)}
          density="medium"
        >
          {t(($) => $.automatedOnboarding.finalModal.finalButton)}
        </weave-button>
      </div>
    </dialog>
  )
}
