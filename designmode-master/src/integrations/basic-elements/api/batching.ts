import type { ParsedUrn } from "src/lib/element/urn"
import { newId, parseUrn, replaceRevision } from "src/lib/element/urn"
import type { Action } from "src/core/legacy-actions"
import { getPath } from "src/integrations/legacy-actions/utils"
import type { Urn } from "@spacemakerai/element-types"
import { LDFlag, URLFlag, featureFlagSignalFamily, isFlagActive } from "src/lib/featureToggling"
import type { InternalPath } from "src/lib/element/path"
import { getUrnFromPath } from "src/lib/element/path"
import type { FormaElementLookup } from "src/lib/element/lookup"
import { objectKeys } from "src/lib/record"
import { useSignalEffect } from "@preact/signals"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"

export type ParsedUrnWithBatch = ParsedUrn & { batchId: string; internalId: string }
export function parseUrnBatch(urn: Urn): ParsedUrnWithBatch {
  const parsed = parseUrn(urn)
  if (!parsed.id.includes("+")) throw new Error("Tried to parse batch of urn which does not have a batch")
  const [batchId, internalId] = parsed.id.split("+")
  return { ...parsed, batchId, internalId }
}

function isSameBatch(a: Urn, b: Urn) {
  const _a = parseUrn(a)
  const _b = parseUrn(b)

  return _a.system === _b.system && _a.id.split("+")[0] === _b.id.split("+")[0]
}

/**
 * TODO: Implement logic for scenarios and batch splitting
 * - Read existing elements to find batchId
 *   - Choose proposal-batch (with batchId === proposalId) by default
 *   - If # elements is big (above 100???), create new batchId
 * - If element is in base, choose a different batch (ex. batchId related to base-id?)
 *
 * - Special case tree batches??
 *
 * Wanted behaviour:
 * Batches:
 * - <propId>-1
 * - <propId>-2
 * - <propId>-3
 * - <baseId>-1
 * - <baseId>-2
 * - <order-batch>
 */
export function findBatch(
  parentPath: InternalPath,
  elements: FormaElementLookup,
  rootUrn: Urn,
  batchSizes: { [batch: string]: number },
  updatingUrn?: Urn,
): string {
  const batchCapacity = isFlagActive(LDFlag.BasicBatch) ? 500 : Infinity

  const parentUrn = getUrnFromPath(elements, rootUrn, parentPath)
  // proposal id batch
  let batchIdPrefix = parseUrn(rootUrn).id
  if (parentUrn) {
    const element = elements.getOrThrow(parentUrn)
    // group base elements in the same batch
    if (element.properties?.tags && element.properties?.tags.includes("scenario")) {
      batchIdPrefix = parseUrn(element.urn).id
    }
  }

  if (updatingUrn?.startsWith(batchIdPrefix)) {
    return parseBatchId(updatingUrn)
  }

  const nextBatch = Object.entries(batchSizes)
    .filter(([batch]) => batch.startsWith(batchIdPrefix))
    .find(([, size]) => size < batchCapacity)?.[0]
  if (nextBatch) {
    batchSizes[nextBatch]++
    return nextBatch
  } else {
    const newBatch = `${batchIdPrefix}-${newId()}`
    batchSizes[newBatch] = 1
    return newBatch
  }
}

export function parseBatchId(urn: Urn) {
  return parseUrn(urn).id.split("+")[0]
}

export function getBasicBatchUpdates(actions: Action[], snapshot: ElementSnapshot): Action<"update">[] {
  const batchUpdateActions: Action<"update">[] = []
  const existingActionPaths = new Set(actions.map(getPath))

  for (const node of snapshot.nodes.values()) {
    if (existingActionPaths.has(node.path)) continue

    const urn = node.elementContainer.element.urn

    if (parseUrn(urn).system === "basic") {
      const actionAffectingThisElement = actions.find((action) => {
        if (action.type === "delete") return false
        return isSameBatch(urn, action.element.urn)
      }) as Action<"add" | "update" | "create"> | undefined

      if (actionAffectingThisElement) {
        const revision = parseUrn(actionAffectingThisElement.element.urn).revision
        const element = node.elementContainer.element

        const children = element.children?.map((child) =>
          isSameBatch(urn, child.urn) ? { ...child, urn: replaceRevision(child.urn, revision) } : child,
        )

        const newUrn = replaceRevision(urn, revision)
        batchUpdateActions.push({
          type: "update",
          path: node.path,
          element: { ...element, urn: newUrn, children },
          cloneGeometry: true,
          persisted: false,
        })
      }
    }
  }

  return batchUpdateActions
}

export const useLogBasicBatches = () => {
  useSignalEffect(() => {
    if (!elementState.isInitializedSignal.value) return

    const logBasicBatches = featureFlagSignalFamily(URLFlag.LogBasicBatches).value
    if (!logBasicBatches) return

    const counterAll: Record<string, number> = {}
    // key = `${batchId}:${parsed.revision}`
    const batchAndRevisionCounter: Record<string, number> = {}
    const counterUrn: Record<Urn, number> = {}

    for (let urn of elementState.currentSnapshot.value.elements.keys()) {
      const parsed = parseUrn(urn)
      if (parsed.system === "basic") {
        if (!(urn in counterUrn)) {
          counterUrn[urn] = 0
        }
        counterUrn[urn]++
      }
    }

    for (let urn of elementState.currentSnapshot.value.elements.keys()) {
      const parsed = parseUrn(urn)
      if (parsed.system === "basic") {
        const batchId = parsed.id.split("+")[0]
        const key = `${batchId}:${parsed.revision}`
        if (!(key in counterAll)) {
          counterAll[key] = 0
        }
        counterAll[key]++
      }
    }

    for (let urn of objectKeys(counterUrn)) {
      const parsed = parseUrn(urn)
      if (parsed.system === "basic") {
        const batchId = parsed.id.split("+")[0]
        const key = `${batchId}:${parsed.revision}`
        if (!(key in batchAndRevisionCounter)) {
          batchAndRevisionCounter[key] = 0
        }
        batchAndRevisionCounter[key]++
      }
    }
    //console.log(JSON.stringify(counterAll, undefined, 1))
    console.log(JSON.stringify(batchAndRevisionCounter, undefined, 1))
    //console.log(JSON.stringify(counterUrn, undefined, 1))
  })
}
