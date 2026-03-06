import type { Child, FormaElement, Properties, Urn } from "@spacemakerai/element-types"

import { Matrix4 } from "three"
import { getDuplicateActions } from "src/integrations/tools-common/CopyPasteDuplicate/actions"
import { getAffineActions } from "./affineActions"
import { traverseDepthFirstIterableWithCallback } from "src/lib/element/traverseUtils"
import type { InternalPath } from "src/lib/element/path"

import type { Action } from "src/core/legacy-actions"
import { partialTrackingDataForSelectionSignal } from "src/core/selection/analytics-utils"
import type { MoveScriptRequest } from "src/integrations/elements-capabilities/updateTransform"
import { elementHasUpdateTransformCapability } from "src/integrations/elements-capabilities/updateTransform"
import { capabilityScriptsRegistry } from "src/integrations/elements-capabilities/registry"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback } from "preact/compat"
import { isDefined } from "src/lib/array"
import { applyTransform } from "src/lib/three/geometryUtils"
import { computed, useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { contextRootSignal, selectedNodesSignal } from "src/core/selection/selectionState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function getPathToChild(getElement: (urn: Urn) => FormaElement, rootUrn: Urn) {
  const children: Record<InternalPath, Child> = {}
  for (let [child, path] of traverseDepthFirstIterableWithCallback(rootUrn, getElement)) {
    children[path] = child
  }
  return children
}

const pathToChildSignal = computed(() => {
  const snapshot = elementState.currentSnapshot.value
  const root = elementState.currentSnapshot.value.rootUrn
  return getPathToChild((urn: Urn) => snapshot.getFormaElementOrThrow(urn), root)
})

export function useApplyAffine() {
  const partialTrackingData = partialTrackingDataForSelectionSignal.value
  const terrain = terrainSignal.value

  const proposal = elementState.currentProposalSignal.value
  const actionAPI = useActionAPI()
  const contextRoot = contextRootSignal.value

  const [selectionToMoveWithDefaultCapability, selectionToMoveWithElementCapability] = useComputed(() => {
    return selectedNodesSignal.value.reduce(
      (acc, node) => {
        const element = node.element
        if (element && elementHasUpdateTransformCapability(element)) {
          acc[1].push(node.path)
        } else {
          acc[0].push(node.path)
        }
        return acc
      },
      [[], []] as [InternalPath[], InternalPath[]],
    )
  }).value

  const defaultDuplicateCapability = useCallback(
    async (selectedIds: InternalPath[]) => {
      const pathToChild = pathToChildSignal.peek()
      const children = [...selectedIds].map((path) => pathToChild[path])
      return getDuplicateActions(children, actionAPI, proposal, contextRoot)
    },
    [actionAPI, contextRoot, proposal],
  )

  const defaultMoveCapability = useCallback((selectedIds: InternalPath[], affineMatrix: Matrix4) => {
    return getAffineActions(affineMatrix, selectedIds)
  }, [])

  const updateTransformCapability = useCallback(
    (toMove: InternalPath[], affineMatrix: Matrix4) => {
      return toMove
        .flatMap((path) => {
          const node = proposal.snapshot.getNode(path)
          if (!node) return []
          if (!elementHasUpdateTransformCapability(node.element)) return []
          const prevChild = node.child
          const globalParentMatrix = node.parentMatrix
          const prevChildMatrix = prevChild.transform ? new Matrix4().fromArray(prevChild.transform) : new Matrix4()
          const newChildMatrix = applyTransform(globalParentMatrix, prevChildMatrix, affineMatrix)

          const newWorldTransform = globalParentMatrix.clone().multiply(newChildMatrix)

          const request: MoveScriptRequest = {
            urn: node.urn,
            proposal,
            terrain,
            transform: newWorldTransform.toArray(),
          }
          const script =
            capabilityScriptsRegistry.updateTransform[node.element.properties.capabilities.updateTransform.script.url]
          const functionToCall = script[node.element.properties.capabilities.updateTransform.script.function]
          const response = functionToCall(request)
          if (!response) return []
          return actionAPI.update.subTree(
            path,
            response.rootUrn,
            response.elements,
            new Set(),
            response.representations,
            {
              child: {
                transform: response.transform,
              },
            },
          )
        })
        .filter(isDefined)
    },
    [actionAPI.update, proposal, terrain],
  )

  return useCallback(
    async (affineMatrix: Matrix4, duplicateSelection: boolean) => {
      const actions: Action[] = []
      if (selectionToMoveWithDefaultCapability.length > 0) {
        actions.push(...defaultMoveCapability(selectionToMoveWithDefaultCapability, affineMatrix))
      }
      if (selectionToMoveWithElementCapability.length > 0) {
        actions.push(...updateTransformCapability(selectionToMoveWithElementCapability, affineMatrix))
      }
      if (duplicateSelection) {
        actions.push(
          ...(await defaultDuplicateCapability([
            ...selectionToMoveWithDefaultCapability,
            ...selectionToMoveWithElementCapability,
          ])),
        )
      }
      actionAPI.apply("Element - Apply affine", actions, {
        ...partialTrackingData,
        tool: "affine",
        eventType: "update",
      })
    },
    [
      actionAPI,
      defaultDuplicateCapability,
      defaultMoveCapability,
      partialTrackingData,
      selectionToMoveWithDefaultCapability,
      selectionToMoveWithElementCapability,
      updateTransformCapability,
    ],
  )
}

export const useCreateAffineActions = () => {
  return useCallback((affineMatrix: Matrix4, paths: Set<InternalPath>, updatedProperties?: Properties): Action[] => {
    return getAffineActions(affineMatrix, [...paths], updatedProperties)
  }, [])
}
