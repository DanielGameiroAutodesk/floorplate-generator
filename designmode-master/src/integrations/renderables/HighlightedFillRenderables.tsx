import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { useState } from "preact/hooks"
import { getHighlightFillForPaths, HighlightMesh } from "./HighlightMesh"
import { useLayoutEffect } from "preact/compat"
import { highlightedFillSignal } from "src/core/selection/selectionState"
import { previewSetSignal } from "src/core/preview-element-state"
import { computed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import type { Urn } from "forma-elements"
import type { BufferGeometry } from "three"
import type { InternalPath } from "src/lib/element/path"
import { getPathToUrn } from "src/lib/element/path"
import { Set_intersection } from "src/lib/set"

const bufferGeometrySignal = computed<Map<Urn, BufferGeometry>>(() => {
  const result = new Map<Urn, BufferGeometry>()
  const snapshot = elementState.currentSnapshot.value
  for (const [urn, elementC] of snapshot.elements) {
    const geo = elementC.representations.volumeMesh
    if (geo) result.set(urn, geo)
  }
  return result
})

const pathToUrnSignal = computed<Map<InternalPath, Urn>>(() => {
  const elements = elementState.currentSnapshot.value.getFormaElementLookup()
  const rootUrn = elementState.currentSnapshot.value.rootUrn

  return getPathToUrn(elements, rootUrn)
})

const highlightedFillForPathsSignal = computed(() => {
  // TODO: Consider passing snapshot forward instead as soon as we've moved preview over to snapshot.
  return getHighlightFillForPaths(
    Set_intersection(highlightedFillSignal.value, new Set(pathToUrnSignal.value.keys())),
    elementState.currentSnapshot.value.rootUrn,
    elementState.currentSnapshot.value.getFormaElementLookup(),
    bufferGeometrySignal.value,
    pathToUrnSignal.value,
    {
      ignore: previewSetSignal.value,
    },
  )
})

export default function HighlightedFillRenderables() {
  const [mesh] = useState(new HighlightMesh())

  const highlighted = highlightedFillForPathsSignal.value

  useLayoutEffect(() => {
    mesh.update(highlighted)
  }, [highlighted, mesh])

  useObjectLifecycle(mesh)

  return null
}
