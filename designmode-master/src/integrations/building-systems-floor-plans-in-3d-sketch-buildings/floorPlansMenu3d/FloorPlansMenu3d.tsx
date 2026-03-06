import { useCallback, useMemo } from "preact/hooks"
import type { FixedFloor, MeshFpsInputData } from "./MeshFps"
import { MeshFps, useGetInputDataToMeshFps } from "./MeshFps"
import { SelectFloorPlanList } from "./SelectFloorPlanList"
import { emptySelectedFloors, isBuildingEmpty } from "./emptyFloors"
import type { BuildingGrid, Space, Unit } from "src/integrations/building-systems-basic-building/lib/types"
import type { Graph } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type {
  Building3d,
  FilledFloor3d,
  Sketch3dBuilding,
} from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"
import { polygonWithHolesToXY } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
import { useTranslator } from "src/i18n"
import { useIntegrated3DSketchAPI } from "src/integrations/wsm-tools/wsr/api/Integrated3DSketchAPI"
import { save3dSketch } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { getBuildingFloorsForPath } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingWrapper"
import { atom, useRecoilState } from "recoil"
import { exitCurrentTool } from "src/core/toolsState"

import { RightMenuPanel } from "src/lib/components/RightMenu/RightMenuPanel"
import { elementState } from "src/core/elements/ElementState"
import { Analytics, analyticsAndBreadcrumbsForActions } from "src/core/analytics"
import {
  deleteFloorCollection,
  undoFloorCollectionDelete,
} from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { lookupWSMObject } from "src/integrations/wsm-tools/wsr/api/mapping"
import type { WSMDetailsForElementPath } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"

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
const Header = ({ deleteFloorPlans, showDelete }: { deleteFloorPlans: () => void; showDelete: boolean }) => {
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

export function getFloorPlan(building: Building3d | undefined): MeshBuildingFloorPlans | undefined {
  if (building === undefined) return undefined
  if (!("units" in building)) return undefined
  const floors = building.floors3d
  return { units: building.units, floors }
}

export function getFixedFloors(building: Building3d | undefined): FixedFloor[] | undefined {
  if (building === undefined) return undefined
  return building.floors3d.map((floor) => {
    const outline: PolygonWithHolesXY[] = floor.floorOutline.map((polygonWithHoles) => {
      const [polygon, ...holes] = polygonWithHoles
      return polygonWithHolesToXY({ polygon, holes })
    })
    const fixedFloor: FixedFloor = { ...floor, outline }
    return fixedFloor
  })
}

function addFloorPlanToBuilding(
  emptyBasicBuilding3d: Building3d,
  floorPlans: MeshBuildingFloorPlans | undefined,
): Building3d {
  if (floorPlans === undefined) return emptyBasicBuilding3d
  const floors: FilledFloor3d[] = emptyBasicBuilding3d.floors3d.map((floor, i) => {
    return { ...floor, ...floorPlans.floors[i] }
  })
  return { floors3d: floors, units: floorPlans.units }
}

type Spaces = Record<string, Space>
type Floor = { id: string; graph: Graph; spaces: Spaces }
export type MeshBuildingFloorPlans = { floors: Floor[]; units: Unit[]; grid?: BuildingGrid }

export const fps3dInputDataAtom = atom<undefined | MeshFpsInputData["data"]>({
  key: "fps3dInputDataAtom",
  default: undefined,
})

type FloorPlansMenu3dProps = {
  selectedBuildingPath: string
  sketch3dBuildings: { [path: string]: Sketch3dBuilding }
  updateFloorPlansInBuildings: (
    updatedFloorPlans: { [buildingPath: string]: Building3d },
    onComplete?: () => void,
  ) => void
  selectedFloorIndices: number[]
}
export const FloorPlansMenu3d = ({
  selectedBuildingPath,
  sketch3dBuildings,
  updateFloorPlansInBuildings,
  selectedFloorIndices,
}: FloorPlansMenu3dProps) => {
  const getInputDataToMeshFps = useGetInputDataToMeshFps()

  const selectedBuilding = sketch3dBuildings[selectedBuildingPath]
  const basicBuilding3d = selectedBuilding?.representations?.building3d

  const floorPlans = getFloorPlan(basicBuilding3d)
  const fixedFloors = getFixedFloors(basicBuilding3d)

  const [fpsInputData, setFpsInputData] = useRecoilState(fps3dInputDataAtom)

  const emptyBuilding = useMemo(() => {
    return isBuildingEmpty(floorPlans)
  }, [floorPlans])

  const floorUrns = useMemo(() => selectedBuilding?.children?.map((child) => child.urn), [selectedBuilding])

  const i3dsAPI = useIntegrated3DSketchAPI()

  const emptyFloorPlans = useCallback(
    (floorNumbers: number[]) => {
      if (floorPlans === undefined) return
      if (basicBuilding3d === undefined) return

      let wsmGroupInstancePathEdited: WSM.GroupInstancePathInterface | null = null

      // if in 3DS mode then need to save in case of unsaved changes and need to manually
      // bring back floor collection because the save method configured assumes still editing
      // so the floor collection will be left deleted and we need it in updateFloorPlansInBuildings.
      // also since still in 3DS mode after emptying the floor plan need to delete floor collection
      // once the update to element is complete.
      if (i3dsAPI.inI3DSMode) {
        save3dSketch()

        const wsmDetailsForElementPath: WSMDetailsForElementPath | undefined = lookupWSMObject(selectedBuildingPath)
        wsmGroupInstancePathEdited = wsmDetailsForElementPath?.groupInstancePath ?? null

        // we know for sure there is a group instance path because we just saved it
        undoFloorCollectionDelete(wsmGroupInstancePathEdited!)
      }

      const updatedFloorPlan = emptySelectedFloors(floorPlans, floorNumbers, fixedFloors!)
      const updatedBuilding = addFloorPlanToBuilding(basicBuilding3d, updatedFloorPlan)

      updateFloorPlansInBuildings({ [selectedBuildingPath]: updatedBuilding }, () => {
        // if wsmGroupInstancePathEdited is not null then we are still in i3DS which means the floor collection
        // needs to be deleted so that editing can continue
        if (wsmGroupInstancePathEdited !== null) {
          deleteFloorCollection(wsmGroupInstancePathEdited)
        }
      })
    },
    [floorPlans, fixedFloors, selectedBuildingPath, basicBuilding3d, i3dsAPI.inI3DSMode, updateFloorPlansInBuildings],
  )

  if (selectedBuilding === undefined || floorUrns === undefined || fixedFloors === undefined) return <></>
  return (
    <>
      <hr style={{ border: "none", height: "1px", backgroundColor: "var(--border-color-divider-light)" }} />
      <RightMenuPanel>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <Header
            showDelete={!emptyBuilding}
            deleteFloorPlans={() => {
              // don't track this with new tracking schema
              analyticsAndBreadcrumbsForActions("empty all floor plans")

              const allFloorNumbers = []
              for (let i = 0; i < (floorPlans?.floors.length ?? 0); i++) {
                allFloorNumbers.push(i)
              }
              emptyFloorPlans(allFloorNumbers)
            }}
          />
          <SelectFloorPlanList
            floors={fixedFloors}
            floorPlans={floorPlans}
            floorIds={floorUrns}
            editFloors={(floorNumbers: number[]) => {
              async function run() {
                // If in 3d sketch
                if (i3dsAPI.inI3DSMode) {
                  // Save 3d sketch
                  save3dSketch()
                  // Exit i3ds
                  exitCurrentTool()
                  // Get updated building info
                  const newBuildingFloors = getBuildingFloorsForPath(
                    elementState.currentSnapshot.peek(),
                    selectedBuildingPath,
                  )
                  // If its not undefined, use in fps
                  if (newBuildingFloors) sketch3dBuildings[selectedBuildingPath] = newBuildingFloors
                }
                const meshFpsInputData = await getInputDataToMeshFps(
                  selectedBuildingPath,
                  floorNumbers,
                  sketch3dBuildings,
                )
                Analytics.trackSelectTool("3dSketch", "Floor Plan Sketcher", "right_panel", "design-tool")
                setFpsInputData(meshFpsInputData)
              }
              void run()
            }}
            emptyFloors={(floorNumbers) => {
              // don't track this with new tracking schema
              analyticsAndBreadcrumbsForActions("empty floor plan")
              emptyFloorPlans(floorNumbers)
            }}
            floorIndices={selectedFloorIndices}
          />
          {fpsInputData && (
            <MeshFps
              fpsInputData={fpsInputData}
              setFpsInputData={setFpsInputData}
              updateFloorPlans={(data, onComplete) => {
                const updatedBuildings: { [buildingPath: string]: Building3d } = {}
                for (const buildingPath of Object.keys(data)) {
                  const basicBuilding3d = sketch3dBuildings[buildingPath]
                  if (basicBuilding3d === undefined) continue
                  const updatedFloorPlan: MeshBuildingFloorPlans = data[buildingPath].floorPlans
                  updatedBuildings[buildingPath] = {
                    ...addFloorPlanToBuilding(basicBuilding3d.representations.building3d, updatedFloorPlan),
                    grid: data[buildingPath].grid,
                  }
                }
                // don't track this with new tracking schema
                analyticsAndBreadcrumbsForActions("update floor plan")
                updateFloorPlansInBuildings(updatedBuildings, onComplete)
              }}
            />
          )}
        </div>
      </RightMenuPanel>
      <hr
        style={{
          border: "none",
          height: "1px",
          marginTop: "11px",
          backgroundColor: "var(--border-color-divider-light)",
        }}
      />
    </>
  )
}
