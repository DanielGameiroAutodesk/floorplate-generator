import { elementState } from "src/core/elements/ElementState"
import { categoryStateSignal } from "src/core/categories"
import { scenarioHiddenSignal } from "src/core/hidden"
import { useCallback } from "preact/compat"
import { useCachedCallback } from "src/lib/hooks"
import { NODE_PREDICATES } from "src/core/elements/predicates"
import type { AffineSnap } from "./snapping"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export function useCalculateAffineSnap(): () => AffineSnap[] {
  const proposal = elementState.currentProposalSignal.value
  const terrain = terrainSignal.value

  const categoryState = categoryStateSignal.value
  const scenarioHidden = scenarioHiddenSignal.value

  const calculateAffineSnap = useCallback(() => {
    const nonHiddenNodes = [...proposal.snapshot.nodes.values()].filter(
      NODE_PREDICATES.allOf(
        NODE_PREDICATES.isInVisibleCategory(categoryState),
        NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHidden),
      ),
    )
    return nonHiddenNodes.flatMap((node) => node.affineSnapInfo(terrain.terrainSamplerData).getOrCompute())
  }, [categoryState, scenarioHidden, proposal, terrain])

  return useCachedCallback(calculateAffineSnap)
}
