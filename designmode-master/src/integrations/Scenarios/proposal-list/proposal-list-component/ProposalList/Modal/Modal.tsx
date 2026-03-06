import { useState } from "preact/hooks"

import styles from "./Modal.module.css"
import { useTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

export function Modal() {
  const t = useTranslator()
  const [hide, setHide] = useState(false)

  return (
    <div
      className={styles.modal}
      style={{
        display: hide ? "none" : "block",
      }}
    >
      <div className={styles.modal_header}>
        <div className={styles.modal_title}>
          <div>{t(($) => $.exportModal.title)}</div>
          <button className={styles.modal_title_x_btn} onClick={() => setHide(true)}>
            <weave-close />
          </button>
        </div>
        <div className={styles.modal_content}>
          <weave-progress-bar />
          <p>{t(($) => $.exportModal.exportingMessage)}</p>
        </div>
      </div>
    </div>
  )
}
