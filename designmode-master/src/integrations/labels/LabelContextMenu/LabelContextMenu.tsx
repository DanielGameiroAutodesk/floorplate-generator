import { useMemo } from "react"
import { ANNOTATION_LABEL_CATEGORY } from "src/integrations/labels/constants"
import useMoveLabels from "./useMoveLabels"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import { useTranslator } from "src/i18n"

export default function LabelContextMenu() {
  const t = useTranslator()
  const selectedNodes = selectedNodesSignal.value
  const moveLabels = useMoveLabels()

  const allSelectedElementsAreLabels = useMemo(
    () => selectedNodes.every((node) => node.element.properties?.category === ANNOTATION_LABEL_CATEGORY),
    [selectedNodes],
  )

  if (selectedNodes.length !== 1 || !allSelectedElementsAreLabels) return null

  return (
    <>
      <forma-context-menu-item
        // TODO(l10n): Change to a non-concatenated string.
        text={`${t(($) => $.transform.move.name)} ${t(($) => $.properties.position).toLowerCase()}`}
        onClick={moveLabels}
        disabled={!canEditProposalSignal.value}
      />
      <forma-context-menu-divider />
    </>
  )
}
