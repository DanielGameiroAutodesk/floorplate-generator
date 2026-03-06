import type { InternalPath } from "src/lib/element/path"
import type { Child, FormaElement } from "@spacemakerai/element-types"
import type { Matrix4 } from "three"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"

// Unsure if we need "child" here, as we know "key" is same (since path is same), and only interesting part is transform
// which is already included in the global "matrix" property
export type Diff =
  | {
      path: InternalPath
      type: "added"
      child: Child
      matrix: Matrix4
      element: FormaElement
    }
  | {
      path: InternalPath
      type: "updated"
      child?: Child
      matrix?: Matrix4
      element?: FormaElement
    }
  | {
      path: InternalPath
      type: "removed"
    }

export function diffSnapshots(from: ElementSnapshot, to: ElementSnapshot): Diff[] {
  const diffs: Diff[] = []

  const allPaths = new Set([...from.nodes.keys(), ...to.nodes.keys()])

  for (const path of allPaths) {
    const oldNode = from.getNode(path)
    const newNode = to.getNode(path)
    if (oldNode && newNode) {
      const childEqual = JSON.stringify(oldNode.child) === JSON.stringify(newNode.child)
      const matrixEqual = oldNode.globalMatrix.equals(newNode.globalMatrix)
      const elementEqual = oldNode.child.urn === newNode.child.urn

      if (!(childEqual && matrixEqual)) {
        diffs.push({
          path,
          type: "updated",
          child: !childEqual ? newNode.child : undefined,
          element: !elementEqual ? newNode.elementContainer.element : undefined,
          matrix: !matrixEqual ? newNode.globalMatrix : undefined,
        })
      }
    } else if (!oldNode && newNode) {
      diffs.push({
        path,
        type: "added",
        element: newNode.elementContainer.element,
        child: newNode.child,
        matrix: newNode.globalMatrix,
      })
    } else if (oldNode && !newNode) {
      diffs.push({ path, type: "removed" })
    } else {
      throw new Error("Should not happen")
    }
  }

  return diffs
}
