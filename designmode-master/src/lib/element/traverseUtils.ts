import type { FormaElement, Child, Urn } from "@spacemakerai/element-types"

import type { InternalPath } from "./path"
import { ROOT_KEY } from "./path"
import type { FormaElementLookup } from "./lookup"
import { getInMapOrThrow } from "src/lib/map"

export function traverseDepthFirst(
  elements: FormaElementLookup,
  rootUrn: Urn,
  callback: (child: Child, path: InternalPath, element: FormaElement) => any,
) {
  function visit(child: Child, parentpath: InternalPath) {
    const element = elements.get(child.urn)
    if (!element) return
    const path = `${parentpath}/${child.key}`
    callback(child, path, element)
    if (element.children) {
      for (const child of element.children) {
        visit(child, path)
      }
    }
  }

  const root = elements.get(rootUrn)
  if (!root) return
  for (const child of root.children || []) {
    visit(child, ROOT_KEY)
  }
}

export function* traverseDepthFirstIterable(
  elements: FormaElementLookup,
  rootUrn: Urn,
): Iterable<[Child, InternalPath, FormaElement]> {
  function* visit(child: Child, parentpath: InternalPath): Iterable<[Child, InternalPath, FormaElement]> {
    const element = elements.get(child.urn)
    if (!element) return
    const path = `${parentpath}/${child.key}`
    yield [child, path, element]
    if (element.children) {
      for (const child of element.children) {
        yield* visit(child, path)
      }
    }
  }

  const root = elements.get(rootUrn)
  if (!root) return
  for (const child of root.children || []) {
    yield* visit(child, ROOT_KEY)
  }
}

export function* traverseDepthFirstIterableWithCallback(
  rootUrn: Urn,
  getElement: (urn: Urn) => FormaElement | undefined,
  rootPath: InternalPath = ROOT_KEY,
): Iterable<[Child, InternalPath, FormaElement]> {
  function* visit(child: Child, parentpath: InternalPath): Iterable<[Child, InternalPath, FormaElement]> {
    const element = getElement(child.urn)
    if (!element) return
    const path = `${parentpath}/${child.key}`
    yield [child, path, element]
    if (element.children) {
      for (const child of element.children) {
        yield* visit(child, path)
      }
    }
  }

  const root = getElement(rootUrn)
  if (!root) return
  for (const child of root.children || []) {
    yield* visit(child, rootPath)
  }
}

export function findPath(
  elements: FormaElementLookup,
  rootUrn: Urn,
  predicate: (child: Child, path: InternalPath, element: FormaElement) => boolean,
) {
  function visit(child: Child, parentpath: InternalPath): InternalPath | undefined {
    const element = elements.get(child.urn)
    if (!element) return undefined
    const path = `${parentpath}/${child.key}`
    if (predicate(child, path, element)) return path
    if (element.children) {
      for (const child of element.children) {
        const match = visit(child, path)
        if (match) return match
      }
    }
  }

  const root = getInMapOrThrow(elements, rootUrn)
  for (const child of root.children || []) {
    const match = visit(child, ROOT_KEY)
    if (match) return match
  }
}
