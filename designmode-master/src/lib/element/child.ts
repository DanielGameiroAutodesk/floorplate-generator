import type { FormaElement, Child } from "@spacemakerai/element-types"
import type { InternalPath } from "./path"
import { getLeafKey, getParentPath } from "./path"

export function getChildFromPath(
  path: string,
  getElement: (path: InternalPath) => FormaElement | undefined,
): Child | undefined {
  const parentPath = getParentPath(path)
  if (!parentPath) return
  const parentElement = getElement(parentPath)
  return parentElement?.children?.find((child) => child.key === getLeafKey(path))
}
