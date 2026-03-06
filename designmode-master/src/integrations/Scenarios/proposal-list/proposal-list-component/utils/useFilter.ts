import type { Urn } from "forma-elements"
import { type StateUpdater, useEffect, useState } from "preact/hooks"

const getSessionStorage = (key: string) => {
  const cached = sessionStorage.getItem(key)
  if (cached) {
    return JSON.parse(cached)
  }
}

export const useFilter = (projectId: string): [Set<Urn>, (value: StateUpdater<Set<Urn>>) => void] => {
  const key = `forma-proposal-filter-${projectId}`
  const [value, setValue] = useState(getSessionStorage(key))

  useEffect(() => {
    try {
      if (value) {
        sessionStorage.setItem(key, JSON.stringify([...value]))
      }
    } catch (e) {
      console.error(e)
    }
  }, [key, value])

  if (Array.isArray(value)) {
    return [new Set(value.map((item) => item)), setValue]
  }

  return [value, setValue]
}
