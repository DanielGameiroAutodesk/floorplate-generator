import type { Urn } from "@spacemakerai/element-types"
import { isDefined } from "src/lib/array"

const cache = new Map<Urn, ParsedUrn>()
export type ParsedUrn = { system: string; id: string; revision: string; authcontext: string }

export function parseUrn(urn: Urn): ParsedUrn {
  if (!isDefined(urn)) {
    throw new Error("Tried to parse undefined urn")
  }
  const cached = cache.get(urn)
  if (cached) return cached
  const [, , system, authcontext, id, revision] = urn.split(":")
  const result = { system, id, revision, authcontext }
  cache.set(urn, result)
  return result
}

export function createUrn(system: string, authcontext: string, id: string, revision: string): Urn {
  return `urn:adsk-forma-elements:${system}:${authcontext}:${id}:${revision}`
}

export const urnWithoutRevision = (urn: Urn): string => urn.split(":").slice(0, -1).join(":")

export const newId = () => Math.random().toString(16).slice(2)
export const newChildKey = () => Math.random().toString(16).slice(8)
export const newRevision = () => Date.now().toString()

export const urnEqualsExcludingRevision = (urn1: Urn, urn2: Urn): boolean => {
  const parsed1 = parseUrn(urn1)
  const parsed2 = parseUrn(urn2)

  return parsed1.system === parsed2.system && parsed1.id === parsed2.id
}

export const replaceRevision = (urn: Urn, revision?: string): Urn => {
  const parts = urn.split(":")
  parts.pop()
  parts.push(revision ?? newRevision())
  return parts.join(":") as Urn
}

export function isBasicElementUrn(urn: Urn) {
  return parseUrn(urn).system === "basic"
}

export function isRasterElementUrn(urn: Urn) {
  return parseUrn(urn).system === "raster"
}
