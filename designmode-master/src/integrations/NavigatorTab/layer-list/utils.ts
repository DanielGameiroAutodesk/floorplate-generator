import { untracked } from "@preact/signals"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { InternalPath } from "src/lib/element/path"

export function findPathsForCategory(
  toplevel: ChildNodeContainer[],
  isScenario: boolean,
  category: string,
  includeLocked: boolean,
  includeHidden: boolean,
) {
  const result = new Set<InternalPath>()
  for (const el of toplevel) {
    if (
      el.isInBase === isScenario &&
      (includeLocked || !untracked(() => el.getIsLockedReactive())) &&
      (includeHidden || !untracked(() => el.getIsHiddenReactive())) &&
      el.elementContainer.mappedCategory === category
    ) {
      result.add(el.path)
    }
  }
  return result
}
