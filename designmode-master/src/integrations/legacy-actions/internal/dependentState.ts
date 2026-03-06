import type { KnownRepresentations } from "src/core/elements/ElementRepresentations"
import type { Action } from "src/core/legacy-actions"
import type { Urn } from "@spacemakerai/element-types"
import type { UrnUpdate } from "src/integrations/legacy-actions/types"

export function getRepresentationOfKey<K extends keyof KnownRepresentations>(
  key: K,
  actions: Action[],
): Map<Urn, NonNullable<KnownRepresentations[K]>> {
  const result = new Map<Urn, NonNullable<KnownRepresentations[K]>>()
  for (const action of actions) {
    if (action.type === "add" || action.type === "update" || action.type === "create") {
      if (action.representations && key in action.representations && action.representations[key]) {
        result.set(action.element.urn, action.representations[key])
      }
    }
  }
  return result
}

export function addData<T>(
  updates: UrnUpdate[],
  actionData: Map<Urn, T>,
  getPrev: (urn: Urn) => T | undefined,
): Map<Urn, T> {
  const result = new Map<Urn, T>(actionData)

  for (let update of updates) {
    if (!result.has(update.newUrn)) {
      const prev = getPrev(update.oldUrn)
      if (prev) {
        result.set(update.newUrn, prev)
      }
    }
  }

  return result
}
