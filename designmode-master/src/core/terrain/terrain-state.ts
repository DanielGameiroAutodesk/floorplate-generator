import type { TerrainMaterial } from "./terrain-types"
import { computed, effect } from "@preact/signals"
import { explicitSignal } from "src/lib/signal"
import { categoryStateSignal, setCategoryStateSignalValue } from "src/core/categories"
import { Set_add, Set_delete } from "src/lib/set"

type SerializedTerrainVisibilityOptionsShape = {
  terrainMaterial?: TerrainMaterial
}

localStorage.removeItem("terrain-visibility-options") // Delete old key for users that saw it
const cache = JSON.parse(
  sessionStorage.getItem("terrain-visibility-options") || "{}",
) as SerializedTerrainVisibilityOptionsShape

export const [terrainMaterialSignal, setTerrainMaterialSignalValue] = explicitSignal<TerrainMaterial>(
  cache.terrainMaterial || "map",
)

export const showTerrainSignal = computed(() => !categoryStateSignal.value.proposal.hidden.has("terrain"))
export const setShowTerrainSignalValue = (value: boolean) => {
  setCategoryStateSignalValue((current) => ({
    ...current,
    proposal: {
      ...current.proposal,
      hidden: value ? Set_delete(current.proposal.hidden, "terrain") : Set_add(current.proposal.hidden, "terrain"),
    },
  }))
}

let i = 0
effect(() => {
  const terrainMaterial = terrainMaterialSignal.value

  // Skip initial value.
  if (i++ === 0) return

  sessionStorage.setItem("terrain-visibility-options", JSON.stringify({ terrainMaterial }))
})
