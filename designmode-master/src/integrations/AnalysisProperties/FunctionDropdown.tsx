import { useCallback } from "preact/hooks"
import type { FormaElement, Urn } from "@spacemakerai/element-types"
import { selectionSetSignal } from "src/core/selection/selectionState"
import type { Action } from "src/core/legacy-actions"
import { conceptualElementsApi } from "src/integrations/conceptual-squad/conceptualElementsApi"
import { parseUrn } from "src/lib/element/urn"
import { parametricElementClient } from "src/integrations/parametric-element-system/parametricElementClient"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import { canEditProposalSignal } from "src/core/edit-access-state"
import type { InternalPath } from "src/lib/element/path"
import type { UnitFunction } from "src/lib/components/FormaFunctionDropdown"
import { FormaFunctionDropdown } from "src/lib/components/FormaFunctionDropdown"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { setBuildingFunction } from "src/integrations/conceptual-squad/conceptualBuildingFunction"
import { useComputed } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import { PROJECT_ID } from "src/core/project/project"

type BuildingFunctionCapability = {
  set: (functionId: string) => Action[]
  get: (urns: Urn) => string[]
}

export const FunctionDropdown = () => {
  const canEdit = canEditProposalSignal.value

  const compatibleElementsSignal = useComputed(() => {
    const selectedPaths = selectionSetSignal.value
    const snapshot = elementState.currentSnapshot.value

    const pathsUrn: { path: InternalPath; element: FormaElement }[] = []
    selectedPaths.forEach((path) => {
      const node = snapshot.getNode(path)
      if (!node) return

      const element = node.elementContainer.element

      if (
        lineBuildingApi.isLineBuildingFormaElement(element) ||
        conceptualElementsApi.is3DSketchBuildingElement(element)
      ) {
        pathsUrn.push({ path, element })
      }
    })
    return pathsUrn
  })

  const capabilityMapSignal = useComputed(() => {
    const snapshot = elementState.currentSnapshot.value
    const lookup = snapshot.getFormaElementLookup()
    const compatibleElements = compatibleElementsSignal.value

    const capabilityMap: Record<string, BuildingFunctionCapability> = {
      ["integrate"]: {
        get: (urn: Urn) => conceptualElementsApi.getFunctionIds(urn, lookup),
        set: (functionId: string) => {
          void setBuildingFunction(
            compatibleElements.filter(({ element }) => parseUrn(element.urn).system === "integrate"),
            functionId,
          )
          return []
        },
      },
      [parametricElementClient.SYSTEM_NAME]: {
        get: (urn: Urn) => lineBuildingApi.getFunctionIds(urn, lookup),
        set: (functionId: string) =>
          lineBuildingApi.setFunctionId(
            compatibleElements.filter((e) => parseUrn(e.element.urn).system === parametricElementClient.SYSTEM_NAME),
            functionId,
          ),
      },
    }
    return capabilityMap
  })

  const selectedBuildingFunctionsSignal = useComputed(() => {
    const selectedBuildingFunctions = new Set<string>()
    compatibleElementsSignal.value.forEach(({ element }) => {
      const { urn } = element
      const { system } = parseUrn(urn)

      const buildingFunctions = capabilityMapSignal.value[system].get(urn)
      for (const buildingFunction of buildingFunctions) {
        selectedBuildingFunctions.add(buildingFunction)
      }
    })
    return Array.from(selectedBuildingFunctions).map((functionId) => ({
      functionId,
    }))
  })

  const actionAPI = useActionAPI()
  const selectedPaths = selectionSetSignal.value

  const setBuildingFunctionForElements = useCallback(
    (f: UnitFunction) => {
      const allActions: Action[] = []
      const elementSystemsToSetFunction = Array.from(
        new Set(compatibleElementsSignal.peek().map((element) => parseUrn(element.element.urn).system)),
      )
      elementSystemsToSetFunction.forEach((system) => {
        const actions = capabilityMapSignal.peek()[system].set(f.functionId!)
        allActions.push(...actions)
      })
      if (allActions.length > 0) {
        actionAPI.apply("Function dropdown - Set function", allActions)
      }
    },
    [actionAPI, capabilityMapSignal, compatibleElementsSignal],
  )

  if (selectedPaths.size !== compatibleElementsSignal.value.length) {
    return null
  }

  return selectedBuildingFunctionsSignal.value && selectedBuildingFunctionsSignal.value.length ? (
    <FormaFunctionDropdown
      projectId={PROJECT_ID}
      canEdit={canEdit}
      setBuildingFunction={setBuildingFunctionForElements}
      selectedBuildingFunctions={selectedBuildingFunctionsSignal.value}
    />
  ) : null
}
