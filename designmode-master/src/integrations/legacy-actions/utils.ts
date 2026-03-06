import type { Action } from "src/core/legacy-actions"
import type { InternalPath } from "src/lib/element/path"
import { mergePath } from "src/lib/element/path"
import type { Child, Urn } from "@spacemakerai/element-types"
import type { FormaElementBox } from "src/lib/element/statebox"
import { getInMapOrThrow } from "src/lib/map"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import { representationsByUrnToKnownRepresentations } from "src/core/elements/ElementRepresentations"
import type { ElementContainer } from "src/core/elements/ElementContainer"

export function getPath(action: Action): InternalPath {
  switch (action.type) {
    case "delete":
    case "update":
      return action.path
    case "create":
    case "add":
      return mergePath(action.parentPath, action.child.key)
  }
}

export function createAddActionsRecursively(
  parentPath: InternalPath,
  rootUrn: Urn,
  rootChild: Omit<Child, "urn">,
  elements: Map<Urn, FormaElementBox>,
  representations: RepresentationsByUrn,
): Action<"add">[] {
  let actions: Action<"add">[] = []

  function addAction(parentPath: InternalPath, urn: Urn, child: Omit<Child, "urn">) {
    const element = getInMapOrThrow(elements, urn).element
    actions.push({
      type: "add",
      element: element,
      parentPath,
      child,
      representations: representationsByUrnToKnownRepresentations(representations, urn),
      persisted: getInMapOrThrow(elements, urn).isServerState,
    })

    const path = mergePath(parentPath, child.key)
    for (const child of element.children ?? []) {
      const { urn, ..._child } = child
      addAction(path, urn, _child)
    }
  }

  addAction(parentPath, rootUrn, rootChild)

  return actions
}

export function getUpdateSubtreeActions(
  path: InternalPath,
  rootUrn: Urn,
  child: Omit<Child, "urn" | "key"> | undefined,
  elements: Map<Urn, FormaElementBox>,
  representations: RepresentationsByUrn,
  containers: Map<Urn, ElementContainer>,
): Action[] {
  const rootElementBox = getInMapOrThrow(elements, rootUrn)
  let actions: Action[] = [
    {
      type: "update",
      path,
      child,
      element: rootElementBox.element,
      representations: representationsByUrnToKnownRepresentations(representations, rootUrn),
      persisted: rootElementBox.isServerState,
      container: containers.get(rootUrn),
    },
  ]
  function addAction(parentPath: InternalPath, urn: Urn, child: Omit<Child, "urn">) {
    const elementBox = elements.get(urn)
    // This can happen when only providing new elements in the tree, as existing elements are already present
    if (!elementBox) return
    actions.push({
      type: "add",
      element: elementBox.element,
      parentPath,
      child,
      representations: representationsByUrnToKnownRepresentations(representations, urn),
      persisted: elementBox.isServerState,
      container: containers.get(urn),
    })

    const path = mergePath(parentPath, child.key)
    for (const child of elementBox.element.children ?? []) {
      const { urn, ..._child } = child
      addAction(path, urn, _child)
    }
  }

  for (const child of rootElementBox.element.children ?? []) {
    const { urn, ..._child } = child
    addAction(path, urn, _child)
  }

  return actions
}
