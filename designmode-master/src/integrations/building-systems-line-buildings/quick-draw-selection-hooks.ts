import { lineBuildingApi } from "./lineBuildingApi"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback } from "preact/compat"
import { elementState } from "src/core/elements/ElementState"
import type { Action } from "src/core/legacy-actions"
import type { LineBuildingParameters } from "@spacemakerai/line-buildings-shared/lineBuildingParameters"

export function useUpdateParametersOnLineBuildingElement(path: string | undefined) {
  const actionApi = useActionAPI()
  const snapshot = elementState.currentSnapshot.value

  return useCallback(
    (updatedParameters: LineBuildingParameters, removeElementPath?: string) => {
      if (!path) return
      const currentElement = snapshot.getNode(path)?.elementContainer.element
      if (!currentElement) return
      const { geometry, element } = lineBuildingApi.update(updatedParameters, currentElement)

      const actions: Action[] = [
        {
          type: "update",
          element,
          path: path,
          representations: {
            volumeMesh: geometry,
            footprint: undefined,
            terrainShape: undefined,
            terrainTexture: undefined,
            buildingFloors3DSketch_UNSTABLE: undefined,
          },
          persisted: false,
        },
      ]
      if (removeElementPath) actions.push({ type: "delete", path: removeElementPath })

      actionApi.apply("Update line building", actions, {
        elementCategory: "building",
        numElements: 1,
        eventType: "update",
        sectionToggle: updatedParameters.sectionToggle,
        ...(updatedParameters.functionId ? { functionId: updatedParameters.functionId } : {}),
        width: updatedParameters.width,
        floorHeight: updatedParameters.floorHeight,
        lineAlignment: updatedParameters.lineAlignment,
        numberOfFloors: updatedParameters.numberOfFloors,
        minSubBuildingLength: updatedParameters.minSubBuildingLength,
      })
    },
    [actionApi, path, snapshot],
  )
}
