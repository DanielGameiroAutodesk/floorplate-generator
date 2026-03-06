import { useMemo } from "preact/hooks"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { useTranslator } from "src/i18n"
import type { FloorTemplate, SpaceUnits } from "./floorPlans/matchingFloorPlansInBuildings"
import {
  getInitialFloorSelectionOfBuilding,
  getUniqueFloorPlansForSelectedFloorsInBuildings,
} from "./floorPlans/matchingFloorPlansInBuildings"
import type { BasicPlusBuilding, FloorPlanSketcherInputData } from "./FloorPlanSketcher"
import { FloorPlanSketcher, useGetFPSInputData, useUpdateBuildings } from "./FloorPlanSketcher"
import { SelectedFloorPlans } from "./floorPlans/SelectedFloorPlans"
import { SeeFloorsInRemainingBuildings } from "./floorPlans/Pagination"
import { useState } from "preact/compat"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import { emptyFloorsInBuilding, emptyFloorsWithFloorPlanInBuilding } from "./floorPlans/emptyFloors"
import type { FloorFootPrintByBuildingMap } from "./floorPlans/footPrints"
import { getFloorFootPrintsByBuildings } from "./floorPlans/footPrints"
import { FloorPlansSwapMenu } from "./floorPlansSwapMenu/FloorPlansSwapMenu"
import type { FloorPlanTemplate } from "./FloorPlanTemplateHooks"
import { useFloorPlanTemplates } from "./FloorPlanTemplateHooks"
import type { BasicBuilding, BasicBuildingElement } from "src/integrations/building-systems-basic-building/lib/types"
import { floorPlanToOldFloorPlanTemplate } from "src/integrations/building-systems-basic-building/basicBuildingFloorPlans"
import { getUnitLookup } from "src/integrations/building-systems-basic-building/lib/utils"
import { useCallback } from "react"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool } from "src/core/toolsState"

import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { selectedNodesSignal } from "src/core/selection/selectionState"

const TileButtonsStyle = `
  display: flex;
  cursor: pointer;
`

const CloseIcon = ({ close }: { close: () => void }) => {
  return (
    <div style={TileButtonsStyle}>
      <weave-icon-button onClick={close}>
        <weave-close slot={"icon"} />
      </weave-icon-button>
    </div>
  )
}

const SwapIcon = ({ openSwap }: { openSwap: (top: number) => void }) => {
  return (
    <weave-icon-button
      onClick={(e) => {
        const top = e.clientY
        openSwap(top)
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.7144 5.15771L10.3644 2.65771L9.63575 3.34262L11.1938 5.00017H3.00006V6.00017H11.1938L9.63575 7.65771L10.3644 8.34262L12.7144 5.84263L13.0363 5.50017L12.7144 5.15771ZM6.3644 12.6577L4.80631 11.0002H13.0001V10.0002H4.80631L6.3644 8.34262L5.63577 7.65771L3.28577 10.1577L2.96387 10.5002L3.28577 10.8426L5.63577 13.3426L6.3644 12.6577Z"
          fill="#808080"
        />
      </svg>
    </weave-icon-button>
  )
}

const Header = ({
  deleteFloorPlans,
  showDelete,
  openSwap,
}: {
  deleteFloorPlans: () => void
  showDelete: boolean
  openSwap: (top: number) => void
}) => {
  const t = useTranslator()
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "40px",
      }}
    >
      <div style={{ font: "var(--11-medium)", cursor: "default" }}>{t(($) => $.building.floorPlans.title)}</div>
      <div style={{ display: "flex" }}>
        <weave-tooltip nub="right-center" text={t(($) => $.building.tooltips.swapFloorPlansButton)}>
          <SwapIcon openSwap={openSwap} />
        </weave-tooltip>
        {showDelete && (
          <weave-tooltip nub="right-center" text={t(($) => $.building.floorPlans.emptyFloors)}>
            <CloseIcon
              close={() => {
                deleteFloorPlans()
              }}
            />
          </weave-tooltip>
        )}
      </div>
    </span>
  )
}

