import { useEffect } from "preact/hooks"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import { conceptualElementsApi } from "src/integrations/conceptual-squad/conceptualElementsApi"
import { getTranslator } from "src/i18n"

export function DetectAndRepair3DSCorruptedElements() {
  useEffect(() => {
    // don't trigger repair on historical proposals - can't edit anyway
    const searchParams = new URLSearchParams(window.location.search)
    const isHistoricalProposal = searchParams.get("revision") !== null
    if (isHistoricalProposal) {
      return
    }

    const nodesToRepair: ChildNodeContainer[] = []
    const snapshot = elementState.currentSnapshot.peek()
    snapshot.traverseNodes(snapshot.rootNode, (node: ChildNodeContainer) => {
      if (conceptualElementsApi.isElement3DSCorrupted(node.elementContainer)) {
        nodesToRepair.push(node)
        return false
      } else if (node.element.properties?.category === "group") {
        return true
      } else if (node.path === "root") {
        return true
      }
      return false
    })

    if (nodesToRepair.length === 0) {
      return
    }

    elementState.edit(({ removeElement }) => {
      for (const node of nodesToRepair) {
        removeElement(node.context, node.child.key)
      }
    })

    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.wsm.dialogs.corruptedElementsDeleted),
      status: "warning",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementState.currentProposalIdSignal.value])

  return null
}
