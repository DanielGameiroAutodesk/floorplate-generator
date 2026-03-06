import type { Revision } from "src/integrations/proposal-history/utils/identifyPeriodsAlgorithm"
import {
  analysesIcons,
  AnalysisInProgressDot,
  formatAnalysisDate,
  getAnalysisURL,
} from "src/integrations/proposal-history/utils/fetchAnalyzedRevisions"
import { useTranslator } from "src/i18n"
import { changeProposal } from "src/core/proposal-refresh"
import { parseUrn } from "src/lib/element/urn"
import styles from "./RevisionTile.module.pcss"
import combineClasses from "src/lib/combineClasses"
import { AnalyticsLegacy } from "src/core/analytics"
import { useRecoilValue } from "recoil"
import type { AnalysisKey } from "src/integrations/proposal-history/proposal-history-state"
import {
  analyzedRevisionsState,
  proposalHistoryFilterState,
  revisionMetadataState,
} from "src/integrations/proposal-history/proposal-history-state"
import { useMemo, useState } from "preact/hooks"
import RevisionButtons from "./RevisionButtons/RevisionButtons"
import { usePinRevisions } from "src/integrations/proposal-history/utils/usePinRevisions"
import TextInput from "src/lib/components/TextInput/TextInput"
import { revisionSignal } from "src/core/proposal"

type Props = { revision: Revision; current?: boolean; first?: boolean; last?: boolean }

export default function RevisionTile({ revision, current, first, last }: Props) {
  const t = useTranslator()
  const analysedRevisions = useRecoilValue(analyzedRevisionsState)

  const { addRevisionMetadata } = usePinRevisions()
  const revisionMetadata = useRecoilValue(revisionMetadataState)
  const filter = useRecoilValue(proposalHistoryFilterState)

  // TODO: If these lookups are becoming slow at many revisions, we could consider using building a map instead that holds all analyses for a given urn.
  const analysesAtRevision = useMemo(() => {
    return analysedRevisions.filter(
      (analysis) => analysis.elementUrn === revision.urn && filter.analysisTypes[analysis.analysisType as AnalysisKey],
    )
  }, [analysedRevisions, filter.analysisTypes, revision.urn])

  const activeRevision = revisionSignal.value

  const selected = useMemo(() => {
    return parseUrn(revision.urn).revision === activeRevision
  }, [activeRevision, revision.urn])

  const metadata = useMemo(() => {
    return revisionMetadata.find((metadata) => metadata.revision === parseUrn(revision.urn).revision)
  }, [revisionMetadata, revision.urn])

  const [isEditingName, setIsEditingName] = useState(false)

  const getTitle = () => {
    if (current) {
      return t(($) => $.proposalHistory.currentVersionLabel)
    } else if (revision.time) {
      return `${new Date(revision.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    } else {
      return t(($) => $.proposalHistory.untitledVersionLabel)
    }
  }

  return (
    <div
      className={combineClasses([styles.Revision], {
        [styles.SelectedRevision]: selected,
        [styles.First]: !!first,
        [styles.Last]: !!last,
      })}
      key={revision.urn}
      onClick={(e) => {
        e.stopPropagation()
        // Don't track this with new tracking schema
        AnalyticsLegacy.track("Proposal history - View old version")
        void changeProposal(revision.urn, parseUrn(revision.urn).revision)
      }}
    >
      <div
        className={combineClasses([styles.TileContent], {
          [styles.First]: !!first,
          [styles.Last]: !!last,
        })}
      >
        <div className={styles.ContentRow}>
          <div>
            {revision.user && (
              <div className={styles.Avatar}>
                <weave-avatar
                  size={"small"}
                  name={`${revision.user.given_name} ${revision.user.family_name}`}
                  image={revision.user.picture}
                  tooltip={`${revision.user.given_name} ${revision.user.family_name}`}
                />
              </div>
            )}
            <div className={styles.TileTitle}>{getTitle()}</div>
          </div>
          <RevisionButtons
            revision={revision}
            revisionMetadata={metadata}
            addRevisionMetadata={addRevisionMetadata}
            onRename={() => setIsEditingName(true)}
          />
        </div>
        {(metadata?.name || isEditingName) && (
          <div className={combineClasses([styles.ContentRow, styles.VersionName])}>
            {!isEditingName && <span>{metadata?.name || ""}</span>}
            {isEditingName && (
              <TextInput
                isSelected
                editAccess
                name="pin-name"
                initialValue={metadata?.name || ""}
                placeholder={t(($) => $.proposalHistory.untitledVersionLabel)}
                onBlur={(newName) => {
                  if (metadata?.name !== newName) addRevisionMetadata(revision.urn, { ...metadata, name: newName })
                  setIsEditingName(false)
                }}
              />
            )}
          </div>
        )}
        {!!analysesAtRevision.length && (
          <div className={combineClasses([styles.ContentRow, styles.Analyses])} onClick={(e) => e.stopPropagation()}>
            {analysesAtRevision.map((analysis) => (
              <weave-tooltip key={analysis.analysisId} text={formatAnalysisTooltipText(analysis)} nub={"down-center"}>
                <a
                  style={{
                    opacity: ["SUCCEEDED", "INVALIDATED"].includes(analysis.status) ? 1 : 0.8,
                    pointerEvents: ["SUCCEEDED", "INVALIDATED"].includes(analysis.status) ? "auto" : "none",
                  }}
                  href={getAnalysisURL(analysis, parseUrn(revision.urn).revision)}
                  onClick={(event) => {
                    // Don't track this with new tracking schema
                    AnalyticsLegacy.track("Proposal history - Open analysis", { analysisType: analysis.analysisType })
                    if (
                      !window.dispatchEvent(
                        new CustomEvent("open-analysis", {
                          cancelable: true,
                          detail: analysis,
                        }),
                      )
                    ) {
                      event.preventDefault()
                    }
                  }}
                >
                  {analysesIcons[analysis.analysisType]}
                  {analysis.status.startsWith("IN_PROGRESS") && <AnalysisInProgressDot />}
                </a>
              </weave-tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatAnalysisTooltipText(analysis: { createdAt: number; status: "SUCCEEDED" | "INVALIDATED" | string }) {
  let text = formatAnalysisDate(analysis.createdAt)
  if (analysis.status === "INVALIDATED") text += " (invalidated)"
  return text
}
