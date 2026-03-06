import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import { useMemo } from "preact/hooks"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import { useTranslator } from "src/i18n"
import { FloorPlansMenu } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlansMenu"
import WidthAndLength from "./WidthAndLength"
import BasicFunctionDropdown from "./BasicFunctionDropdown"
import { HeightAndNumberOfStories } from "./HeightAndNumberOfStories"
import type { BasicBuilding, BasicBuildingElement } from "src/integrations/building-systems-basic-building/lib/types"
import { useLibraryFloorPlanTemplates } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanTemplateHooks"
import { elementState } from "src/core/elements/ElementState"

import { RightMenuPanelContentGrid } from "src/lib/components/RightMenu/RightMenuPanelContentGrid"
import { selectedNodesSignal } from "src/core/selection/selectionState"

export type BasicSelection = {
  buildingPath: InternalPath
  buildingElement: BasicBuildingElement
  building: BasicBuilding
  floorIndices: number[]
  wholeBuilding?: boolean
}

function useSelections() {
  const selectedNodes = selectedNodesSignal.value
  const snapshot = elementState.currentSnapshot.value

  return useMemo(() => {
    const results: BasicSelection[] = []
    for (const node of selectedNodes) {
      const path = node.path
      const element = node.element
      if (BasicBuildingAPI.isBasicBuilding(element)) {
        results.push({
          buildingPath: path,
          buildingElement: element,
          building: element.representations.__INTERNAL__.data,
          floorIndices: Array.from({ length: element.representations.__INTERNAL__.data.floors.length }, (_, i) => i),
          wholeBuilding: true,
        })
      } else if (BasicBuildingAPI.isBasicFloor(element)) {
        const buildingPath = getParentPath(path)!
        const floorIndex = +path.slice(buildingPath.length + 1)
        const buildingElement = snapshot.getNodeOrThrow(buildingPath).element as BasicBuildingElement
        let res = results.find((r) => r.buildingPath === buildingPath)
        if (!res) {
          res = {
            buildingPath,
            buildingElement,
            building: buildingElement.representations.__INTERNAL__.data,
            floorIndices: [],
          }
          results.push(res)
        }
        res.floorIndices.push(floorIndex)
      }
    }
    return results
  }, [selectedNodes, snapshot])
}

function ParkingInFPSHint() {
  const t = useTranslator()
  return (
    <>
      <hr style="border: none; height: 1px; background-color: var(--border-color-divider-light); margin-top: 10px" />
      <RightMenuPanelContentGrid style={{ marginTop: 10 }}>
        <span>
          <span style="vertical-align: middle; font: var(--11-medium); opacity: 0.5">
            {t(($) => $.building.floorPlans.parking)}
          </span>
        </span>
        <weave-tooltip text={t(($) => $.building.tooltips.parkingEditDescription)} nub="down-right">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8ZM16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7.25 10C7.25 8.6327 7.948 8.05636 8.56646 7.5457C9.05839 7.13951 9.5 6.77488 9.5 6.08681C9.5 5.23125 8.825 4.54583 8 4.54583C7.175 4.54583 6.5 5.28472 6.5 6.11111H5C5 4.38542 6.34297 3 8 3C9.65703 3 11 4.37083 11 6.08681C11 7.08991 10.3997 7.64687 9.81923 8.18541C9.27592 8.68948 8.75 9.17743 8.75 10H7.25ZM9 12C9 12.5523 8.55229 13 8 13C7.44772 13 7 12.5523 7 12C7 11.4477 7.44772 11 8 11C8.55229 11 9 11.4477 9 12Z"
              fill="currentColor"
            ></path>
          </svg>
        </weave-tooltip>
      </RightMenuPanelContentGrid>
    </>
  )
}

export default function BasicBuildingProperties() {
  const selections = useSelections()

  // hook for downloading floor plans from library
  useLibraryFloorPlanTemplates()

  if (selections.length === 0) return null
  return (
    <>
      <HeightAndNumberOfStories selections={selections} />
      <WidthAndLength selections={selections} />
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }} />
      <BasicFunctionDropdown selections={selections} />
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }} />
      <FloorPlansMenu />
      <ParkingInFPSHint />
    </>
  )
}
