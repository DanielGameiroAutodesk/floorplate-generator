import { useMemo } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import type { SnappingLine } from "./snapping"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export function useSnappingLines(): SnappingLine[] {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value

  return useMemo(() => {
    return [...proposal.snapshot.nodes.values()].flatMap((node) =>
      node.snappingLines(terrain.terrainSamplerData).getOrCompute(),
    )
  }, [proposal, terrain])
}
