import { useErrorBoundary, useMemo } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { BasicBuildingElement } from "./lib/types"
import BasicBuildingAPI from "./BasicBuildingAPI"
import { elementState } from "src/core/elements/ElementState"
import { selectedNodesSignal } from "src/core/selection/selectionState"
import { getTranslator, useTranslator } from "src/i18n"

function useSelectedBuildingsAndFloors() {
  const selectedNodes = selectedNodesSignal.value
  const snapshot = elementState.currentSnapshot.value

  return useMemo(() => {
    const selectedBuildings: { path: string; buildingElement: BasicBuildingElement }[] = []
    const selectedFloors: { path: string; buildingElement: BasicBuildingElement; floorIndex: number }[] = []

    for (const node of selectedNodes) {
      const element = node.element
      if (BasicBuildingAPI.isBasicBuilding(element)) {
        selectedBuildings.push({
          path: node.path,
          buildingElement: element,
        })
      }
      if (BasicBuildingAPI.isBasicFloor(element)) {
        const a = node.path.split("/")
        const floorNumber = parseInt(a.pop() as string)
        const buildingPath = a.join("/")
        const buildingElement = snapshot.getNodeOrThrow(buildingPath).element as BasicBuildingElement
        selectedFloors.push({
          path: buildingPath,
          buildingElement: buildingElement,
          floorIndex: floorNumber,
        })
      }
    }
    return { selectedBuildings, selectedFloors }
  }, [selectedNodes, snapshot])
}

function BasicBuildingRightClickOptions() {
  const actionAPI = useActionAPI()
  const { selectedBuildings, selectedFloors } = useSelectedBuildingsAndFloors()

  const t = useTranslator()

  let menuElements = []
  if (selectedBuildings.length === 1 && selectedFloors.length === 0) {
    menuElements.push(
      <forma-context-menu-item
        text={t(($) => $.building.addFloor)}
        onClick={() => {
          const path = selectedBuildings[0].path
          const buildingElement = selectedBuildings[0].buildingElement
          const updatedBuilding = BasicBuildingAPI.updateNumberOfFloors(
            buildingElement,
            buildingElement.representations.__INTERNAL__.data.floors.length + 1,
          )
          const actions = BasicBuildingAPI.actions.createUpdateActions(
            path,
            buildingElement,
            updatedBuilding,
            actionAPI,
          )
          actionAPI.apply("Add floor", actions)
        }}
      />,
    )
  }

  if (
    selectedBuildings.length === 0 &&
    selectedFloors.length > 0 &&
    selectedFloors.every((f) => f.path === selectedFloors[0].path)
  ) {
    menuElements.push(
      <forma-context-menu-item
        text={selectedFloors.length === 1 ? "Duplicate Floor" : "Duplicate Floors"}
        onClick={() => {
          const { buildingElement, path } = selectedFloors[0]
          const updatedBuilding = BasicBuildingAPI.duplicateFloors(
            buildingElement,
            selectedFloors.map((f) => f.floorIndex),
          )
          const actions = BasicBuildingAPI.actions.createUpdateActions(
            path,
            buildingElement,
            updatedBuilding,
            actionAPI,
          )
          actionAPI.apply("Duplicate floors", actions)
        }}
      />,
    )
  }
  if (menuElements.length > 0) {
    menuElements.push(<forma-context-menu-divider />)
    return <>{menuElements}</>
  } else {
    return null
  }
}

export function BasicBuildingRightClickOptionsWrapper() {
  const [error, resetError] = useErrorBoundary((error, errorInfo) => {
    console.error("Basic building context menu error: ", error)
    console.warn(errorInfo)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.errors.building.failedRightClickOption),
      status: "warning",
    })
    captureException(error, { tags: { owner: "building-systems" }, extra: { errorInfo } })
  })
  if (error) {
    resetError()
    return null
  }
  return <BasicBuildingRightClickOptions />
}
