import { Matrix4 } from "three"
import type { Action } from "src/core/legacy-actions"
import { parseUrn } from "src/lib/element/urn"
import type { Properties } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import type { BasicAction } from "src/integrations/basic-elements/api/types"
import { applyTransform } from "src/lib/three/geometryUtils"
import { elementState } from "src/core/elements/ElementState"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"

export function getAffineActions(
  matrix: Matrix4,
  selectedIds: InternalPath[],
  updatedProperties?: Properties,
): Action[] {
  const currentSnapshot = elementState.currentSnapshot.peek()
  const nodes = selectedIds.map((path) => currentSnapshot.getNodeOrThrow(path))

  const selectedBasicElements = nodes.filter(isBasicElementNode)
  const selectedNonBasicElements = nodes.filter((node) => !isBasicElementNode(node))

  const basicActions = selectedBasicElements.map((node) => {
    const newChildMatrix = getNewChildMatrixForNode(node, matrix)
    return getBasicActionForBasicElement(node, newChildMatrix, updatedProperties)
  })
  const coreActions = selectedNonBasicElements.flatMap((node) => {
    const newChildMatrix = getNewChildMatrixForNode(node, matrix)
    return getCoreActionForNonBasicElement(node, newChildMatrix, updatedProperties)
  })

  const basicActionsMappedToCoreActions = BasicElementAPI.basicActionsToCoreActions(basicActions)
  const allActions = [...basicActionsMappedToCoreActions, ...coreActions]
  return allActions
}

function isBasicElementNode(node: ChildNodeContainer): boolean {
  const urn = parseUrn(node.elementContainer.element.urn)
  return urn.system === "basic"
}

function getNewChildMatrixForNode(node: ChildNodeContainer, matrixFromAffineAction: Matrix4): Matrix4 {
  const globalParentMatrix = node.parentMatrix
  const prevChildMatrix = node.child.transform ? new Matrix4().fromArray(node.child.transform) : new Matrix4()
  return applyTransform(globalParentMatrix, prevChildMatrix, matrixFromAffineAction)
}

function getBasicActionForBasicElement(
  node: ChildNodeContainer,
  newChildMatrix: Matrix4,
  updatedProperties?: Properties,
): BasicAction {
  return {
    type: "basic-update",
    path: node.path,
    child: { ...node.child, transform: newChildMatrix.toArray() },
    properties: updatedProperties,
  }
}

function getCoreActionForNonBasicElement(
  node: ChildNodeContainer,
  newChildMatrix: Matrix4,
  updatedProperties?: Properties,
): Action {
  const previousElement = node.elementContainer.element
  return {
    type: "update",
    path: node.path,
    element: {
      ...previousElement,
      properties: {
        ...previousElement.properties,
        ...updatedProperties,
      },
    },
    child: { ...node.child, transform: newChildMatrix.toArray() },
    cloneGeometry: true,
    persisted: true,
  }
}
