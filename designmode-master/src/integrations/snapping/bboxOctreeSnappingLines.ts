import {
  customSnappingLinesOctreeSignal,
  snapToExternalSignal,
  userDefinedSnapToExternalSignal,
} from "./snappingPicker.state"
import { elementState } from "src/core/elements/ElementState"
import type { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import type { SnappingLine } from "./snapping"
import { HiddenPaths, scenarioHiddenSignal } from "src/core/hidden"
import { categoryStateSignal } from "src/core/categories"
import { NODE_PREDICATES } from "src/core/elements/predicates"
import { previewSetSignal } from "src/core/preview-element-state"
import { computed } from "@preact/signals"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const bboxOctreeSnappingLinesSignal = computed(() => {
  const snapToExternal = snapToExternalSignal.value
  const userDefinedSnapToExternal = userDefinedSnapToExternalSignal.value

  let octreeFromElements: BBoxOctree<SnappingLine>[]
  if (!(snapToExternal || userDefinedSnapToExternal)) {
    octreeFromElements = []
  } else {
    const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
    const previewFilter = previewSetSignal.value
    const categoryState = categoryStateSignal.value
    const scenarioHidden = scenarioHiddenSignal.value
    const proposal = elementState.currentProposalSignal.value
    const terrain = terrainSignal.value

    octreeFromElements = [...proposal.snapshot.nodes.values()]
      .filter(
        NODE_PREDICATES.allOf(
          NODE_PREDICATES.isInVisibleCategory(categoryState),
          NODE_PREDICATES.isScenarioVisibleForScenarioNode(scenarioHidden),
          NODE_PREDICATES.isNotHiddenByPreview(previewFilter),
          NODE_PREDICATES.isNotTempHidden(hiddenPaths),
        ),
      )
      .map((node) => node.bboxOctreeSnappingLines(terrain.terrainSamplerData).getOrCompute())
  }

  const customOctree = customSnappingLinesOctreeSignal.value
  if (customOctree) {
    return [...octreeFromElements, customOctree]
  }

  return octreeFromElements
})
