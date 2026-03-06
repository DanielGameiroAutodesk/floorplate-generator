import type { Action } from "src/core/legacy-actions"
import { getPath } from "src/integrations/legacy-actions/utils"
import { getAncestorActions } from "./ancestors"
import type { Urn } from "@spacemakerai/element-types"
import type { InternalPath } from "src/lib/element/path"
import { ROOT_KEY } from "src/lib/element/path"
import { FormaElementBox } from "src/lib/element/statebox"
import { bindFormaElementLookupForBoxMap } from "src/lib/element/lookup"

type CoreState = {
  rootUrn: Urn
  elements: Map<Urn, FormaElementBox>
}

export function updateElementsInState_INTERNAL(
  actions: Action[],
  rootUrn: Urn,
  elements: Map<Urn, FormaElementBox>,
  getUrnByPath: (path: InternalPath) => Urn | undefined,
): [Action[], CoreState] {
  const ancestorActions = getAncestorActions(actions, getUrnByPath, bindFormaElementLookupForBoxMap(elements))
  const allActions = [...actions, ...ancestorActions]

  let updatedRootUrn = rootUrn
  const updatedElements = new Map(elements)

  for (let action of allActions) {
    switch (action.type) {
      case "create":
      case "add":
      case "update":
        updatedElements.set(
          action.element.urn,
          action.persisted ? FormaElementBox.fromServer(action.element) : FormaElementBox.fromDraft(action.element),
        )
        break
    }

    // Proposal
    if (getPath(action) === ROOT_KEY && action.type === "update") {
      updatedRootUrn = action.element.urn
    }
  }

  return [
    allActions,
    {
      rootUrn: updatedRootUrn,
      elements: updatedElements,
    },
  ]
}
