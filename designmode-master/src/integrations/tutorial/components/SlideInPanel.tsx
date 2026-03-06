import { isTutorialPanelOpenSignal, toggleTutorialPanel } from "src/integrations/tutorial/closeTutorial"
import styles from "./SlideInPanel.module.pcss"
import { useEffect } from "react"
import type { ReactNode } from "react"
import "./SlideInPanel.css"
import { useTranslator } from "src/i18n"
import HelpIcon16 from "src/integrations/tutorial/icons/HelpIcon16"
import OpenModalIcon from "src/integrations/tutorial/icons/OpenModalIcon"

export function TutorialPanelButton() {
  const isOpen = isTutorialPanelOpenSignal.value
  const t = useTranslator()

  if (isOpen) {
    return null
  }

  return (
    <>
      <div className={styles.PanelButtonContainer}>
        <button className={styles.PanelButton} onClick={() => toggleTutorialPanel()}>
          <HelpIcon16 />
          <div className={styles.PanelButtonText}>
            <p className={styles.PanelButtonTextTitle}>{t(($) => $.tutorialWidget.tutorialPanelButtonText)}</p>
            <p className={styles.PanelButtonTextDescription}>
              {t(($) => $.tutorialWidget.tutorialPanelButtonDescription)}
            </p>
          </div>
          <OpenModalIcon />
        </button>
      </div>
    </>
  )
}

interface SlideInPanelProps {
  children: ReactNode
}

export default function SlideInPanel({ children }: SlideInPanelProps) {
  const isOpen = isTutorialPanelOpenSignal.value

  useEffect(() => {
    if (isOpen) {
      document.documentElement.classList.add("tutorial-panel-open")
    } else {
      document.documentElement.classList.remove("tutorial-panel-open")
    }
    return () => {
      document.documentElement.classList.remove("tutorial-panel-open")
    }
  }, [isOpen])

  return (
    <div className={`${styles.TutorialPanel} ${isOpen ? styles.Open : ""}`}>
      <div className={styles.SlideInPanelContent}>{children}</div>
    </div>
  )
}
