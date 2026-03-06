import { useEffect } from "preact/compat"
import { captureException } from "@sentry/browser"
import { getTranslator } from "src/i18n"
import { request } from "src/lib/request"
import { useCallback } from "react"
import { useVisualizationAPI } from "src/integrations/renderables/VisualizationAPI"
import type { AtomEffect } from "recoil"
import { atom, useSetRecoilState } from "recoil"
import type { VisualizationSettings } from "src/lib/visualizationSettings"
import { PROJECT_ID } from "src/core/project/project"

export type FunctionTag = {
  id: string
  name: string
  color: string
}

const localStorageEffect: AtomEffect<FunctionTag[]> = ({ onSet }) => {
  onSet((newVal) => {
    localStorage.setItem("forma_building_functions_state", JSON.stringify({ projectId: PROJECT_ID, functions: newVal }))
  })
}

function loadFunctionsFromLocalStorage() {
  try {
    const item = JSON.parse(localStorage.getItem("forma_building_functions_state") || "[]")
    if (item?.projectId === PROJECT_ID && item?.functions?.length) return item.functions as FunctionTag[]
    return []
  } catch {
    return []
  }
}

export const buildingFunctionsAtom = atom<FunctionTag[]>({
  key: "buildingFunctionsAtom",
  effects: [localStorageEffect],
  default: loadFunctionsFromLocalStorage(),
})

type UnitBucket = {
  min: number
  max: number | null
  color: string
  name?: string
  id: string
}

let fetched = false
export const useFetchBuildingFunctions = () => {
  const visualizationAPI = useVisualizationAPI()
  const updateSettings = visualizationAPI.updateSettings
  const setFunctionsAtom = useSetRecoilState(buildingFunctionsAtom)

  const update = useCallback(
    (functions: FunctionTag[], unitBuckets: UnitBucket[]) => {
      setFunctionsAtom((cur) => (JSON.stringify(cur) !== JSON.stringify(functions) ? functions : cur))
      const functionColors: Record<string, string> = {}
      for (const f of functions) {
        functionColors[f.name] = f.color
        functionColors[f.id] = f.color
      }
      updateSettings((cur) => {
        const updated: VisualizationSettings = JSON.parse(JSON.stringify(cur))
        updated.buildings.functionColors = functionColors
        updated.buildings.areaSizeBuckets = unitBuckets
        return JSON.stringify(cur) !== JSON.stringify(updated) ? updated : cur
      })
    },
    [setFunctionsAtom, updateSettings],
  )

  useEffect(() => {
    if (!fetched) {
      fetched = true
      request(`/api/geo-settings?authcontext=${PROJECT_ID}`)
        .then((response) => response.json())
        .then(
          (res) => update(res.functionTags, res.unitBuckets),
          (err) => {
            if (![401, 403].includes(err.responseCode)) {
              captureException(err, { tags: { owner: "building-systems" } })
            }
            const t = getTranslator()
            window.forma_toasts.push({ content: t(($) => $.building.errors.failedToLoadFunctions), status: "warning" })
          },
        )
    }
  }, [update])

  useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail || {}
      if (data.geoSettings) {
        update(data.geoSettings.functions, data.geoSettings.unitBuckets)
      } else if (data.geoSettingsDb) {
        update(data.geoSettingsDb.functionTags, data.geoSettingsDb.unitBuckets)
      }
    }
    window.addEventListener("geo-settings-updated", handler)
    return () => window.removeEventListener("geo-settings-updated", handler)
  }, [update])
}
