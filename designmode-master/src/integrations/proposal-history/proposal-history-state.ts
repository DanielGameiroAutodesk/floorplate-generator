import { atom, selector } from "recoil"
import type { AnalyzedRevision } from "./utils/fetchAnalyzedRevisions"
import type { User } from "src/lib/users"
import type { Revision, RevisionPeriod } from "./utils/identifyPeriodsAlgorithm"
import identifyPeriodsAlgorithm from "./utils/identifyPeriodsAlgorithm"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { RevisionMetadata } from "src/core/proposal-element-system/ProposalClient"
import { parseUrn } from "src/lib/element/urn"
import { getCurrentUserId } from "src/lib/userInfo"
import type { DateParams } from "./HistoryHeader/HistoryFilter/SelectDate/SelectDate"
import { dateParamToTimeStamp } from "./HistoryHeader/HistoryFilter/SelectDate/SelectDate"

type MappedRevision = {
  urn: Urn
  time: number | undefined
  day: number | undefined
  user: User | undefined
  name: string
}

export const baseElementToRevision = ({ elm, users }: { elm: FormaElement; users: User[] }): MappedRevision => ({
  urn: elm.urn,
  time: elm.metadata?.createdAt ? new Date(elm.metadata.createdAt).getTime() : undefined,
  day: elm.metadata?.createdAt ? new Date(elm.metadata.createdAt).setHours(0, 0, 0, 0) : undefined,
  user: users.find((e) => e.user_id === elm.metadata?.createdBy),
  name: elm.properties?.name,
})

export const revisionUsersState = atom<User[]>({ key: "revisionUsersState", default: [] })
export const revisionMetadataState = atom<RevisionMetadata[]>({ key: "revisionMetadataState", default: [] })
export const pinsAsSetState = selector<Set<string>>({
  key: "pinnedRevisionsSetState",
  get: ({ get }) => {
    const pinnedRevisions = get(revisionMetadataState).filter(({ pinnedBy }) => pinnedBy)
    return new Set(pinnedRevisions.map(({ revision }) => revision))
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

// TODO: This should ideally be refetched when a new analysis is fetched!
export const analyzedRevisionsState = atom<AnalyzedRevision[]>({
  key: "analyzedRevisionsState",
  default: [],
})
export const proposalRevisionsState = atom<FormaElement[]>({ key: "proposalRevisionsState", default: [] })

export type AnalysisKey = "wind" | "sun" | "microclimate" | "noise" | "sky-component" | "solar-panel"
type AnalysisTypes = Record<AnalysisKey, boolean>

export type ProposalHistoryFilter = {
  pinned: boolean
  yours: boolean
  analysis: boolean
  analysisTypes: AnalysisTypes
  byDate: boolean
  dateParams: { from: DateParams; to: DateParams } | null
}
export const proposalHistoryFilterState = atom<ProposalHistoryFilter>({
  key: "proposalHistoryFilterState",
  default: {
    pinned: false,
    yours: false,
    analysis: false,
    byDate: false,
    dateParams: null,
    analysisTypes: {
      wind: true,
      sun: true,
      microclimate: true,
      noise: true,
      "sky-component": true,
      "solar-panel": true,
    },
  },
})

export const proposalRevisionsWithMetaDataState = selector<Revision[]>({
  key: "proposalRevisionsWithMetaDataState",
  get: ({ get }) => {
    const revisions = get(proposalRevisionsState)
    const pinsSet = get(pinsAsSetState)
    const analyzedRevisions = get(analyzedRevisionsState)
    const users = get(revisionUsersState)
    const filter = get(proposalHistoryFilterState)
    let mappedRevisions = revisions.map((elm) => baseElementToRevision({ elm, users }))
    if (filter.pinned) {
      mappedRevisions = mappedRevisions.filter((revision) => pinsSet.has(parseUrn(revision.urn).revision))
    }

    if (filter.yours) {
      const currentUserId = getCurrentUserId()
      mappedRevisions = mappedRevisions.filter((revision) => revision.user?.user_id === currentUserId)
    }

    if (filter.analysis) {
      mappedRevisions = mappedRevisions.filter((revision) =>
        analyzedRevisions.some(
          (analyzed) =>
            revision.urn === analyzed.elementUrn && filter.analysisTypes[analyzed.analysisType as AnalysisKey],
        ),
      )
    }

    if (filter.byDate && filter.dateParams) {
      const { to, from } = filter.dateParams
      const toAsTimestamp = new Date(dateParamToTimeStamp(to)).setHours(23)
      const fromAsTimestamp = new Date(dateParamToTimeStamp(from)).setHours(0)

      mappedRevisions = mappedRevisions.filter(
        (revision) => revision.time! >= fromAsTimestamp && revision.time! <= toAsTimestamp,
      )
    }

    return mappedRevisions
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export const DEFAULT_MIN_YEAR = 2021
export const minRevisionDateState = selector({
  key: "minRevisionYearState",
  get: ({ get }) => {
    const revisions = get(proposalRevisionsWithMetaDataState)
    if (!revisions.length) return new Date(DEFAULT_MIN_YEAR, 0, 1)

    return new Date(Math.min(...revisions.map((r) => r.time!)))
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export const maxRevisionDateState = selector({
  key: "maxRevisionDateState",
  get: ({ get }) => {
    const revisions = get(proposalRevisionsWithMetaDataState)
    if (!revisions.length) return new Date()

    return new Date(Math.max(...revisions.map((r) => r.time!)))
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export const periodsByDayState = selector<RevisionPeriod[][]>({
  key: "periodsByDayState",
  get: ({ get }) => {
    const revisionsWithMetaData = get(proposalRevisionsWithMetaDataState)
    const analyzedRevisions = get(analyzedRevisionsState)
    const periods = identifyPeriodsAlgorithm(revisionsWithMetaData, analyzedRevisions)

    return periods.reduce((groupedByDay: RevisionPeriod[][], curr: RevisionPeriod) => {
      const lastGroup = groupedByDay[groupedByDay.length - 1]
      if (lastGroup && lastGroup[0][0].day === curr[0].day) {
        lastGroup.push(curr)
      } else {
        groupedByDay.push([curr])
      }
      return groupedByDay
    }, [])
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})

export const latestRevisionState = atom<Revision | null>({
  key: "currentRevisionState",
  default: null,
})
