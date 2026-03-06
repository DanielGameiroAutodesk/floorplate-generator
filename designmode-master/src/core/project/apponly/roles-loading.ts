import { useEffect } from "preact/hooks"
import { getProjectAccessFromCache } from "src/core/project/project-access-cache.internal"
import { setProjectRolesSignalValue } from "src/core/project/project"

export function useProjectRolesLoading() {
  useEffect(() => {
    function update() {
      setProjectRolesSignalValue(getProjectAccessFromCache())
    }

    update()
    window.addEventListener("forma-projectroles-updated", update)
    return () => window.removeEventListener("forma-projectroles-updated", update)
  }, [])
}
