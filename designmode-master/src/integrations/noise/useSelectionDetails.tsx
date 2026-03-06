import { useMemo } from "preact/hooks"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import { isDefined } from "src/lib/array"
import type { InternalPath } from "src/lib/element/path"
import type { FormaElement } from "@spacemakerai/element-types"
import type { Matrix4 } from "three"
import { selectedNodesSignal } from "src/core/selection/selectionState"

type SelectionDetails = {
  path: InternalPath
  geojson: BasicFeature
  element: FormaElement
  worldMatrix: Matrix4 | undefined
}
export const useSelectionDetails = () => {
  const selectedNodes = selectedNodesSignal.value

  const selected: SelectionDetails[] = useMemo(() => {
    return selectedNodes
      .map((node) => {
        const geojson = node.elementContainer.representations.footprint as BasicFeature
        if (!geojson) return
        return {
          path: node.path,
          element: node.element,
          geojson,
          worldMatrix: node.globalMatrix,
        }
      })
      .filter(isDefined)
  }, [selectedNodes])
  return selected
}
