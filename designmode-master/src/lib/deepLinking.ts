import type { History } from "history"
import { createBrowserHistory } from "history"
import { useEffect, useMemo, useState } from "preact/hooks"

export const history = createBrowserHistory()

function buildUrl(history: History, resource?: string, resourceId?: string): string {
  const search = new URLSearchParams(history.location.search)

  if (resource) search.set("resource", resource)
  else search.delete("resource")

  if (resource && resourceId) search.set("resourceId", resourceId)
  else search.delete("resourceId")

  const searchString = search.size > 0 ? `?${search.toString()}` : ""
  return `${history.location.pathname}${searchString}${history.location.hash}`
}

function parseSearch(search: string) {
  const params = new URLSearchParams(search)
  return { resource: params.get("resource") ?? undefined, resourceId: params.get("resourceId") ?? undefined }
}

export const setDeepLink = ({ resource, resourceId }: { resource?: string; resourceId?: string }) => {
  history.replace(buildUrl(history, resource, resourceId))
}

export function useDeepLinks(): { resource?: string; resourceId?: string } {
  const [search, setSearch] = useState<string>(history.location.search)

  useEffect(() => {
    return history.listen(({ location }) => {
      setSearch(location.search)
    })
  }, [])

  return useMemo(() => parseSearch(search), [search])
}
