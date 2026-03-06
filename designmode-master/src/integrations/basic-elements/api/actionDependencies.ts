import type { InternalPath } from "src/lib/element/path"
import { parseBatchId } from "./batching"
import { contextRootSignal } from "src/core/selection/selectionState"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import type { Proposal } from "src/core/elements/Proposal"
import { type NewTerrainState } from "src/core/terrain/new-terrain-state"

export type BasicActionDependencies = {
  terrainSampler: TerrainSamplerData
  batchSizes: { [batchId: string]: number }
  proposal: Proposal
  contextRoot: InternalPath
}

export function getDependenciesFromState(proposal: Proposal, terrain: NewTerrainState): BasicActionDependencies {
  const batchSizes = Array.from(proposal.snapshot.elements.keys())
    .map((urn) => parseBatchId(urn))
    .reduce(
      (acc, batchId) => {
        acc[batchId] = (acc[batchId] ?? 0) + 1
        return acc
      },
      {} as { [batchId: string]: number },
    )

  return {
    terrainSampler: terrain.terrainSamplerData,
    batchSizes,
    proposal,
    contextRoot: contextRootSignal.peek(),
  }
}
