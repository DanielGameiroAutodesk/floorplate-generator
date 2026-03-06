import { notPersistedContainersSignal, savingErrorsSignal } from "./state.internal"
import { useCallback, useLayoutEffect, useState } from "preact/hooks"
import { parseUrn } from "src/lib/element/urn"
import type { FormaElement } from "@spacemakerai/element-types"
import type { WeaveModalElement } from "src/lib/type-declarations/forma-declarations"
import { useTranslator } from "src/i18n"
import { elementState } from "src/core/elements/ElementState"

type SavingModalProps = {
  createNewProposal: (element: FormaElement, authcontext: string) => Promise<FormaElement>
}

export function SavingConflictModal({ createNewProposal }: SavingModalProps) {
  const t = useTranslator()
  const notPersisted = notPersistedContainersSignal.value
  const savingErrors = savingErrorsSignal.value

  const [modal, setModal] = useState<WeaveModalElement | null>(null)
  useLayoutEffect(() => {
    if (!modal) return
    modal.show()
    function stopPropagation(e: Event) {
      e.stopImmediatePropagation()
    }
    window.addEventListener("keydown", stopPropagation, { capture: true })
    return () => window.removeEventListener("keydown", stopPropagation)
  }, [modal])

  const branch = useCallback(() => {
    async function run() {
      const proposal = notPersisted.find((el) => parseUrn(el.urn).system === "proposal")
      if (!proposal) throw new Error("couldn't find proposal in not-persisted elements")
      const parsed = parseUrn(proposal.urn)

      const proposalElement = elementState.currentProposalSignal.peek().element
      const newProposalElement = {
        ...proposalElement,
        properties: {
          ...proposalElement.properties,
          name: proposalElement.properties?.name + " copy",
        },
      }
      const branched = await createNewProposal(newProposalElement, parsed.authcontext)
      const newProposalId = parseUrn(branched.urn).id
      const currentSearch = new URLSearchParams(window.location.search)
      const newPath = window.location.pathname.split("/").slice(0, -1).concat(newProposalId).join("/")
      window.location.href = `${window.location.origin}${newPath}?${currentSearch}`
    }
    void run()
  }, [createNewProposal, notPersisted])

  // if there is a single saving error with type conflict, it means the proposal had a conflict while saving.
  if (savingErrors.length === 1 && savingErrors.every((e) => e.type === "CONFLICT")) {
    return (
      <weave-modal ref={setModal} hideclose>
        <div slot="title" style={{ padding: 10 }}>
          <h1>{t(($) => $.savingModal.conflict.title)}</h1>
        </div>
        <div slot="content" style={{ padding: 10 }}>
          {t(($) => $.savingModal.conflict.body)}
        </div>
        <div slot="actions" style={{ padding: 10 }}>
          <weave-button onClick={() => window.location.reload()} style={{ marginRight: 10 }}>
            {t(($) => $.savingModal.conflict.discardEdits)}
          </weave-button>
          <weave-button variant="solid" onClick={branch}>
            {t(($) => $.savingModal.conflict.saveAsNew)}
          </weave-button>
        </div>
      </weave-modal>
    )
  }

  // if there are more errors, show a more generic error.
  if (savingErrors.length > 0) {
    return (
      <weave-modal ref={setModal} hideclose>
        <h1 slot="title" style={{ padding: 10 }}>
          {t(($) => $.savingModal.error.title)}
        </h1>
        <p slot="content" style={{ padding: 10 }}>
          {t(($) => $.savingModal.error.body)}
        </p>
        <div slot="actions" style={{ padding: 10 }}>
          <weave-button variant="solid" onClick={() => window.location.reload()}>
            {t(($) => $.savingModal.error.ok)}
          </weave-button>
        </div>
      </weave-modal>
    )
  }

  return null
}
