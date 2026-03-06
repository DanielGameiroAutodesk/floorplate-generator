import type { Urn } from "@spacemakerai/element-types"

import type { InternalPath } from "src/lib/element/path"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import { traverseDepthFirstIterable } from "src/lib/element/traverseUtils"
import type { DuplicatePathError, ElementsValidationError, MissingBase, MissingElementError } from "./types"
import { findBaseChild } from "src/lib/element/base"
import type { FormaElementLookup } from "src/lib/element/lookup"

export function validateState(urn: Urn, elements: FormaElementLookup): ElementsValidationError[] {
  const missingElements = validateMissingElements(ROOT_KEY, urn, elements)
  const duplicateKeys = validateDuplicatePaths(urn, elements)
  const missingBase = validateMissingBase(urn, elements)

  return [...missingElements, ...duplicateKeys, ...missingBase]
}

function validateMissingBase(urn: Urn, elements: FormaElementLookup): MissingBase[] {
  const el = elements.get(urn)
  const baseChild = el ? findBaseChild(el) : undefined
  if (!baseChild) return [{ type: "MISSING_BASE", reason: "NO_FLAG" }]
  const baseElement = elements.get(baseChild.urn)
  if (!baseElement) return [{ type: "MISSING_BASE", reason: "NO_BASE_ELEMENT" }]
  return []
}

export function validateMissingElements(
  path: InternalPath,
  urn: Urn,
  elements: FormaElementLookup,
): MissingElementError[] {
  const element = elements.get(urn)
  if (!element) return [{ type: "MISSING_ELEMENT", path, urn: urn }]

  return (
    element.children?.flatMap((child) => validateMissingElements(mergePath(path, child.key), child.urn, elements)) ?? []
  )
}

function validateDuplicatePaths(
  urn: Urn,
  elements: FormaElementLookup,
  path: InternalPath = ROOT_KEY,
): DuplicatePathError[] {
  const element = elements.get(urn)
  if (!element) return []
  if (!element.children) return []

  const errors: DuplicatePathError[] = []
  const paths = new Set<string>()
  for (const child of element.children) {
    if (paths.has(child.key)) {
      errors.push({ type: "DUPLICATE_KEY_AT_SAME_LEVEL", path: `${path}/${child.key}` })
    }
    paths.add(child.key)
  }

  return [
    ...errors,
    ...element.children.flatMap((child) => validateDuplicatePaths(child.urn, elements, `${path}/${child.key}`)),
  ]
}

export function logUnreferencedElements(rootUrn: Urn, elements: FormaElementLookup) {
  const usedElements = new Set<Urn>([rootUrn])
  const unusedElements = new Set<Urn>()
  for (const [, , element] of traverseDepthFirstIterable(elements, rootUrn)) {
    usedElements.add(element.urn)
  }
  for (const { urn } of elements) {
    if (!usedElements.has(urn)) {
      unusedElements.add(urn)
    }
  }

  console.log({ usedElements: usedElements.size, unusedElements: unusedElements.size })
}
