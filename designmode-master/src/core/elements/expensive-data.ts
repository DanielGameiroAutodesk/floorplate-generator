import { captureException } from "@sentry/browser"
import { useSignalEffect } from "@preact/signals"
import { elementState } from "./ElementState"
import type { ChildNodeContainer } from "./ChildNodeContainer"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"

/**
 * To be used from main app code.
 */
export function useCalculateExpensiveData() {
  useSignalEffect(() => {
    if (!elementState.isInitializedSignal.value) return

    const proposal = elementState.currentProposalSignal.value
    const terrain = terrainSignal.value

    calculateExpensiveData([...proposal.snapshot.nodes.values()], terrain)
  })
}

const MS_BUDGET = 10
function calculateExpensiveData(nodes: ChildNodeContainer[], terrain: NewTerrainState) {
  const start = performance.now()
  const startTime = Date.now()
  let currMs = 0
  let currIndex = 0
  while (currMs < MS_BUDGET && currIndex < nodes.length) {
    calculateExpensiveDataForNode(nodes[currIndex], terrain.terrainSamplerData)
    currMs = Date.now() - startTime
    currIndex += 1
  }
  const measure = performance.measure("calculate expensive data for node", {
    start,
  })
  if (measure.duration > 5000) {
    console.log(
      "Expensive nodes:",
      nodes.slice(0, currIndex).map((n) => ({ urn: n.elementContainer.element.urn, path: n.path })),
    )
    captureException(new Error("Expensive data calculation froze user's project for more than 5 seconds"))
  }
  const rest = nodes.slice(currIndex)
  if (rest.length > 0) {
    setTimeout(() => calculateExpensiveData(rest, terrain), 0)
  }
}

function calculateExpensiveDataForNode(node: ChildNodeContainer, terrainSamplerData: TerrainSamplerData) {
  if (!node.affineSnapInfo(terrainSamplerData).isComputed()) {
    node.affineSnapInfo(terrainSamplerData).compute()
  }
  if (!node.bboxOctreeSnappingLines(terrainSamplerData).isComputed()) {
    node.bboxOctreeSnappingLines(terrainSamplerData).compute()
  }
}
