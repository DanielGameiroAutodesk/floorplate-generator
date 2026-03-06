import { PROJECT_ID as PROJECT_ID_CONST } from "src/core/project/project"

// Local storage has a shared limit of 5 MiB, so this code is
// designed to keep the size of the cache small.

const PROPOSAL_ID = "prop"
const PROJECT_ID = "proj"
const TIMESTAMP_CHECKED = "t"
const REVISION = "r"

type CachedDetail = {
  [PROPOSAL_ID]: string
  [PROJECT_ID]: string
  [TIMESTAMP_CHECKED]: number // Date.now()
  [REVISION]: string
}

// Remove previous version if it exists in local storage.
localStorage.removeItem("cachedProposalLatestRevision")

const localStorageKey = "cachedProposalLatestRevisionV2"

function createNotExpiredPredicate() {
  const keepNewerThan = Date.now() - 86400 * 1000 // last 24 hours
  return (it: CachedDetail) => it[TIMESTAMP_CHECKED] > keepNewerThan
}

function loadFromLocalStorage(): CachedDetail[] {
  const item = localStorage.getItem(localStorageKey)
  if (!item) return []

  try {
    const items = JSON.parse(item) as CachedDetail[]

    // Prevent the use of old values.
    return items.filter(createNotExpiredPredicate())
  } catch (e) {
    console.error("Fallback value for cachedRevisionByProposalIds due to error", e)
    return []
  }
}

function saveToLocalStorage(items: CachedDetail[]) {
  localStorage.setItem(localStorageKey, JSON.stringify(items))
}

export function getCachedLatestRevision(proposalId: string): { revision: string } | undefined {
  const items = loadFromLocalStorage()
  const found = items.find((it) => it[PROJECT_ID] === PROJECT_ID_CONST && it[PROPOSAL_ID] === proposalId)
  if (found) {
    return {
      revision: found[REVISION],
    }
  }
  return undefined
}

export function setCachedLatestRevision(proposalId: string, revision: string) {
  const items = [...loadFromLocalStorage()]
    .sort((a, b) => a[TIMESTAMP_CHECKED] - b[TIMESTAMP_CHECKED])
    .filter(createNotExpiredPredicate())
    .filter((it) => it[PROJECT_ID] !== PROJECT_ID_CONST || it[PROPOSAL_ID] !== proposalId)
    .slice(-100)

  items.push({
    [PROPOSAL_ID]: proposalId,
    [PROJECT_ID]: PROJECT_ID_CONST,
    [TIMESTAMP_CHECKED]: Date.now(),
    [REVISION]: revision,
  })

  saveToLocalStorage(items)
}
