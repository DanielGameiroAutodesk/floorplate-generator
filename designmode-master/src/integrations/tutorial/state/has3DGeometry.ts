import { computed, signal, effect } from "@preact/signals"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import { Proposal } from "src/core/elements/Proposal"

/**
 * Signal to track if the proposal has 3D geometry (buildings, row houses, or generic volumes)
 * This is used for the site design tutorial
 */
export const proposalHas3DGeometrySignal = computed<boolean>(() => {
  if (!elementState.isInitializedSignal.value) return false

  const is3DElement = (node: ChildNodeContainer) => {
    const properties = node.element.properties
    if (!properties?.category) {
      return false
    }

    const isBuilding = properties.category === "building"
    const isRowHouse = properties.category === "composition"
    const isGenericVolume = properties?.category === "generic" && properties?.name === "Volume"

    return isBuilding || isRowHouse || isGenericVolume
  }
  const snapshot = elementState.currentSnapshot.value
  const proposal = Proposal.of(snapshot)
  return proposal.getToplevelNodes().some(is3DElement)
})

/**
 * Signal to signalize that the proposal has had 3D geometry for 1 second
 * This is because we don't want the tutorial to appear instantly when you add a 3D geometry element
 */
export const proposalHas3DGeometryFor1SecondSignal = signal<boolean>(false)

let geometryDelayTimeout: NodeJS.Timeout | null = null

effect(() => {
  const has3DGeometry = proposalHas3DGeometrySignal.value

  if (has3DGeometry && !geometryDelayTimeout) {
    geometryDelayTimeout = setTimeout(() => {
      proposalHas3DGeometryFor1SecondSignal.value = true
      geometryDelayTimeout = null
    }, 1000)
  } else if (!has3DGeometry) {
    // if you delete the building before the X seconds, we should stop the timeout
    if (geometryDelayTimeout) {
      clearTimeout(geometryDelayTimeout)
      geometryDelayTimeout = null
    }
    proposalHas3DGeometryFor1SecondSignal.value = false
  }
})
