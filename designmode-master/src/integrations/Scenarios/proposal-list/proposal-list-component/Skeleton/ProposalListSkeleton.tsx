import { ProviderLoadingSkeleton } from "./ProviderLoadingSkeleton"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"
import { useTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

export function FormaProposalListSkeleton() {
  const t = useTranslator()
  return (
    <>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <h2 className={styles.proposalHeader}>{t(($) => $.proposalList.headerText)}</h2>
        </div>

        <ProviderLoadingSkeleton />
      </div>
    </>
  )
}
