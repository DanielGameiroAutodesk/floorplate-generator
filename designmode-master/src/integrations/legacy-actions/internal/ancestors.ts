import type { Action } from "src/core/legacy-actions"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { getPath } from "src/integrations/legacy-actions/utils"
import type { InternalPath } from "src/lib/element/path"
import { getLeafKey, getParentPath } from "src/lib/element/path"
import { newRevision, replaceRevision } from "src/lib/element/urn"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { getInMapOrThrow } from "src/lib/map"

export function getAncestorActions(
  actions: Action[],
  getUrnByPath: (path: InternalPath) => Urn | undefined,
  elements: FormaElementLookup,
): Action[] {
  const revision = newRevision()

  const allAncestorPaths = getAncestorPaths(actions)

  let ancestorActions: Action<"update">[] = []

  const ancestorPathsSortedBottomUp = [...allAncestorPaths].sort((a, b) => b.split("/").length - a.split("/").length)
  for (let ancestorPath of ancestorPathsSortedBottomUp) {
    ancestorActions.push(
      getAncestorUpdateAction(
        ancestorPath,
        getInMapOrThrow(elements, getUrnByPath(ancestorPath)),
        [...actions, ...ancestorActions],
        revision,
      ),
    )
  }

  return ancestorActions
}

function getAncestorPaths(actions: Action[]): Set<InternalPath> {
  const actionsPaths = new Set(actions.map(getPath))
  const pathsToUpdate = new Set<InternalPath>()
  for (let action of actions) {
    let parentPath: InternalPath | undefined = getParentPath(getPath(action))
    while (parentPath) {
      pathsToUpdate.add(parentPath)
      parentPath = getParentPath(parentPath)
    }
  }
  return new Set([...pathsToUpdate].filter((path) => !actionsPaths.has(path)))
}

function getAncestorUpdateAction(ancestorPath: string, ancestor: FormaElement, actions: Action[], revision: string) {
  const childActions = actions.filter((a) => getParentPath(getPath(a)) === ancestorPath)

  const newChildren = getNewChildren(childActions, ancestor.children)

  const newElement: FormaElement = {
    ...ancestor,
    urn: replaceRevision(ancestor.urn, revision),
    children: newChildren,
  }

  const updateAncestorAction: Action<"update"> = {
    type: "update",
    path: ancestorPath,
    element: newElement,
    cloneGeometry: true,
    persisted: false,
  }
  return updateAncestorAction
}

function getNewChildren(childActions: Action[], existingChildren: FormaElement["children"]): FormaElement["children"] {
  let children: FormaElement["children"] = []

  const newChildActions = childActions.filter((a) => a.type === "create" || a.type === "add") as Action<
    "create" | "add"
  >[]
  for (let action of newChildActions) {
    children.push({ ...action.child, urn: action.element.urn })
  }

  for (let existingChild of existingChildren ?? []) {
    const deletedChildAction = childActions.find(
      (a) => a.type === "delete" && getLeafKey(getPath(a)) === existingChild.key,
    )
    if (deletedChildAction) {
      continue
    }

    const updatedChildAction = childActions.find(
      (a) => a.type === "update" && getLeafKey(getPath(a)) === existingChild.key,
    ) as Action<"update"> | undefined

    if (updatedChildAction) {
      children.push({ ...existingChild, ...(updatedChildAction.child ?? {}), urn: updatedChildAction.element.urn })
    } else {
      children.push(existingChild)
    }
  }
  return children.length > 0 ? children : undefined
}