function getShowDeleteInHeader(
  basicBuildings: BasicPlusBuilding[],
  floorFootPrintsByBuildings: FloorFootPrintByBuildingMap,
) {
  for (const building of basicBuildings) {
    const unitLookup = getUnitLookup(building.units)
    const footPrintsInBuilding = floorFootPrintsByBuildings[building.id]
    for (let i = 0; i < building.floors.length; i++) {
      if (building.selectedFloors && !building.selectedFloors[i]) continue
      const floor = building.floors[i]
      const footPrint = footPrintsInBuilding[i]
      const spaces = Object.values(floor.spaces)
      if (spaces.length !== footPrint.length) return true
      for (const space of spaces) {
        const unit = unitLookup(floor.id, space.id)
        if (unit?.program !== undefined || unit?.functionId) return true
      }
    }
  }
  return false
}

export function useLoadFpsWebComponent() {
  return useLazyLoadScript("/web-components/sm-floor-plan-sketcher-elements/floor-plan-sketcher.js", "building-systems")
}

export function useGetBasicBuildingWithSelectedFloorsInSelection() {
  const snapshot = elementState.currentSnapshot.value
  const selectedNodes = selectedNodesSignal.value

  const selectedBuildingsWithSelectedFloors = useMemo(() => {
    const selectedBuildingsWithSelectedFloors: Record<
      string,
      { path: string; basicBuildingElement: BasicBuildingElement; selectedFloors: Record<number, boolean> }
    > = {}
    for (const node of selectedNodes) {
      const element = node.element
      if (BasicBuildingAPI.isBasicBuilding(element)) {
        const selectedFloors: Record<number, boolean> = {}
        const numberOfFloors = element.representations.__INTERNAL__.data.floors.length
        for (let j = 0; j < numberOfFloors; j++) selectedFloors[j] = true
        selectedBuildingsWithSelectedFloors[node.path] = {
          path: node.path,
          basicBuildingElement: element,
          selectedFloors,
        }
      }
      if (BasicBuildingAPI.isBasicFloor(element)) {
        const a = node.path.split("/")
        const floorNumber = parseInt(a.pop() as string)
        const buildingPath = a.join("/")
        if (selectedBuildingsWithSelectedFloors[buildingPath] === undefined) {
          const selectedFloors: Record<number, boolean> = { [floorNumber]: true }
          const buildingElement = snapshot.getNodeOrThrow(buildingPath).element as BasicBuildingElement
          selectedBuildingsWithSelectedFloors[buildingPath] = {
            path: buildingPath,
            basicBuildingElement: buildingElement,
            selectedFloors,
          }
        } else {
          selectedBuildingsWithSelectedFloors[buildingPath].selectedFloors[floorNumber] = true
        }
      }
    }
    return selectedBuildingsWithSelectedFloors
  }, [selectedNodes, snapshot])

  return useMemo(() => {
    return Object.keys(selectedBuildingsWithSelectedFloors).map((buildingPath) => {
      const element = selectedBuildingsWithSelectedFloors[buildingPath].basicBuildingElement
      const selectedFloors = selectedBuildingsWithSelectedFloors[buildingPath].selectedFloors
      const worldTransform = snapshot.getNodeOrThrow(buildingPath).globalMatrix
      const building: BasicPlusBuilding = {
        ...element.representations.__INTERNAL__.data,
        id: buildingPath,
        transform: worldTransform.toArray(),
        selectedFloors: selectedFloors,
      }
      return building
    })
  }, [selectedBuildingsWithSelectedFloors, snapshot])
}

