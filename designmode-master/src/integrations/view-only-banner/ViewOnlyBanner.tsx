import styles from "./styles.module.css"
import { VisibleEyeIcon } from "./VisibleEyeIcon"
import { revisionSignal } from "src/core/proposal"
import { proposalIsLoadingSignal } from "src/core/initialization/proposal"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { useTranslator } from "src/i18n"

const TimeStamp = ({ timestamp }: { timestamp: string }) => {
  const date = new Date(parseInt(timestamp))
  const formattedTimestamp = date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  return <div className={styles.timestamp}>{formattedTimestamp}</div>
}

export const ViewOnlyBanner = () => {
  const t = useTranslator()

  if (revisionSignal.value) {
    return (
      <div className={styles.viewModeBanner}>
        <VisibleEyeIcon /> <span>{t(($) => $.proposalHistory.viewingVersionLabel)}: &nbsp;</span>{" "}
        <TimeStamp timestamp={revisionSignal.value} />
      </div>
    )
  }

  // TODO: Should we show some kind of indicator while proposal is loading?
  return !canEditProposalSignal.value && !proposalIsLoadingSignal.value ? (
    <div className={styles.viewModeBanner}>{t(($) => $.viewOnlyBanner.accessMessage)}</div>
  ) : null
}
