import type { ProposalElement } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/types"
import { useState } from "preact/hooks"
import styles from "src/integrations/Scenarios/proposal-list/proposal-list-component/styles/index.module.css"
import { Thumbnail } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/Thumbnail/Thumbnail"
import { useTranslator } from "src/integrations/Scenarios/proposal-list/proposal-list-component/i18n"

const MIN_PROPOSALS_TO_COMPARE = 2
const MAX_PROPOSALS_TO_COMPARE = 6

interface CompareButtonProps {
  projectId: string
  proposals: ProposalElement[]
  selectedProposalUrn: string | undefined
}

function CompareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.5 9C6.32843 9 7 9.67157 7 10.5L7 13.5C7 14.3284 6.32843 15 5.5 15H2.5C1.67157 15 1 14.3284 1 13.5L1 10.5C1 9.67157 1.67157 9 2.5 9H5.5ZM13.5 9C14.3284 9 15 9.67157 15 10.5V13.5C15 14.3284 14.3284 15 13.5 15H10.5C9.67157 15 9 14.3284 9 13.5L9 10.5C9 9.67157 9.67157 9 10.5 9H13.5ZM2.5 10C2.22386 10 2 10.2239 2 10.5L2 13.5C2 13.7761 2.22386 14 2.5 14H5.5C5.77614 14 6 13.7761 6 13.5L6 10.5C6 10.2239 5.77614 10 5.5 10H2.5ZM10.5 10C10.2239 10 10 10.2239 10 10.5V13.5C10 13.7761 10.2239 14 10.5 14H13.5C13.7761 14 14 13.7761 14 13.5V10.5C14 10.2239 13.7761 10 13.5 10H10.5ZM5.5 1C6.32843 1 7 1.67157 7 2.5L7 5.5C7 6.32843 6.32843 7 5.5 7L2.5 7C1.67157 7 1 6.32843 1 5.5L1 2.5C1 1.67157 1.67157 1 2.5 1L5.5 1ZM13.5 1C14.3284 1 15 1.67157 15 2.5V5.5C15 6.32843 14.3284 7 13.5 7L10.5 7C9.67157 7 9 6.32843 9 5.5V2.5C9 1.67157 9.67157 1 10.5 1L13.5 1ZM2.5 2C2.22386 2 2 2.22386 2 2.5L2 5.5C2 5.77614 2.22386 6 2.5 6L5.5 6C5.77614 6 6 5.77614 6 5.5L6 2.5C6 2.22386 5.77614 2 5.5 2L2.5 2ZM10.998 2.99805L10 2.99805V4L10.998 4V4.99805L10 4.99805V5.5C10 5.77614 10.2239 6 10.5 6L13.5 6C13.5069 6 13.5137 5.99832 13.5205 5.99805H13V5H13.998V5.51953C13.9983 5.51303 14 5.50656 14 5.5V2.5C14 2.22386 13.7761 2 13.5 2H12.998V2.99805L12 2.99805V2H10.998V2.99805ZM11.998 5.99805L11 5.99805V5L11.998 5V5.99805ZM12.998 4.99805H12V4H12.998V4.99805ZM11.998 3.99805H11V3H11.998V3.99805ZM13.998 3.99805L13 3.99805V3L13.998 3V3.99805Z"
        fill="#808080"
      />
    </svg>
  )
}
function LeftArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.2876 4.38738C10.4879 4.5775 10.4961 4.89397 10.306 5.09424L7.07283 8.5L10.306 11.9058C10.4961 12.106 10.4879 12.4225 10.2876 12.6126C10.0873 12.8027 9.77086 12.7945 9.58074 12.5942L6.02078 8.84424C5.83761 8.6513 5.83761 8.3487 6.02078 8.15575L9.58074 4.40575C9.77086 4.20548 10.0873 4.19726 10.2876 4.38738Z"
        fill="#808080"
      />
    </svg>
  )
}

export function LeftArrowButton({ onClick }: { onClick: () => void }) {
  return (
    <weave-icon-button onClick={onClick}>
      <LeftArrowIcon />
    </weave-icon-button>
  )
}

export function CompareButton({
  onClick,
  tooltipText,
  disabled,
}: {
  onClick: () => void
  tooltipText: string
  disabled: boolean
}) {
  return (
    <weave-tooltip nub="down-center" text={tooltipText}>
      <weave-icon-button onClick={onClick} disabled={disabled}>
        <CompareIcon />
      </weave-icon-button>
    </weave-tooltip>
  )
}

export default function ProposalSelector({ projectId, proposals, selectedProposalUrn }: CompareButtonProps) {
  const t = useTranslator()
  const [selectedUrns, setSelectedUrns] = useState<string[]>(selectedProposalUrn ? [selectedProposalUrn] : [])
  const openCompare = () => {
    const querystring = selectedUrns.reduce((acc, urn) => {
      return acc.concat(`area-metrics/${urn}/${urn}`)
    }, [] as string[])
    window.location.assign(`/visual-compare/${projectId}?compare=${querystring.join(",")}&source=proposal-list`)
  }

  const tooltipText = () => {
    if (selectedUrns.length < MIN_PROPOSALS_TO_COMPARE)
      return t(($) => $.compareMode.minProposalsWarning, { min: MIN_PROPOSALS_TO_COMPARE })
    else if (selectedUrns.length > MAX_PROPOSALS_TO_COMPARE)
      return t(($) => $.compareMode.maxProposalsWarning, { max: MAX_PROPOSALS_TO_COMPARE })
    return ""
  }

  return (
    <>
      <weave-tooltip nub="down-center" text={tooltipText()}>
        <weave-button
          disabled={selectedUrns.length < MIN_PROPOSALS_TO_COMPARE || selectedUrns.length > MAX_PROPOSALS_TO_COMPARE}
          variant="solid"
          density="medium"
          onClick={openCompare}
          class={styles.compareButton}
        >
          <CompareIcon />
          <div style={{ paddingLeft: "6px" }}>{t(($) => $.compareMode.buttonLabel)}</div>
        </weave-button>
      </weave-tooltip>
      <div className={styles.compareProposalListContainer}>
        {proposals.map((proposal) => (
          <ProposalVisual
            key={proposal.urn}
            onClick={() => {
              if (selectedUrns.includes(proposal.urn))
                setSelectedUrns(selectedUrns.filter((urn) => urn !== proposal.urn))
              else setSelectedUrns(selectedUrns.concat([proposal.urn]))
            }}
            proposal={proposal}
            isActive={selectedUrns.includes(proposal.urn)}
          />
        ))}
      </div>
    </>
  )
}

function ProposalVisual({
  onClick,
  proposal,
  isActive,
}: {
  onClick: () => void
  proposal: ProposalElement
  isActive: boolean
}) {
  return (
    <weave-tile
      className={styles.proposal}
      data-proposal-urn={proposal.urn}
      onClick={onClick}
      variant="horizontal"
      height={80}
      selected={isActive}
    >
      <div slot="image" className={styles.thumbnailWrapper}>
        <Thumbnail urn={proposal.urn} />
      </div>
      <>
        <weave-tooltip slot="title" nub="down-center" text={proposal.properties?.name || ""} className={styles.tooltip}>
          <div className={styles.title}>{proposal.properties?.name}</div>
        </weave-tooltip>
      </>
      {proposal.metadata?.createdAt ? (
        <weave-timestamp slot="description" timestamp={proposal.metadata.createdAt} />
      ) : (
        <></>
      )}
    </weave-tile>
  )
}