export const FloorPlansMenu = () => {
  const [seeAllFloors, setSeeAllFloors] = useState(false)

  const fpsWcLoaded = useLoadFpsWebComponent()
  const getFpsInputData = useGetFPSInputData()
  const [fpsInputData, setFpsInputData] = useState<FloorPlanSketcherInputData | undefined>(undefined)

  const [openSwapMenu, setOpenSwapMenu] = useState<{ top: number } | undefined>(undefined)

  const basicBuildings: BasicPlusBuilding[] = useGetBasicBuildingWithSelectedFloorsInSelection()
  const updateBuildings = useUpdateBuildings()
  const floorFootPrintsByBuildings = useMemo(() => getFloorFootPrintsByBuildings(basicBuildings), [basicBuildings])

  const maxNumberOfStacks = 4
  const numberOfRestStacks = seeAllFloors ? 0 : Math.max(basicBuildings.length - maxNumberOfStacks, 0)
  const selectedFloorPlansByBuilding = useMemo(() => {
    return getUniqueFloorPlansForSelectedFloorsInBuildings(
      basicBuildings,
      maxNumberOfStacks,
      seeAllFloors,
      floorFootPrintsByBuildings,
    )
  }, [basicBuildings, floorFootPrintsByBuildings, seeAllFloors])

  const showDeleteInHeader = useMemo(() => {
    return getShowDeleteInHeader(basicBuildings, floorFootPrintsByBuildings)
  }, [basicBuildings, floorFootPrintsByBuildings])

  const { saveFloorPlanTemplates } = useFloorPlanTemplates()
  const closeSketcher = useCallback(() => setFpsInputData(undefined), [])

  return (
    <>
      <RightMenuPanel style={{ paddingBottom: "0" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <Header
            deleteFloorPlans={() => {
              const updatedBuildings: Record<string, BasicBuilding> = {}
              for (const building of basicBuildings) {
                const footPrints = floorFootPrintsByBuildings[building.id]
                updatedBuildings[building.id] = emptyFloorsInBuilding(building, footPrints)
              }
              updateBuildings(updatedBuildings)
            }}
            showDelete={showDeleteInHeader}
            openSwap={(top) => {
              exitCurrentTool()
              setOpenSwapMenu({ top })
            }}
          />
          <SelectedFloorPlans
            selectedFloorPlansByBuilding={selectedFloorPlansByBuilding}
            editFloor={(buildingIndex: number, spaceUnits: SpaceUnits) => {
              if (!fpsWcLoaded) return
              async function run() {
                const building = basicBuildings[buildingIndex]
                const initialBuilding = building.id
                const initialFloorSelection = getInitialFloorSelectionOfBuilding(building, spaceUnits)
                const data = await getFpsInputData()
                exitCurrentTool()
                setFpsInputData({ ...data, initialBuilding, initialFloorSelection })
              }
              void run()
            }}
            emptyFloor={(buildingIndex: number, spaceUnits: SpaceUnits) => {
              const building = basicBuildings[buildingIndex]
              const footPrints = floorFootPrintsByBuildings[building.id]
              const updatedBuilding = emptyFloorsWithFloorPlanInBuilding(building, spaceUnits, footPrints)
              updateBuildings({ [building.id]: updatedBuilding })
            }}
            addToLibrary={(name: string, floorTemplate: FloorTemplate) => {
              const template: FloorPlanTemplate = floorPlanToOldFloorPlanTemplate(name, floorTemplate)
              saveFloorPlanTemplates([template])
            }}
          />
          <SeeFloorsInRemainingBuildings
            numberOfRestStacks={numberOfRestStacks}
            seeAllFloors={seeAllFloors}
            setSeeAllFloors={setSeeAllFloors}
          />
        </div>
      </RightMenuPanel>
      {fpsInputData && <FloorPlanSketcher fpsInputData={fpsInputData} close={closeSketcher} />}
      {openSwapMenu && (
        <FloorPlansSwapMenu
          openData={openSwapMenu}
          close={() => {
            setOpenSwapMenu(undefined)
          }}
          apply={(updatedBuildings: Record<string, BasicPlusBuilding>) => {
            updateBuildings(updatedBuildings)
          }}
          basicBuildings={basicBuildings}
          floorFootPrintsByBuildings={floorFootPrintsByBuildings}
        />
      )}
    </>
  )
}
