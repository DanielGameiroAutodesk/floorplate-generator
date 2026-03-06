import type { Child, FormaElement } from "@spacemakerai/element-types"
import type { InternalPath } from "./path"
import { ROOT_KEY } from "./path"

export type BaseElement = FormaElement & {
  properties: FormaElement["properties"] & {
    category: "group"
    component: true
    indicator: string
    name: string
    tags: ("base" | "scenario" | string)[]
  }
}

export function findBaseChild(proposal: FormaElement): Child | undefined {
  for (const child of proposal.children || []) {
    if (
      proposal.properties &&
      proposal.properties?.flags &&
      proposal.properties?.flags[child.key] &&
      proposal.properties?.flags[child.key].scenario
    ) {
      return child
    }
  }
}

export function findBasePath(proposal: FormaElement): InternalPath | undefined {
  if (!proposal) return
  const scenarioKey = Object.entries((proposal.properties?.flags as { [k: string]: any }) ?? {}).find(
    ([, { scenario }]) => !!scenario,
  )?.[0]
  if (!scenarioKey) return
  return `${ROOT_KEY}/${scenarioKey}`
}
