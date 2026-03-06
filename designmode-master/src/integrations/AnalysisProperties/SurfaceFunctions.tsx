import { useCallback } from "preact/hooks"
import { scenarioModeSignal, selectedTopLevelPathsSignal } from "src/core/selection/selectionState"
import { parseUrn, replaceRevision } from "src/lib/element/urn"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { FormaFunctionDropdown, type UnitFunction } from "src/lib/components/FormaFunctionDropdown"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"
import { ElementContainer } from "src/core/elements/ElementContainer"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import {
  basicElementSupportsSurfaceFunctions,
  hasSurfaceFunctionsInternalProperty,
  type FormaElementWithSurfaceFunctionsInternalProperty,
} from "src/integrations/basic-elements/area-stats-surfaces"

function supportsSurfaceFunctions(container: ElementContainer) {
  return parseUrn(container.element.urn).system === "basic" && basicElementSupportsSurfaceFunctions(container)
}

const CUSTOM_SURFACE_FUNCTION_PREFIX = "custom:"
const UNSPECIFIED_SURFACE_FUNCTION_ID = "unspecified"

export const SurfaceFunctions = () => {
  const compatibleToplevelNodeSignal = useComputed<ChildNodeContainer | undefined>(() => {
    const toplevelPaths = selectedTopLevelPathsSignal.value
    if (toplevelPaths.size != 1) return

    const selectedSingleTopLevelPath = toplevelPaths.values().next().value
    if (!selectedSingleTopLevelPath) return

    const snapshot = elementState.currentSnapshot.value
    const node = snapshot.getNode(selectedSingleTopLevelPath)
    if (!node) return

    const container = node.elementContainer
    if (!supportsSurfaceFunctions(container)) return

    return node
  })

  const selectedFunctionsSignal = useComputed(() => {
    const node = compatibleToplevelNodeSignal.value
    if (!node) return []
    const element = node.elementContainer.element
    if (!hasSurfaceFunctionsInternalProperty(element)) return [{ functionId: UNSPECIFIED_SURFACE_FUNCTION_ID }]
    const surfaceFunctionsProp = element.properties.surfaceFunctions_INTERNAL
    return surfaceFunctionsProp.map(({ surfaceFunctionId }) => ({
      functionId: `${CUSTOM_SURFACE_FUNCTION_PREFIX}${surfaceFunctionId}`,
    }))
  })

  const onClick = useCallback(
    (clicked: UnitFunction) => {
      if (!clicked.functionId) return

      const clickedOnUnspecified = clicked.functionId === UNSPECIFIED_SURFACE_FUNCTION_ID
      const clickedSurfaceFunctionId =
        !clickedOnUnspecified && clicked.functionId.startsWith(CUSTOM_SURFACE_FUNCTION_PREFIX)
          ? clicked.functionId.substring(CUSTOM_SURFACE_FUNCTION_PREFIX.length)
          : undefined

      const node = compatibleToplevelNodeSignal.peek()
      if (!node) return

      const oldContainer = node.elementContainer
      const oldElement = oldContainer.element
      const oldSurfaceFunctions = hasSurfaceFunctionsInternalProperty(oldElement)
        ? oldElement.properties.surfaceFunctions_INTERNAL
        : []

      let newSurfaceFunctions = oldSurfaceFunctions
      if (clickedOnUnspecified) {
        newSurfaceFunctions = []
      }
      if (clickedSurfaceFunctionId !== undefined) {
        const alreadyHasClickedSurfaceFunctionId = oldSurfaceFunctions.some(
          ({ surfaceFunctionId }) => surfaceFunctionId === clickedSurfaceFunctionId,
        )
        if (alreadyHasClickedSurfaceFunctionId) {
          newSurfaceFunctions = oldSurfaceFunctions.filter(
            ({ surfaceFunctionId }) => surfaceFunctionId !== clickedSurfaceFunctionId,
          )
        } else {
          newSurfaceFunctions = [...oldSurfaceFunctions, { surfaceFunctionId: clickedSurfaceFunctionId }]
        }
      }

      const newElement: FormaElementWithSurfaceFunctionsInternalProperty = {
        ...oldElement,
        urn: replaceRevision(oldElement.urn),
        properties: { ...oldElement.properties, surfaceFunctions_INTERNAL: newSurfaceFunctions },
      }
      const newContainer = ElementContainer.fromDraftElement(
        newElement,
        oldContainer.children,
        oldContainer.representations,
      )

      const contextRoot = scenarioModeSignal.peek() ? "base" : "proposal"
      elementState.edit(({ updateElement }) => {
        updateElement(contextRoot, { ...node.child, urn: newElement.urn }, newContainer)
      })
    },
    [compatibleToplevelNodeSignal],
  )

  return compatibleToplevelNodeSignal.value ? (
    <FormaFunctionDropdown
      projectId={PROJECT_ID}
      canEdit={canEditProposalSignal.value}
      setBuildingFunction={onClick}
      selectedBuildingFunctions={selectedFunctionsSignal.value}
      functionsType={"surface"}
    />
  ) : null
}
