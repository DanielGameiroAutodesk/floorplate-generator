import { useTranslator } from "src/i18n"
import styles from "./IntroModal.module.pcss"
import { useCallback, useState } from "preact/hooks"
import initialImage from "./images/initial.png"
import contextualImage from "./images/contextual.png"
import analysisImage from "./images/analysis.png"
import { CloseIcon } from "src/lib/components/icons/CloseIcon"
import { Analytics } from "src/core/analytics"
import { EventName } from "@spacemakerai/webapp-analytics"
import { EXPERIMENT_ID, IntroModalTracking } from "./analytics"

type SectionName = "contextual" | "analysis"

function ExpandableSection({
  header,
  body,
  onClick,
  isOpen,
  number,
  sectionName,
}: {
  header: string
  body: string
  onClick: () => void
  isOpen: boolean
  number: string
  sectionName: SectionName
}) {
  const handleClick = () => {
    const newState = !isOpen ? "open" : "closed"
    Analytics.track(EventName.Select, IntroModalTracking.eventProperties, {
      action: IntroModalTracking.Action.SECTION_TOGGLED,
      section: sectionName,
      state: newState,
      experiment_id: EXPERIMENT_ID,
    })
    onClick()
  }

  return (
    <div className={styles.Expandable}>
      <h2 className={styles.ExpandableHeader} data-number={number} onClick={handleClick}>
        {header}
        {isOpen ? <weave-chevron-up /> : <weave-chevron-down />}
      </h2>
      {isOpen && <p className={styles.ExpandableBody}>{body}</p>}
    </div>
  )
}

export default function IntroModal({ onClose }: { onClose: () => void }) {
  const t = useTranslator()

  const [state, setState] = useState<"initial" | "contextual" | "analysis">("initial")

  const setModalRef = useCallback((element: HTMLDialogElement | null) => {
    if (element && !element.open) {
      element.showModal()
    }
  }, [])

  let imgSrc = initialImage
  if (state === "contextual") {
    imgSrc = contextualImage
  } else if (state === "analysis") {
    imgSrc = analysisImage
  }

  const handleClose = (action: string) => {
    Analytics.track(EventName.Close, IntroModalTracking.eventProperties, { action, experiment_id: EXPERIMENT_ID })
    onClose()
  }

  return (
    <dialog ref={setModalRef} className={styles.Modal}>
      <button
        className={styles.CloseButton}
        onClick={() => handleClose(IntroModalTracking.Action.CLOSE_BUTTON_CLICKED)}
      >
        <CloseIcon />
      </button>
      <div className={styles.LeftSide}>
        <h1 className={styles.Header}>{t(($) => $.automatedOnboarding.title)}</h1>
        <p className={styles.Body}>
          {t.icu(($) => $.automatedOnboarding.body, {
            bold: (children: string) => <strong>{children}</strong>,
          })}
        </p>
        <ExpandableSection
          header={t(($) => $.automatedOnboarding.contextual.header)}
          body={t(($) => $.automatedOnboarding.contextual.body)}
          onClick={() => setState((prev) => (prev === "contextual" ? "initial" : "contextual"))}
          isOpen={state === "contextual"}
          number="1"
          sectionName="contextual"
        />
        <ExpandableSection
          header={t(($) => $.automatedOnboarding.sunAnalysis.header)}
          body={t(($) => $.automatedOnboarding.sunAnalysis.body)}
          onClick={() => setState((prev) => (prev === "analysis" ? "initial" : "analysis"))}
          isOpen={state === "analysis"}
          number="2"
          sectionName="analysis"
        />
        <div className={styles.ButtonContainer}>
          <weave-button
            variant="solid"
            onClick={() => handleClose(IntroModalTracking.Action.CONTINUE_BUTTON_CLICKED)}
            density="medium"
          >
            {t(($) => $.automatedOnboarding.continueButton)}
          </weave-button>
        </div>
      </div>
      <div className={styles.RightSide}>
        <img src={imgSrc} className={state === "analysis" ? styles.AnalysisImage : undefined} />
      </div>
    </dialog>
  )
}
