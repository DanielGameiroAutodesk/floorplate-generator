import styles from "./BetaTag.module.pcss"
import { useTranslator } from "src/i18n"

const BetaTag = () => {
  const t = useTranslator()
  return (
    <div className={styles.BetaTag}>
      <h4 className={styles.BetaTagText}>{t(($) => $.ui.beta)}</h4>
    </div>
  )
}

export default BetaTag
