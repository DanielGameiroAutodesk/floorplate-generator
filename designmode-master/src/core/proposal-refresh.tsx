import type { Urn } from "@spacemakerai/element-types"
import { triggerSave } from "./elements-saving/trigger-save"
import { savePromiseSignal, savingErrorsSignal } from "./elements-saving/state"
import { lastVisitedProposalIdKey, setProposalIdSignalValue, setRevisionSignalValue } from "./proposal"
// eslint-disable-next-line import/no-restricted-paths
import { onExitSiteStudyTool } from "src/integrations/building-systems-site-study/SiteStudyToolState"
import { parseUrn } from "src/lib/element/urn"
import { REVISION_URL_PARAM } from "src/lib/location"
import { isErr } from "./elements-saving/result"
import { IgnoreContext } from "./ignore-context"
import { resetHoveredIdsSignal, resetSelectionSetSignal } from "./selection/selectionState"
import { loadProposal } from "./initialization/proposal"
import { setGlobalErrorSignalValue } from "./global-errors"
import { GeometryAlertsAPI } from "./geometry-alerts"
import { explicitSignal } from "src/lib/signal"
import { exitCurrentTool } from "./toolsState"
import { canEditProposalSignal } from "./edit-access-state"
import { batch } from "@preact/signals"

const [isLoadingNewProposalSignal, setIsLoadingNewProposalSignalValue] = explicitSignal(false)

export { isLoadingNewProposalSignal }

function resetApplicationState() {
  resetHoveredIdsSignal()
  resetSelectionSetSignal()
  IgnoreContext.reset()
  onExitSiteStudyTool()
  exitCurrentTool()
  GeometryAlertsAPI.reset()
}

/*
Also used when changing revisions

  When changing proposals we want to
  - NOT do a full page reload
  - Exit all tools
  - Clear undo/redo history
  - Clear selection
  - Clear explore tools
*/
export async function changeProposal(proposalUrn: Urn, revision?: string) {
  setIsLoadingNewProposalSignalValue(true)
  const saveErrors = savingErrorsSignal.peek()
  const savePromise = savePromiseSignal.peek()
  const proposalId = parseUrn(proposalUrn).id

  if (saveErrors.length) return
  if (savePromise !== undefined) {
    const r = await savePromise
    if (isErr(r)) return
  }
  try {
    window.globalLoadingOverlay.start()
    if (canEditProposalSignal.peek()) {
      await triggerSave()
    }
    const url = window.location.pathname
    const parts = url.split("/")
    parts.pop()
    parts.push(proposalId)
    sessionStorage.setItem(lastVisitedProposalIdKey, proposalId)

    const searchParams = new URLSearchParams(window.location.search)
    searchParams.delete(REVISION_URL_PARAM)

    let promise: Promise<unknown>

    batch(() => {
      setRevisionSignalValue(revision)
      if (revision) {
        searchParams.append(REVISION_URL_PARAM, revision)
      }

      const newUrl = `${parts.join("/")}?${searchParams.toString()}`
      window.history.pushState(null, "", newUrl)

      resetApplicationState()
      setProposalIdSignalValue(proposalId)

      // Calling loadProposal in the batch will ensure we get a promise
      // to the load operation, which would otherwise be triggered by the
      // effect handling and conflict with globalLoadingOverlay and be
      // more complicated to await for completeness.
      promise = loadProposal(proposalId, revision)
    })

    await promise!
  } catch (e: any) {
    setGlobalErrorSignalValue(e instanceof Error ? e : new Error("Changing proposal failed", { cause: e }))
    return
  } finally {
    window.globalLoadingOverlay.stop()
    setIsLoadingNewProposalSignalValue(false)
  }
}

export async function changeProposalPageReload(proposalUrn: Urn, revision?: string) {
  setIsLoadingNewProposalSignalValue(true)
  const saveErrors = savingErrorsSignal.peek()
  const savePromise = savePromiseSignal.peek()
  const proposalId = parseUrn(proposalUrn).id

  if (saveErrors.length) return
  if (savePromise !== undefined) {
    const r = await savePromise
    if (isErr(r)) return
  }
  try {
    window.globalLoadingOverlay.start()
    if (canEditProposalSignal.peek()) {
      await triggerSave()
    }
    const url = window.location.pathname
    const parts = url.split("/")
    parts.pop()
    parts.push(proposalId)
    sessionStorage.setItem(lastVisitedProposalIdKey, proposalId)

    const searchParams = new URLSearchParams(window.location.search)
    searchParams.delete(REVISION_URL_PARAM)

    if (revision) searchParams.append(REVISION_URL_PARAM, revision)
    const newUrl = `${parts.join("/")}?${searchParams.toString()}`

    window.location.href = newUrl
  } catch {
    window.globalLoadingOverlay.stop()
    return
  } finally {
    setIsLoadingNewProposalSignalValue(false)
  }
}
