import type { InternalPath } from "./path"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { Matrix4 } from "three"
import type { FormaElementLookup } from "./lookup"

export function getWorldMatrix(path: InternalPath, rootUrn: Urn, elements: FormaElementLookup): Matrix4 | undefined {
  const pathKeys = path.split("/")
  const reusedMatrix = new Matrix4()

  // Remove ROOT
  pathKeys.shift()

  function traverse(element: FormaElement, keys: string[], matrix: Matrix4 = new Matrix4()) {
    const key = keys.shift()
    const child = element.children?.find((child) => child.key === key)

    if (!child) return undefined

    if (child.transform) {
      matrix.multiply(reusedMatrix.fromArray(child.transform))
    }

    if (keys.length === 0) {
      return matrix
    }

    return traverse(elements.getOrThrow(child.urn), keys, matrix)
  }

  return traverse(elements.getOrThrow(rootUrn), pathKeys)
}
