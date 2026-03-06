import type { FormaElement } from "@spacemakerai/element-types"
import { Set_add, Set_delete, Set_toggle } from "src/lib/set"
import { explicitSignal } from "src/lib/signal"

const categories = [
  "site_limit",
  "building",
  "vegetation",
  "generic",
  "road",
  "rails",
  "property_boundary",
  "zone",
  "terrain",
  "constraints",
  "reference_image",
  "annotation_label",
] as const

export type Category = (typeof categories)[number]

// temporary (?) mapping while we have some mismatch between categories in different systems
// Not exported: Use getMappedCategory instead of accessing this directly.
const categoryMapping: Record<string, Category> = {
  ...Object.fromEntries(categories.map((c) => [c, c])),
  buildings: "building",

  roads: "road",
  tree_area: "vegetation",
  tree_line: "vegetation",
  ConceptualRoot: "generic",
  ConceptualElement: "generic",
  composition: "building",
  parcel: "building",
  "property-boundaries": "property_boundary", //temporary, to support deprecated category naming
  referenceImage: "reference_image",
  site_explore_area: "building",
}

export function getMappedCategory(element: FormaElement): Category {
  return categoryMapping[element.properties?.category as Category] ?? "generic"
}

export type CategoryState = {
  proposal: { locked: Set<Category>; hidden: Set<Category> }
  scenario: { locked: Set<Category>; hidden: Set<Category> }
}

export const defaultCategoryState: CategoryState = {
  proposal: { locked: new Set(), hidden: new Set() },
  scenario: { locked: new Set(), hidden: new Set() },
}

type SerializedStateShape = {
  proposal?: { locked: Category[]; hidden: Category[] }
  scenario?: { locked: Category[]; hidden: Category[] }
}

function getInitialCategoryState(): CategoryState {
  const cache = JSON.parse(localStorage.getItem("forma_layer_state") || "{}") as SerializedStateShape

  if (cache.proposal && cache.scenario) {
    return {
      proposal: {
        locked: new Set(cache.proposal.locked.filter((c) => c !== "reference_image")),
        hidden: new Set(cache.proposal.hidden.filter((c) => c !== "reference_image")),
      },
      scenario: {
        locked: new Set(cache.scenario.locked.filter((c) => c !== "reference_image")),
        hidden: new Set(cache.scenario.hidden.filter((c) => c !== "reference_image")),
      },
    }
  }

  return defaultCategoryState
}

export const [categoryPendingStateSignal, setCategoryPendingStateSignal] = explicitSignal<Set<Category>>(new Set())
export function setCategoryPending(category: Category, pending: boolean) {
  setCategoryPendingStateSignal((current) => (pending ? Set_add(current, category) : Set_delete(current, category)))
}

export const [categoryStateSignal, setCategoryStateSignalValue] =
  explicitSignal<CategoryState>(getInitialCategoryState())

// Current layout of localStorage["forma_layer_state"]
// { proposal: { hidden: string[], locked: string[] }, scenario: { hidden: string[], locked: string[] } }
categoryStateSignal.subscribe((newVal) => {
  const { proposal, scenario } = newVal
  if (proposal.locked.size + proposal.hidden.size + scenario.locked.size + scenario.hidden.size === 0) {
    localStorage.removeItem("forma_layer_state")
  } else {
    localStorage.setItem(
      "forma_layer_state",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      JSON.stringify(newVal, (key, value) => (value instanceof Set ? Array.from(value) : value)),
    )
  }
})

export function toggleCategoryFlag(
  current: CategoryState,
  isScenario: boolean,
  prop: keyof CategoryState[keyof CategoryState],
  category: Category,
) {
  return {
    proposal: !isScenario
      ? { ...current.proposal, [prop]: Set_toggle(current.proposal[prop], category) }
      : current.proposal,
    scenario: isScenario
      ? { ...current.scenario, [prop]: Set_toggle(current.scenario[prop], category) }
      : current.scenario,
  }
}

export function showCategory(category: string, inScenario: boolean) {
  setCategoryStateSignalValue((currentState) => {
    const context: keyof CategoryState = inScenario ? "scenario" : "proposal"

    const alreadyVisible = !currentState[context].hidden.has(category as Category)
    if (alreadyVisible) return currentState

    const newState = { ...currentState }
    newState[context].hidden.delete(category as Category)
    return newState
  })
}
