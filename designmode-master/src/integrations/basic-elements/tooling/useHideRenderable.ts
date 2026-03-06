import type { InternalPath } from "src/lib/element/path"
import { useEffect } from "preact/hooks"
import { HiddenPaths } from "src/core/hidden"

export function useHideRenderable(path: InternalPath, hide: boolean) {
  useEffect(() => {
    HiddenPaths.setPathHidden(path, hide)
    return () => HiddenPaths.setPathHidden(path, false)
  }, [hide, path])
  return null
}
