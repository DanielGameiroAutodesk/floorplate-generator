import type { Child, Urn } from "@spacemakerai/element-types"
import { isDefined } from "src/lib/array"
import type { FormaElementLookup } from "./lookup"

export const ROOT_KEY = "root" satisfies InternalPath
export type InternalPath = string // Format root/key1/key2

export class ElementKeyPath {
  private constructor(public value: InternalPath) {}

  static of(value: InternalPath | ElementKeyPath): ElementKeyPath {
    return typeof value === "string" ? new this(value) : value
  }

  static unwrap(value: InternalPath | ElementKeyPath): string {
    return typeof value === "string" ? value : value.value
  }

  isAnchestorOfOrEquals(other: InternalPath | ElementKeyPath) {
    const otherValue = ElementKeyPath.unwrap(other)
    return otherValue === this.value || otherValue.startsWith(`${this.value}/`)
  }

  isAnchestorOf(other: InternalPath | ElementKeyPath) {
    const otherValue = ElementKeyPath.unwrap(other)
    return otherValue.startsWith(`${this.value}/`)
  }

  isParentOf(other: InternalPath | ElementKeyPath) {
    const otherWrapped = ElementKeyPath.of(other)
    return otherWrapped.equals(this.concat(otherWrapped.leafKey()))
  }

  equals(other: InternalPath | ElementKeyPath | undefined) {
    return other != null && this.value === ElementKeyPath.unwrap(other)
  }

  concat(other: InternalPath | ElementKeyPath) {
    return ElementKeyPath.of(`${this.value}/${ElementKeyPath.unwrap(other)}`)
  }

  parent(): ElementKeyPath | undefined {
    const lastIndex = this.value.lastIndexOf("/")
    return lastIndex > 0 ? ElementKeyPath.of(this.value.substring(0, lastIndex)) : undefined
  }

  leafKey(): string {
    const lastIndex = this.value.lastIndexOf("/")
    return this.value.substring(lastIndex + 1)
  }
}

export function getParentPath(path: InternalPath): InternalPath | undefined {
  const lastIndex = path.lastIndexOf("/")
  return lastIndex > 0 ? path.substring(0, lastIndex) : undefined
}

export function getAncestorPaths(path: InternalPath): InternalPath[] {
  const keys = path.split("/")

  const paths: InternalPath[] = []
  for (let i = 1; i < keys.length; i++) {
    paths.push(keys.slice(0, i).join("/"))
  }
  return paths
}

export function getLeafKey(path: InternalPath) {
  const lastIndex = path.lastIndexOf("/")
  return path.substring(lastIndex + 1)
}

export function mergePath(head: InternalPath | undefined, tail: InternalPath): InternalPath {
  return head ? `${head}/${tail}` : tail
}

export function getUrnFromPath(elements: FormaElementLookup, rootUrn: Urn, path: InternalPath): Urn | undefined {
  const keys = path.split("/")

  let currentUrn = rootUrn
  for (let i = 1; i < keys.length; i++) {
    const element = elements.getOrThrow(currentUrn)
    const child = element.children?.find(({ key }) => key === keys[i])
    if (!child) return undefined
    currentUrn = child.urn
  }
  return currentUrn
}

export function getPathToUrn(
  elements: FormaElementLookup,
  rootUrn: Urn,
  rootKey: InternalPath = ROOT_KEY,
): Map<InternalPath, Urn> {
  const result = new Map<InternalPath, Urn>()
  traverse({ urn: rootUrn, key: rootKey })
  return result

  function traverse(child: Child, parentPath = "") {
    const path = parentPath === "" ? child.key : parentPath + "/" + child.key
    result.set(path, child.urn)

    for (const childElement of elements.getOrThrow(child.urn).children ?? []) {
      traverse(childElement, path)
    }
  }
}

export function getByAncestorPath<T>(path: InternalPath, map: Map<InternalPath, T>): T | undefined {
  let _path: InternalPath | undefined = path
  let iter = 0
  while (isDefined(_path) && iter < 10) {
    iter++
    const hit = map.get(_path)
    if (hit) return hit
    _path = getParentPath(_path)
  }
  return undefined
}

/**
 * Expands the preview set to include all children of previewed paths.
 * @param paths - Set of paths to expand, e.g. root/a, root/b
 * @param allPaths - A list of all the paths in the scene, e.g. root/a, root/b, root/a/c, root/b/c, root/b/d, root/d
 * @return The union of the paths and all the children of the paths, e.g. root/a, root/b, root/a/c, root/b/c, root/b/d
 */
export function expandPathSetToIncludeDescendants(paths: Set<InternalPath>, allPaths: Set<InternalPath>) {
  const sortedAllPaths = [...allPaths].sort()
  const expandedPaths = new Set(paths)

  for (const path of paths) {
    let low = 0
    let high = sortedAllPaths.length - 1

    // Binary search to find the starting index for children of path
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      const midPath = sortedAllPaths[mid]
      if (midPath === path) {
        // Traverse from mid to add all child paths
        for (let i = mid + 1; i < sortedAllPaths.length && sortedAllPaths[i].startsWith(path + "/"); i++) {
          expandedPaths.add(sortedAllPaths[i])
        }
        break
      } else if (midPath < path) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
  }
  return expandedPaths
}
