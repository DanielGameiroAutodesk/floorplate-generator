import type { InternalPath } from "src/lib/element/path"
import { HiddenPaths } from "src/core/hidden"

type PathVisibility = {
  path: InternalPath
  visible: boolean
}

export interface HiddenElementsApi {
  setVisibility: (path: InternalPath, visible: boolean) => void
  setVisibilityBatch: (paths: PathVisibility[]) => void
  cleanup: () => void
}

const hiddenElementsPerScope: Map<string, Set<string>> = new Map()

// Decide if a path should be hidden or not
// As, an element should not be visible if it is hidden in any of the scopes
const shouldHide = (path: InternalPath): boolean => {
  return Array.from(hiddenElementsPerScope.values())
    .flatMap((path) => Array.from(path))
    .includes(path)
}

export function createHiddenElementsApi(renderScope: string): [HiddenElementsApi, cleanup: () => void] {
  function setVisibility(path: InternalPath, visible: boolean) {
    setVisibilityBatch([{ path, visible }])
  }

  function setVisibilityBatch(paths: PathVisibility[]) {
    let hiddenElementsByScope = hiddenElementsPerScope.get(renderScope)
    if (!hiddenElementsByScope) {
      hiddenElementsByScope = new Set()
      hiddenElementsPerScope.set(renderScope, hiddenElementsByScope)
    }

    for (const p of paths) {
      if (p.visible) {
        hiddenElementsByScope.delete(p.path)
      } else {
        hiddenElementsByScope.add(p.path)
      }
      HiddenPaths.setPathHidden(p.path, shouldHide(p.path))
    }
  }

  function cleanup() {
    const hiddenElementsByScope = hiddenElementsPerScope.get(renderScope) ?? new Set()
    hiddenElementsPerScope.delete(renderScope)
    hiddenElementsByScope.forEach((path) => HiddenPaths.setPathHidden(path, shouldHide(path)))
  }

  return [{ setVisibility, setVisibilityBatch, cleanup }, cleanup]
}
