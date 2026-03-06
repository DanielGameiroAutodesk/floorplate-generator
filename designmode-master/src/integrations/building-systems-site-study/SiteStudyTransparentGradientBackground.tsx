import styles from "./siteStudyStyles.module.pcss"
import { siteStudySolutionSignal } from "./SiteStudyToolState"

/**
 * This background is added for the Site Study feature, and the place it takes up might in the future be promoted to
 * the Forma grid. Speak with Ensi / Ragnhild / Kjetil about that.
 */

export default function SiteStudyTransparentGradientBackground() {
  const studies = siteStudySolutionSignal.value.siteStudySolutions
  if (Object.values(studies).length === 0) return null
  return <div className={styles.gradientBackground} />
}
