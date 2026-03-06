import type { FormaElement } from "@spacemakerai/element-types"
import type { Matrix4 } from "three"
import { isDefined } from "src/lib/array"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { isBasicFeature } from "src/lib/geometry/geometryTypes"
import type { InternalPath } from "src/lib/element/path"
import { useMemo } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { selectedPathsInCurrentProposalAsArraySignal } from "./selectionState"

export type BasicFeaturePathInfo = {
  path: InternalPath
  geojson: BasicFeature
  element: FormaElement
  worldMatrix: Matrix4 | undefined
}

export function useSelectedPathInfoState(): BasicFeaturePathInfo[] {
  const selection = selectedPathsInCurrentProposalAsArraySignal.value
  const snapshot = elementState.currentSnapshot.value
  return useMemo((): BasicFeaturePathInfo[] => {
    return selection
      .map((path): BasicFeaturePathInfo | undefined => {
        const node = snapshot.getNode(path)
        if (!node) return undefined
        const geojson = node.elementContainer.representations.footprint

        if (!geojson || !isBasicFeature(geojson)) return undefined

        return {
          path,
          element: node.element,
          worldMatrix: node.globalMatrix,
          geojson,
        }
      })
      .filter(isDefined)
  }, [selection, snapshot])
}
