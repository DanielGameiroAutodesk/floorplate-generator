import { useCallback, useEffect, useRef, useState } from "preact/hooks"
import { useTranslator } from "src/i18n"
import { Analytics } from "src/core/analytics"
import { EventName } from "@spacemakerai/webapp-analytics"
import { CloseIcon } from "src/lib/components/icons/CloseIcon"
import { isDemoSignal } from "src/core/project/project"
import styles from "./DemoProfilingSuccessModal.module.pcss"
import modalImageEU from "./assets/explore-forma-eu.webp"
import modalImageUS from "./assets/explore-forma-us.webp"
import modalImageAUS from "./assets/explore-forma-aus.webp"

function getRegionalImage() {
  const hostname = window.location.hostname
  if (hostname.endsWith("autodeskforma.eu")) return modalImageEU
  if (hostname.endsWith("autodeskforma.com")) return modalImageUS
  if (hostname.endsWith("forma.aus.autodesk.com")) return modalImageAUS
  return modalImageUS // default to US
}

export function DemoProfilingSuccessModal() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const t = useTranslator()
  const modalImage = getRegionalImage()
  const isDemo = isDemoSignal.value

  const [showModal, setShowModal] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)
    return urlParams.has("choice") && urlParams.get("choice") === "explore_forma"
  })

  useEffect(() => {
    if (showModal && isDemo) {
      dialogRef.current?.showModal()

      const url = new URL(window.location.href)
      url.searchParams.delete("choice")
      window.history.replaceState({}, document.title, url.toString())

      Analytics.track(
        EventName.View,
        { feature: "site_design", sub_feature: "profiling_success_modal" },
        { profiling_choice: "explore_forma", experiment_id: "intent-based-profiling-experiment" },
      )
    }
  }, [showModal, isDemo])

  const handleContinue = useCallback(() => {
    Analytics.track(
      EventName.Select,
      { feature: "site_design", sub_feature: "profiling_success_modal" },
      {
        profiling_choice: "explore_forma",
        element_name: "continue_button",
        experiment_id: "intent-based-profiling-experiment",
      },
    )
    setShowModal(false)
    dialogRef.current?.close()
  }, [])

  const handleGoToHome = useCallback(() => {
    Analytics.track(
      EventName.Select,
      { feature: "site_design", sub_feature: "profiling_success_modal" },
      {
        profiling_choice: "explore_forma",
        element_name: "go_to_home_button",
        experiment_id: "intent-based-profiling-experiment",
      },
    )
    window.location.href = "/app-home/"
  }, [])

  const handleClose = useCallback(() => {
    Analytics.track(
      EventName.Close,
      { feature: "site_design", sub_feature: "profiling_success_modal" },
      {
        profiling_choice: "explore_forma",
        close_method: "x_button",
        experiment_id: "intent-based-profiling-experiment",
      },
    )
    setShowModal(false)
    dialogRef.current?.close()
  }, [])

  if (!showModal || !isDemo) {
    return null
  }

  return (
    <dialog ref={dialogRef} className={styles.Dialog}>
      <div className={styles.ModalContainer}>
        <div className={styles.ModalContent}>
          <div className={styles.ImageSection}>
            <img src={modalImage} alt={t(($) => $.profilingModal.imageAlt)} className={styles.Image} />
          </div>
          <div className={styles.ContentSection}>
            <div className={styles.HeaderText}>{t(($) => $.profilingModal.headerGetStartedWith)}</div>
            <h2 className={styles.TitleText}>{t(($) => $.profilingModal.titleFormaSiteDesign)}</h2>
            <p className={styles.DescriptionText}>{t(($) => $.profilingModal.description)}</p>
            <p className={styles.CallToActionText}>
              {t.component(($) => $.profilingModal.callToAction, {
                bold: <strong>{t(($) => $.profilingModal.callToActionBold)}</strong>,
              })}
            </p>
            <div className={styles.ButtonContainer}>
              <weave-button onClick={handleContinue} type="button" variant="solid" density="medium">
                {t(($) => $.profilingModal.buttonContinue)}
              </weave-button>
              <weave-button onClick={handleGoToHome} type="button" density="medium">
                {t(($) => $.profilingModal.buttonGoToHome)}
              </weave-button>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.CloseButtonWrapper}>
        <button className={styles.CloseButton} onClick={handleClose} type="button">
          <CloseIcon />
        </button>
      </div>
    </dialog>
  )
}
