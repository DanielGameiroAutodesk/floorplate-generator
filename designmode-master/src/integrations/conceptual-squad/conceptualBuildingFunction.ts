import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import type { FormaElement } from "forma-elements"
import ArrayUtils from "src/lib/array"
import { elementState } from "src/core/elements/ElementState"
import type { FilledBuilding3d } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"
import type { Unit } from "src/integrations/building-systems-basic-building/lib/types"
import { Analytics, analyticsAndBreadcrumbsForActions } from "src/core/analytics"
import { loadRepresentationJson } from "@spacemakerai/elements-client"
import { updateElementsBasedOnNewBuildingRep } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingWrapper"
import { getGraphSpacesUpdateUnits } from "src/integrations/wsm-tools/building/floorPlanUtils"
import type { Proposal } from "src/core/elements/Proposal"
import { getElementsClient } from "src/core/elements-loading/loading"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

export async function setBuildingFunction(
  elementsToUpdate: { path: InternalPath; element: FormaElement }[],
  functionId: string,
) {
  const proposal = elementState.currentProposalSignal.peek()

  if (elementsAreInSameSubtree(elementsToUpdate)) {
    throw new Error(
      "Trying to set function on both building and floor element at the same time. Select one level at a time",
    )
  }

  //In the new element state, we want to do one `updateElement` call for each building (as that is the root node of each sub tree), which means we need to group the elements by building.
  const elementsByBuilding = ArrayUtils.groupBy(elementsToUpdate, ({ path }) => buildingPath(path, proposal))

  // Track function setting event
  Analytics.track(
    EventName.Edit,
    {
      feature_category: FeatureCategory.DesignTool,
      feature: "building_function",
      object_type: "building",
    },
    { action: "set_function", function_id: functionId },
  )

  analyticsAndBreadcrumbsForActions("Function dropdown - Set function")

  for (const [buildingPath, elementsToChangeFunctionOn] of elementsByBuilding.entries()) {
    const buildingNode = elementState.currentSnapshot.peek().getNode(buildingPath)
    if (!buildingNode) {
      throw new Error("Couldn't find building node when setting function on 3D sketch buildings or floors")
    }

    //If the function is set on the building, then that's the same as setting it on all floors
    const didUserSetFunctionOnBuilding = elementsToChangeFunctionOn.find((e) => e.path === buildingPath)
    const newFloorPaths = didUserSetFunctionOnBuilding
      ? (buildingNode.elementContainer.element.children?.map((c) => `${buildingPath}/${c.key}`) ?? [])
      : elementsToChangeFunctionOn.filter(({ path }) => getParentPath(path) === buildingPath).map((e) => e.path) //Floor == child of building

    let newBuildingRep: FilledBuilding3d | undefined

    // Helper function to set units correctly in the newBuildingRep.
    const setUnitsInBuildingRep = (buildingRep: FilledBuilding3d) => {
      let newUnits = buildingRep.units.map((unit: Unit) => {
        let newBuildingUnit = { ...unit }

        newFloorPaths.forEach((path) => {
          const floorIndex = proposal.snapshot.getNode(path)?.elementContainer.element.properties?.floorIndex
          const floorId = buildingRep.floors3d[floorIndex].id

          if (
            newBuildingUnit.spaces.every((space) => {
              return space.floorId === floorId
            })
          ) {
            newBuildingUnit.functionId = functionId
          }
        })

        return newBuildingUnit
      })

      newBuildingRep = { ...buildingRep, units: newUnits }
    }

    const previousBuildingRepContainer =
      buildingNode.elementContainer.element.representations?.buildingFloors3DSketch_UNSTABLE

    if (previousBuildingRepContainer) {
      const previousBuildingRep = await loadRepresentationJson(
        buildingNode.elementContainer.element.urn,
        previousBuildingRepContainer,
        getElementsClient(),
      )
      if ("units" in previousBuildingRep) {
        setUnitsInBuildingRep(previousBuildingRep)
      } else {
        // Make units and then set them. Note this makes default floor plans always
        // since no floor path is given. We don't expect the code to get here though.
        const units: Unit[] = []
        newBuildingRep = {
          floors3d: previousBuildingRep.floors3d.map((floor3d, index: number) => {
            const floorId = index.toString()
            const { unitsGraph } = getGraphSpacesUpdateUnits(
              proposal.snapshot,
              floor3d.floorOutline,
              index,
              floorId,
              units,
            )

            return {
              //Discussions on TODOs below here https://spacemakercore.slack.com/archives/C040M2UN41Z/p1711138835313959
              //TODO need to agree on this value. Also, for now keeping as string. Discuss with building systems
              id: floorId,
              elevation: floor3d?.elevation,
              //TODO, his seems not needed? Discuss with building systems
              //TODO next elevation - current elev
              //height: 3,
              floorOutline: floor3d.floorOutline,
              graph: unitsGraph.graph,
              spaces: unitsGraph.spaces,
            }
          }),
          units,
        }

        // Now set the function id.
        setUnitsInBuildingRep(newBuildingRep)
      }
    }

    if (newBuildingRep) {
      updateElementsBasedOnNewBuildingRep(buildingPath, newBuildingRep, functionId)
    }
  }
}

function elementsAreInSameSubtree(compatibleElements: { path: InternalPath }[]) {
  compatibleElements.forEach(({ path }) => {
    const parentPath = getParentPath(path)
    compatibleElements.forEach(({ path: otherPath }) => {
      if (parentPath === otherPath) {
        return true
      }
    })
  })
  return false
}

function buildingPath(buildingOrFloorPath: InternalPath, proposal: Proposal) {
  const parentPath = getParentPath(buildingOrFloorPath)
  if (parentPath === proposal.path.value || parentPath === proposal.base.path.value) {
    return buildingOrFloorPath
  }
  if (!parentPath) {
    throw new Error("Could not find parent path")
  }
  return parentPath
}
