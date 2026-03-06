import { type Dispatch, useEffect, useState } from "preact/hooks"
import { SortOption } from "src/integrations/Scenarios/proposal-list/proposal-list-component/ProposalList/ProposalFilter/SortOptions"

const getLocalStorage = (key: string): SortOption => {
  const cached = localStorage.getItem(key)
  if (cached) {
    return JSON.parse(cached)
  }
  return SortOption.EDITED
}

export const useSort = (projectId: string): [SortOption, Dispatch<SortOption>] => {
  const key = `forma-proposal-sort-${projectId}`
  const [value, setValue] = useState<SortOption>(() => getLocalStorage(key))

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.error(e)
    }
  }, [key, value])

  return [value, setValue]
}
