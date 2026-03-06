import { atom, useRecoilState } from "recoil"
import { resetContextRootSignal, resetSelectionSetSignal, scenarioModeSignal } from "src/core/selection/selectionState"
import { parseUrn } from "src/lib/element/urn"
import styles from "./EditBase.module.pcss"
import { useCallback, useEffect } from "preact/compat"
import { request } from "src/lib/request"
import { useTranslator } from "src/i18n"
import SubMode from "src/lib/components/SubMode/SubMode"
import { PendingOperationBlockingOverlay } from "src/integrations/PendingOperation/PendingOperationBlockingOverlay"
import type { FormaElement } from "@spacemakerai/element-types"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"

const affectedProposalsCountState = atom<number | undefined>({ key: "affected-proposal-count", default: undefined })

function useCount(baseElement?: FormaElement) {
  const rootElementContainer = useComputed(() => {
    const snapshot = elementState.currentSnapshot.value
    return snapshot.rootNode.elementContainer
  }).value

  const rootUrn = rootElementContainer.element.urn
  const isProposalUpdatedWithNewScenarioOnServer = rootElementContainer.isServerState
  const [count, setCount] = useRecoilState(affectedProposalsCountState)

  useEffect(() => {
    const parsedFormaElementUrn = baseElement && parseUrn(baseElement.urn)
    const url =
      parsedFormaElementUrn &&
      `/api/proposal/elements/count/${parsedFormaElementUrn.id}?authcontext=${parsedFormaElementUrn.authcontext}`
    function call() {
      if (!isProposalUpdatedWithNewScenarioOnServer || !url) {
        return
      }
      request(url)
        .then((res) => res.json())
        .then((res) => setCount(res))
        .catch(() => {})
    }
    call()
  }, [baseElement, rootUrn, isProposalUpdatedWithNewScenarioOnServer, setCount])
  return count
}

function EditBase() {
  const t = useTranslator()
  const baseElement = elementState.currentBaseSignal.value.element
  const count = useCount(baseElement)

  const scenarioMode = scenarioModeSignal.value

  const currentToolId = toolAPI.currentToolSignal.value.id

  const backToProposal = useCallback(() => {
    resetContextRootSignal()
    resetSelectionSetSignal()
    exitCurrentTool()
  }, [])

  // for georef/terrain placemode, we don't want to show the edit base SubMode.
  // georeferenced elements are always placed in base, and terrain elements are always placed in proposal.
  // so the SubMode is not needed anyway, and it also overlaps with the placemode toolbar.
  // TODO: is there a better way to make this exception?
  if (currentToolId === "placeMode:georef" || currentToolId === "placeMode:terrain") return null

  if (!scenarioMode) return null

  return (
    <SubMode mode={"base"}>
      <span>
        {t(($) => $.base.editing.title)} <strong>{baseElement?.properties?.name}</strong>.{" "}
        {count !== undefined && (
          <>
            {t(($) => $.base.editing.changesWillAffect)} <strong>{count}</strong> {t(($) => $.base.editing.proposals)}.
          </>
        )}
      </span>
      <PendingOperationBlockingOverlay description={(t) => t(($) => $.tools.pendingBaseProposalSwitchBlockedMessage)}>
        <weave-button
          className={styles.DoneButton}
          onClick={backToProposal}
          variant={"white"}
          data-tutorial-target="done-button"
        >
          {t(($) => $.base.editBaseDoneButton)}
        </weave-button>
      </PendingOperationBlockingOverlay>
    </SubMode>
  )
}

export default EditBase
