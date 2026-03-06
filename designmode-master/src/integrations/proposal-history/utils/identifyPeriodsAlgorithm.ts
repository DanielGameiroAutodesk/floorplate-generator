import type { Urn } from "@spacemakerai/element-types"
import type { User } from "src/lib/users"

export type RevisionPeriod = Revision[]

export type Revision = {
  urn: Urn
  time?: number
  day?: number
  user?: User
  name?: string
}

/**
 Splits all revisions into periods.

 The revisions are returned from the backend descending, and thus processed by newest revision first. We identify
 periods by the following heuristic: Compare the date of the revision being processed with the date of the last revision
 (last in time, first in list) of the current period, creating a new period whenever the difference exceeds some
 threshold. This heuristic captures all revisions
 */

// const MAX_NUM_PERIODS = 17
const INTERVAL = 1000 * 60 * 5 // 5 minutes

export default function identifyPeriodsAlgorithm(
  revisions: Revision[],
  analyzedRevisions: {
    elementUrn?: Urn
  }[],
): RevisionPeriod[] {
  return revisions.reduce((periods: RevisionPeriod[], revision: Revision) => {
    if (periods.length === 0) {
      return [[revision]]
    }

    const currentPeriod = periods[periods.length - 1]
    const lastRevision = currentPeriod[0]
    // const previousRevision = currentPeriod[currentPeriod.length - 1] // alternatively compare to the previous revision,
    // to create new periods only when there's a pause of activity that excees the INTERVAL threshold

    // time can be undefined for some the first revision of some old proposals because of missing metadata. In that case, just use 0 for this comparison.
    const timeDiff = (lastRevision.time ?? 0) - (revision.time ?? 0)

    if (
      analyzedRevisions.some((analyzed) => revision.urn === analyzed.elementUrn) ||
      timeDiff >= INTERVAL
      //Now lists ALL periods, not just the first MAX_NUM_PERIODS. Maybe filter could be applied here somehow with a max/min date instead?
      //&& periods.length < MAX_NUM_PERIODS
    ) {
      periods.push([])
    }

    periods[periods.length - 1].push(revision)
    return periods
  }, [])
}
