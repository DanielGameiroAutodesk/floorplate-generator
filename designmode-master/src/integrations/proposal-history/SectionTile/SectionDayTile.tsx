import RevisionTile from "src/integrations/proposal-history/RevisionTile/RevisionTile"
import MoreRevisions from "src/integrations/proposal-history/MoreRevisions/MoreRevisions"
import type { Revision } from "src/integrations/proposal-history/utils/identifyPeriodsAlgorithm"
import { useEffect, useMemo, useState } from "preact/hooks"
import { parseUrn } from "src/lib/element/urn"
import styles from "./SectionDayTile.module.pcss"
import combineClasses from "src/lib/combineClasses"
import Chevron from "./Chevron/Chevron"
import { analyzedRevisionsState, pinsAsSetState } from "src/integrations/proposal-history/proposal-history-state"
import { useRecoilValue } from "recoil"
import { PinIcon } from "src/integrations/proposal-history/RevisionTile/RevisionButtons/PinButton"
import { revisionSignal } from "src/core/proposal"

type Props = {
  periodsForDay: Revision[][]
  first?: boolean
  last?: boolean
}

export default function SectionDayTile({ periodsForDay, first, last }: Props) {
  const [open, setOpen] = useState(false)
  const analyzedRevisions = useRecoilValue(analyzedRevisionsState)
  const pinnedRevisionsSet = useRecoilValue(pinsAsSetState)

  const revision = revisionSignal.value

  // Opens the section automatically if the current revision is in it
  useEffect(() => {
    const dayHasOpenedRevision = periodsForDay.flat().some((r) => parseUrn(r.urn).revision === revision)
    const hasAnalysesAtDay = periodsForDay
      .flat()
      .some((r) =>
        analyzedRevisions.some(
          (analyzed) => analyzed.elementUrn === r.urn && ["SUCCEEDED", "INVALIDATED"].includes(analyzed.status),
        ),
      )

    setOpen(dayHasOpenedRevision || hasAnalysesAtDay)
  }, [analyzedRevisions, periodsForDay, revision])

  const getTime = () => {
    // We should remove any revisions without a time from the period, but just in case,
    // there revisions without time property, return "No date" as a fallback
    if (periodsForDay[0][0]?.time) {
      return new Date(periodsForDay[0][0]?.time).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    }
    return "No date"
  }

  const numberOfPins = useMemo(
    () =>
      periodsForDay.flatMap((period) =>
        period.filter((revision) => pinnedRevisionsSet.has(parseUrn(revision.urn).revision)),
      ).length,
    [pinnedRevisionsSet, periodsForDay],
  )

  return (
    <div className={styles.SectionTileWrapper}>
      <div
        className={combineClasses([styles.SectionTile], {
          [styles.SectionTileOpen]: open,
          [styles.Last]: !!last && !open,
        })}
        key={periodsForDay[0][0].day}
        onClick={() => setOpen(!open)}
      >
        <div className={styles.SectionHeader}>{getTime()}</div>
        <div className={styles.Wrapper}>
          {numberOfPins > 0 && (
            <div className={styles.NumberOfPinned}>
              <span>{numberOfPins}</span>
              <PinIcon />
            </div>
          )}
          <div className={styles.Chevron}>
            <Chevron open={open} />
          </div>
        </div>
      </div>
      {open && (
        <>
          {periodsForDay.map((period, i) => (
            <>
              <RevisionTile
                revision={period[0]}
                key={period[0].urn}
                first={first}
                last={last && i === periodsForDay.length - 1}
              />
              <MoreRevisions revisions={period.slice(1)} key={period[0].urn + "1"} />
            </>
          ))}
        </>
      )}
    </div>
  )
}
