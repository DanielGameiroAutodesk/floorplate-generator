import type { Revision } from "src/integrations/proposal-history/utils/identifyPeriodsAlgorithm"
import { useEffect, useState } from "preact/hooks"
import styles from "./MoreRevisions.module.pcss"
import RevisionTile from "src/integrations/proposal-history/RevisionTile/RevisionTile"
import combineClasses from "src/lib/combineClasses"
import { parseUrn } from "src/lib/element/urn"
import VerticalThreeDotIcon from "src/lib/components/icons/VerticalThreeDotIcon/VerticalThreeDotIcon"
import { revisionSignal } from "src/core/proposal"

export default function MoreRevisions({ revisions }: { revisions: Revision[] }) {
  const [open, setOpen] = useState(false)
  const revision = revisionSignal.value

  // Opens the section automatically if the current revision is in it
  useEffect(() => {
    if (revisions.some((r) => parseUrn(r.urn).revision === revision)) {
      setOpen(true)
    }
  }, [revision, revisions])

  if (!revisions.length) return null

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        className={combineClasses([styles.MoreRevisions], { [styles.MoreRevisionsOpen]: open })}
      >
        {open && (
          <>
            {revisions.map((revision) => (
              <RevisionTile revision={revision} key={revision.urn} />
            ))}
          </>
        )}
        <div className={styles.MoreHeader}>
          <VerticalThreeDotIcon />
          <span className={styles.MoreText}>{`Show ${open ? "less" : "more"}`}</span>
        </div>
      </div>
    </div>
  )
}
