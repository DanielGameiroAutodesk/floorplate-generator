import type { InternalPath } from "src/lib/element/path"

export type ElementSelectionPath = `element:${string}` // Selecting this means selecting an element by path
export type CustomSelectionPath = `custom:${string}:${string}` // Selecting this means selecting an arbitrary, custom non-element entity
export type SelectionPath = ElementSelectionPath | CustomSelectionPath

export function isElementSelectionPath(selectionPath: SelectionPath): selectionPath is ElementSelectionPath {
  return selectionPath.startsWith("element:")
}

export function isCustomSelectionPath(selectionPath: string): selectionPath is CustomSelectionPath {
  return selectionPath.startsWith("custom:")
}

export function elementSelectionPathToInternalPath(elementSelectionPath: ElementSelectionPath): InternalPath {
  return elementSelectionPath.slice("element:".length)
}

export function internalPathToSelectionPath(internalPath: InternalPath): ElementSelectionPath {
  return `element:${internalPath}`
}

export function selectionPathSetToInternalPathSet(selectionPathSet: Set<SelectionPath>): Set<InternalPath> {
  return new Set(Array.from(selectionPathSet).filter(isElementSelectionPath).map(elementSelectionPathToInternalPath))
}

export function internalPathSetToSelectionPathSet(elementPathSet: Set<InternalPath>): Set<SelectionPath> {
  return new Set(Array.from(elementPathSet).map(internalPathToSelectionPath))
}

export type CustomSelectionIntegration = "terrain_pads" | "scenario_renderables"
export type CustomSelectionTarget = { integration: CustomSelectionIntegration; id: string }

export function customSelectionTargetToSelectionPath(target: CustomSelectionTarget): CustomSelectionPath {
  return `custom:${target.integration}:${target.id}`
}

export function parseCustomSelectionPath(selectionPath: CustomSelectionPath): CustomSelectionTarget {
  const payload = selectionPath.slice("custom:".length)
  const separator = payload.indexOf(":")
  const integration = payload.slice(0, separator) as CustomSelectionIntegration
  const id = payload.slice(separator + 1)
  return { integration, id }
}
