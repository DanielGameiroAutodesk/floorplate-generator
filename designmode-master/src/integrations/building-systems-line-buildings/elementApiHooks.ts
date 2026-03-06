import type { Matrix4 } from "three"
import { reverseTransformGraph } from "./helpers/shapeGraphHelpers"
import { useUpdateParametersOnLineBuildingElement } from "./quick-draw-selection-hooks"
import { useCallback } from "preact/hooks"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"
import type { Graph } from "@spacemakerai/line-buildings-shared/shapeHelpers"

export function useUpdateLineBuildingElement(path: string, worldMatrix: Matrix4) {
  const updateLineBuildingParameters = useUpdateParametersOnLineBuildingElement(path)
  return useCallback(
    (updatedGraphWorldCoordinates: Graph, parameters: LineBuildingParameters, removeElementPath?: string) => {
      const updatedGraph = reverseTransformGraph(updatedGraphWorldCoordinates, worldMatrix)
      return updateLineBuildingParameters(
        {
          ...parameters,
          graph: updatedGraph,
        },
        removeElementPath,
      )
    },
    [worldMatrix, updateLineBuildingParameters],
  )
}
