import { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import type { SnapInfo } from "./snappingEngine"
import { createExtendedAndRightAngleSnappingLines } from "./utils/createSnapLines"
import type { SnappingLine } from "./snapping"
import { explicitSignal } from "src/lib/signal"
import { computed } from "@preact/signals"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export const [selectedSnappingLinesSignal, setSelectedSnappingLinesSignalValue] = explicitSignal<SnappingLine[]>([])

export const [userDefinedSnapToGuidesSignal, setUserDefinedSnapToGuidesSignalValue] = explicitSignal(true)

export const [selectedInternalSnappingLinesSignal, setSelectedInternalSnappingLinesSignalValue] = explicitSignal<
  SnappingLine[]
>([])

export const selectedDerivedSnappingLinesSignal = computed<SnappingLine[]>(() => {
  if (!userDefinedSnapToGuidesSignal.value) return []

  const terrainSamplerData = terrainSignal.value.terrainSamplerData //TODO: pass terrain into tool, keep separate state
  return createExtendedAndRightAngleSnappingLines(
    [...selectedInternalSnappingLinesSignal.value, ...selectedSnappingLinesSignal.value],
    terrainSamplerData,
  )
})

export const [toolSnappingLinesCandidatesSignal, setToolSnappingLinesCandidatesSignalValue] = explicitSignal<
  SnappingLine[]
>([])

export const [customSnappingLinesSignal, setCustomSnappingLinesSignalValue] = explicitSignal<SnappingLine[]>([])

export const [snapToExternalSignal, setSnapToExternalSignalValue] = explicitSignal(true)

export const [userDefinedSnapToExternalSignal, setUserDefinedSnapToExternalSignalValue] = explicitSignal(true)

export const customSnappingLinesOctreeSignal = computed<BBoxOctree<SnappingLine> | undefined>(() => {
  const lines: SnappingLine[] = customSnappingLinesSignal.value
  if (lines.length) {
    const octree = new BBoxOctree<SnappingLine>()
    lines.forEach((l) => {
      l.segments.forEach((seg) => octree.set(seg.bbox, l))
    })
    return octree
  }
  return undefined
})

export const [currentSnapInfoSignal, setCurrentSnapInfoSignalValue] = explicitSignal<SnapInfo | undefined>(undefined)

export const [lockedSnapLineSignal, setLockedSnapLineSignalValue] = explicitSignal<SnappingLine | undefined>(undefined)

export const [enableSnappingSignal, setEnableSnappingSignalValue] = explicitSignal<boolean>(true)

const ROUND_ROBIN_SIZE = 3
export const roundRobinNewSnapLine = (currentSelected: SnappingLine[], newLine: SnappingLine) =>
  currentSelected
    .filter((current) => newLine !== current)
    .concat(newLine)
    .slice(-ROUND_ROBIN_SIZE)
