import { useMemo } from "preact/hooks"
import type { ParcelCompositionElement } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import { isParcelComposition } from "src/integrations/composition-site-graph-parcel/parcelElementApi"
import type { CompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { isCompositionElement } from "src/integrations/composition-site-graph/graph-element/types"
import { EditCompositionPanel } from "./CompositionPanel"
import { EditParcelCompositionPanel } from "./ParcelCompositionPanel"
import type { InternalPath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"
import { selectedNodesSignal } from "src/core/selection/selectionState"

export function SelectedRowHouses() {
  const selectedNodes = selectedNodesSignal.value
  const proposal = elementState.currentProposalSignal.value

  const pathElements = useMemo(
    () =>
      selectedNodes
        .map((node) => ({ path: node.path, element: node.element }))
        .filter((pathElement): pathElement is { path: InternalPath; element: CompositionElement } =>
          isCompositionElement(pathElement.element),
        ),
    [selectedNodes],
  )

  const path = selectedNodes[0]?.path

  const compositionElement = useMemo(() => {
    if (!path) return undefined
    const element = proposal.snapshot.getNode(path)?.element
    if (!isCompositionElement(element)) return undefined
    return element
  }, [path, proposal.snapshot])

  const parcelElements = useMemo(() => {
    return selectedNodes
      .map((node) => ({ path: node.path, element: node.element }))
      .filter(({ element }) => isParcelComposition(element)) as {
      element: ParcelCompositionElement
      path: InternalPath
    }[]
  }, [selectedNodes])

  if (compositionElement && path) {
    return <EditCompositionPanel compositionElements={pathElements} />
  }
  if (parcelElements.length > 0) {
    return <EditParcelCompositionPanel parcelElements={parcelElements} />
  }
  return null
}
