import type { InternalPath } from "src/lib/element/path"
import { defaultCategoryState } from "./categories"
import { Set_add, Set_delete, Set_toggle } from "src/lib/set"
import { explicitSignal } from "src/lib/signal"

type SerializedStateShape = {
  proposal?: { locked: InternalPath[]; hidden: InternalPath[] }
  scenario?: { locked: InternalPath[]; hidden: InternalPath[] }
}

function getInitialPathState(): PathState {
  const cache = JSON.parse(localStorage.getItem("forma_layer_path_state") || "{}") as SerializedStateShape

  if (cache.proposal && cache.scenario) {
    return {
      proposal: { locked: new Set(cache.proposal.locked), hidden: new Set(cache.proposal.hidden) },
      scenario: { locked: new Set(cache.scenario.locked), hidden: new Set(cache.scenario.hidden) },
    }
  }

  return defaultCategoryState
}

export type PathState = {
  proposal: { locked: Set<InternalPath>; hidden: Set<InternalPath> }
  scenario: { locked: Set<InternalPath>; hidden: Set<InternalPath> }
}

// TODO: Why don't we have a selector with both scenario paths and proposal paths in same set?
export const [pathStateSignal, setPathStateSignalValue] = explicitSignal<PathState>(getInitialPathState())

pathStateSignal.subscribe((newVal) => {
  const { proposal, scenario } = newVal
  if (proposal.locked.size + proposal.hidden.size + scenario.locked.size + scenario.hidden.size === 0) {
    localStorage.removeItem("forma_layer_path_state")
  } else {
    localStorage.setItem(
      "forma_layer_path_state",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      JSON.stringify(newVal, (key, value) => (value instanceof Set ? Array.from(value) : value)),
    )
  }
})

export function togglePathFlag(
  current: PathState,
  isScenario: boolean,
  prop: keyof PathState[keyof PathState],
  path: string,
) {
  return {
    proposal: !isScenario
      ? { ...current.proposal, [prop]: Set_toggle(current.proposal[prop], path) }
      : current.proposal,
    scenario: isScenario ? { ...current.scenario, [prop]: Set_toggle(current.scenario[prop], path) } : current.scenario,
  }
}

export function setPathFlag(
  current: PathState,
  isScenario: boolean,
  prop: keyof PathState[keyof PathState],
  path: string,
  add: boolean,
) {
  return isScenario
    ? {
        proposal: current.proposal,
        scenario: {
          ...current.scenario,
          [prop]: add ? Set_add(current.scenario[prop], path) : Set_delete(current.scenario[prop], path),
        },
      }
    : {
        proposal: {
          ...current.proposal,
          [prop]: add ? Set_add(current.proposal[prop], path) : Set_delete(current.proposal[prop], path),
        },
        scenario: current.scenario,
      }
}
