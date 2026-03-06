import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import BasicBuildingAPI from "src/integrations/building-systems-basic-building/BasicBuildingAPI"
import type { Action } from "src/integrations/legacy-actions/ActionAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useCallback } from "preact/compat"
import type { CameraAPI } from "src/integrations/camera/CameraAPI"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { Vector3 } from "three"
import type { Child } from "@spacemakerai/element-types"
import type { FloorPlanTemplate, FloorPlanTemplates } from "./FloorPlanTemplateHooks"
import { useFloorPlanTemplates } from "./FloorPlanTemplateHooks"
import type { GeneratorFunctions } from "src/integrations/building-systems-common/FloorPlanSketcherTypes"
import { generateParking, getDefaultParkingParameters } from "src/integrations/building-systems-common/lib-generators"
import type { Polygon } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { BasicBuilding, BasicBuildingElement } from "src/integrations/building-systems-basic-building/lib/types"
import type { ParkingParams } from "src/integrations/building-systems-common/lib-generators/parkingGenerator/parking"
import type { InternalPath } from "src/lib/element/path"
import { isDefined } from "src/lib/array"
import { PROJECT_ID } from "src/core/project/project"
import type { PointXY, PolygonXY } from "src/lib/geometry/polygonXY"
import { useMemo } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import { canEditProposalSignal } from "src/core/edit-access-state"
import {
  resetSelectionSetSignal,
  selectedNodesSignal,
  setSelectionSignalValue,
} from "src/core/selection/selectionState"
import { HiddenPaths } from "src/core/hidden"
import type { SurroundingGeometriesV2 } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/floorPlansMenu3d/MeshFps"
import {
  CONSTRAINT_DEFAULT_FACE_COLOR,
  CONSTRAINT_DEFAULT_FACE_OPACITY,
} from "src/integrations/wsm-tools/wsr/materials/constraintMaterials"
import { useIsImperial } from "src/lib/unitSettings"

export type BuildingGridWithoutCameraDirection = { gridResolution: PointXY; origin: PointXY; direction: PointXY }
export type BasicPlusBuilding = BasicBuilding & {
  id: string // building path
  transform: Child["transform"]
  selectedFloors?: Record<number, boolean>
  cameraDirection?: PointXY
}

export type BufferGeometryData = {
  attributes: {
    position: Float32Array
    normal: Float32Array
    uv: Float32Array
    index: Uint32Array
  }
  boundsTreeRoot: ArrayBuffer
  boundingSphere: [number, number, number, number]
}

export type BasicFPSOutputData = {
  updatedBuildings: Record<string, BasicPlusBuilding>
  cameraData?: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }
  selectionData?: { selectedBuilding: string; selectedFloors: number[] }
}

export type BasicFPSOnCancelData = {
  cameraData?: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }
}

export type FloorPlanSketcherInputData = Omit<WebComponentInputData["data"], "floorPlanTemplates">

type WebComponentInputData = {
  data: {
    basicBuildings: BasicPlusBuilding[]
    initialBuilding: string
    initialFloorSelection?: number[]
    canEdit: boolean
    terrainData?: {
      geometry?: BufferGeometryData
      texture?: ArrayBuffer
    }
    generatorFunctions: GeneratorFunctions
    surroundingGeometriesV2?: SurroundingGeometriesV2[]
    projectId: string
    floorPlanTemplates: {
      templates: FloorPlanTemplates
      saveFloorPlanTemplates: (t: FloorPlanTemplate[]) => any
      renameFloorPlanTemplate: (templateId: string, newName: string) => any
    }
    cameraData?: { target: { x: number; y: number; z: number }; position: { x: number; y: number; z: number } }
  }
  onComplete: (e: CustomEvent<BasicFPSOutputData>) => void
  onCancel: (e: CustomEvent<BasicFPSOnCancelData>) => void
  onSave: (e: CustomEvent<BasicFPSOutputData>) => void
}

const BasicFPSWebComp = reactWcWrapper<WebComponentInputData>("sm-fps-basic-building-forma")
const WrapperStyle = `
  position: fixed;
  left: 0px;
  top: 0px;
  z-index: 100000;
  width: 100vw;
  height: 100vh;
`

export function getGeneratorFunctions(imperialUnits: boolean) {
  const generatorFunctions: GeneratorFunctions = {
    parking: (inputPolygons: PolygonXY[], parameters: ParkingParams = getDefaultParkingParameters(imperialUnits)) => {
      const polygons: Polygon[] = inputPolygons.map((polyXy) => polyXy.map((poly) => [poly.x, poly.y]))
      const { spots } = generateParking(polygons, parameters)
      const mappedSpots: PolygonXY[] = spots.map((spot) => spot.map((p) => ({ x: p[0], y: p[1] })))
      return mappedSpots
    },
  }
  return generatorFunctions
}

type FloorPlanSketcherPartialInputData = Omit<FloorPlanSketcherInputData, "initialBuilding"> & {
  // Handle the case that useGetFPSInputData gives undefined.
  initialBuilding: FloorPlanSketcherInputData["initialBuilding"] | undefined
}

export function useGetFPSInputData(): () => Promise<FloorPlanSketcherPartialInputData> {
  const imperial = useIsImperial()
  const canEditProposal = canEditProposalSignal.value
  const buildingGridFlag = true
  const proposal = elementState.currentProposalSignal.value
  const terrain = proposal.terrain
  const snapshot = proposal.snapshot

  return useCallback(async (): Promise<FloorPlanSketcherPartialInputData> => {
    const basicBuildings: BasicPlusBuilding[] = []
    const surroundingGeometriesV2: FloorPlanSketcherInputData["surroundingGeometriesV2"] = []
    for (const node of snapshot.traverseNodesDepthFirstIterable()) {
      if (node === snapshot.rootNode) continue
      const path = node.path
      const element = node.elementContainer.element
      if (!BasicBuildingAPI.isBasicBuilding(element)) {
        if (BasicBuildingAPI.isBasicFloor(element)) continue

        if (element.properties?.category === "terrain" || HiddenPaths.allHiddenPathsExpandedSignal.peek().has(path))
          continue
        const mesh = getVolumeMeshWithTerrainFallback(proposal, node.urn)
        if (mesh === undefined) continue

        surroundingGeometriesV2.push({
          position: mesh.position,
          transform: node.globalMatrix.toArray(),
          color:
            element.properties?.category == "constraints" ? CONSTRAINT_DEFAULT_FACE_COLOR : element.properties?.color,
          opacity: element.properties?.category == "constraints" ? CONSTRAINT_DEFAULT_FACE_OPACITY : undefined,
        })
        continue
      }
      if (buildingGridFlag) {
        const cameraDirection = element.representations.__INTERNAL__.data.grid?.cameraDirection
        basicBuildings.push({
          ...element.representations.__INTERNAL__.data,
          id: path,
          transform: node.child.transform,
          cameraDirection: cameraDirection,
        })
      } else {
        basicBuildings.push({ ...element.representations.__INTERNAL__.data, id: path, transform: node.child.transform })
      }
    }

    // This can be undefined if a floor is selected.
    const firstPath = selectedNodesSignal.peek().find((node) => BasicBuildingAPI.isBasicBuilding(node.element))?.path

    const { target, position } = cameraApi.getCurrentCameraState()

    const terrainData: FloorPlanSketcherInputData["terrainData"] = terrain
      ? {
          geometry: terrain.getTerrainGeometryData(),
          texture: await terrain.getTerrainBackgroundTexture().then((t) => t?.arraybuffer),
        }
      : undefined

    const generatorFunctions = getGeneratorFunctions(imperial)

    return {
      basicBuildings,
      initialBuilding: firstPath,
      canEdit: canEditProposal,
      cameraData: { position, target },
      terrainData,
      generatorFunctions,
      surroundingGeometriesV2,
      projectId: PROJECT_ID,
    }
  }, [terrain, imperial, canEditProposal, snapshot, buildingGridFlag, proposal])
}

function updateCameraOnExit(e: CustomEvent<BasicFPSOutputData | BasicFPSOnCancelData>, cameraApi: CameraAPI) {
  if (e?.detail?.cameraData) {
    const { position, target } = e.detail.cameraData
    const positionVec = new Vector3(position.x, position.y, position.z)
    const targetVec = new Vector3(target.x, target.y, target.z)
    void cameraApi.moveCamera(positionVec, targetVec)
  }
}

function getBuildingOrFloorsPathsInSelectionOnExit(
  buildingPath: InternalPath,
  updatedBuilding: BasicBuilding,
  selectionData?: BasicFPSOutputData["selectionData"],
): string[] {
  const emptyFloors = updatedBuilding.floors.map((floor) => Object.values(floor.spaces).length === 0)
  const numberOfFloors = updatedBuilding.floors.length
  const numberOfEmptyFloors = emptyFloors.reduce(
    (numberOfEmpty, empty) => (empty ? numberOfEmpty + 1 : numberOfEmpty),
    0,
  )
  if (numberOfEmptyFloors === numberOfFloors) return []
  if (selectionData?.selectedFloors === undefined || selectionData.selectedFloors.length === 0) {
    return [buildingPath]
  }

  const numberOfSelectedNonEmptyFloors = selectionData.selectedFloors.reduce(
    (count, floorIndex) => (emptyFloors[floorIndex] ? count : count + 1),
    0,
  )
  if (numberOfSelectedNonEmptyFloors === numberOfFloors - numberOfEmptyFloors) {
    return [buildingPath]
  }

  const floorIndexMap: Record<number, number> = {}
  let floorIndexWithoutEmptyFloors = 0
  for (let floorIndex = 0; floorIndex < numberOfFloors; floorIndex++) {
    if (emptyFloors[floorIndex]) continue
    floorIndexMap[floorIndex] = floorIndexWithoutEmptyFloors
    floorIndexWithoutEmptyFloors += 1
  }

  return selectionData.selectedFloors
    .map((floorIndex) => {
      const floorIndexWithoutEmptyFloors = floorIndexMap[floorIndex]
      if (floorIndexWithoutEmptyFloors === undefined) return undefined
      return buildingPath + "/" + floorIndexWithoutEmptyFloors
    })
    .filter(isDefined)
}

function useUpdateSelectionOnExit() {
  return useCallback(
    (updatedBuildings: Record<string, BasicBuilding>, selectionData?: BasicFPSOutputData["selectionData"]) => {
      if (selectionData?.selectedBuilding && updatedBuildings[selectionData.selectedBuilding]) {
        const updatedBuilding = updatedBuildings[selectionData.selectedBuilding]
        const updatedSelectionPaths = getBuildingOrFloorsPathsInSelectionOnExit(
          selectionData.selectedBuilding,
          updatedBuilding,
          selectionData,
        )
        setSelectionSignalValue(updatedSelectionPaths)
      } else {
        resetSelectionSetSignal()
      }
    },
    [],
  )
}

function removeEmptyFloorsAndExtraData(updatedBuilding: BasicBuilding): BasicBuilding | undefined {
  const floors = updatedBuilding.floors.filter((floor) => {
    return Object.values(floor.spaces).length > 0
  })
  if (floors.length === 0) return undefined
  return {
    floors,
    units: updatedBuilding.units,
    grid: updatedBuilding.grid,
  }
}

export function useUpdateBuildings() {
  const actionAPI = useActionAPI()
  const snapshot = elementState.currentSnapshot.value

  return useCallback(
    (updatedBuildings: Record<string, BasicBuilding>) => {
      const actions: Action[] = []
      for (const path of Object.keys(updatedBuildings)) {
        const oldElement = snapshot.getNode(path)?.element as BasicBuildingElement | undefined
        if (oldElement === undefined) continue
        let updatedBuilding = removeEmptyFloorsAndExtraData(updatedBuildings[path])
        if (updatedBuilding === undefined) {
          const deleteActions: { type: "delete"; path: string } = { type: "delete", path }
          actions.push(deleteActions)
          continue
        }
        // Merge in the existing building to keep any props not used in FPS, such as customProperties
        updatedBuilding = { ...oldElement.representations.__INTERNAL__.data, ...updatedBuilding }
        const items = BasicBuildingAPI.actions.createUpdateActions(path, oldElement, updatedBuilding, actionAPI)
        actions.push(...items)
      }
      actionAPI.apply("Update basic buildings from FPS", actions)
    },
    [actionAPI, snapshot],
  )
}

function getBlockSaveOnZeroSpaces(building: BasicBuilding) {
  // If zero spaces building gets deleted
  for (let floorIndex = 0; floorIndex < building.floors.length; floorIndex++) {
    const floor = building.floors[floorIndex]
    if (Object.values(floor.spaces).length > 0) return false
  }
  return true
}

export function FloorPlanSketcher({
  fpsInputData: staticInput,
  close,
}: {
  fpsInputData: FloorPlanSketcherInputData
  close: () => void
}) {
  const updateBuildings = useUpdateBuildings()
  const updateSelectionOnExit = useUpdateSelectionOnExit()
  const floorPlanTemplates = useFloorPlanTemplates()
  const fpsInputData: WebComponentInputData["data"] = useMemo(
    () => ({ ...staticInput, floorPlanTemplates }),
    [staticInput, floorPlanTemplates],
  )

  const buildingGridFlag = true

  const onComplete = useCallback(
    (e: CustomEvent<BasicFPSOutputData>) => {
      close()
      const updatedBuildings: Record<string, BasicBuilding> = {}
      const updatedBuildingGrids: Record<string, BuildingGridWithoutCameraDirection | undefined> = {}
      const updatedBuildingCameraDirections: Record<string, PointXY | undefined> = {}
      for (const [id, building] of Object.entries(e.detail.updatedBuildings)) {
        if (buildingGridFlag && building.grid && building.cameraDirection) {
          updatedBuildings[id] = {
            floors: building.floors,
            units: building.units,
            grid: { ...building.grid, cameraDirection: building.cameraDirection },
          }
        } else {
          updatedBuildings[id] = {
            floors: building.floors,
            units: building.units,
          }
        }
        updatedBuildingGrids[id] = building.grid
        updatedBuildingCameraDirections[id] = building.cameraDirection
      }
      updateBuildings(updatedBuildings)
      updateCameraOnExit(e, cameraApi)
      updateSelectionOnExit(updatedBuildings, e.detail.selectionData)
    },
    [close, updateBuildings, updateSelectionOnExit, buildingGridFlag],
  )

  const onSave = useCallback(
    (e: CustomEvent<BasicFPSOutputData>) => {
      if (e.detail.updatedBuildings === undefined) return
      const updatedBuildings: Record<string, BasicBuilding> = {}
      for (const [id, building] of Object.entries(e.detail.updatedBuildings)) {
        if (getBlockSaveOnZeroSpaces(building)) continue
        if (buildingGridFlag && building.grid && building.cameraDirection) {
          updatedBuildings[id] = {
            floors: building.floors,
            units: building.units,
            grid: { ...building.grid, cameraDirection: building.cameraDirection },
          }
        } else {
          updatedBuildings[id] = {
            floors: building.floors,
            units: building.units,
          }
        }
      }
      updateBuildings(updatedBuildings)
    },
    [buildingGridFlag, updateBuildings],
  )

  const onCancel = useCallback(
    (e: CustomEvent<BasicFPSOnCancelData>) => {
      close()
      updateCameraOnExit(e, cameraApi)
    },
    [close],
  )

  return (
    <div
      style={WrapperStyle}
      /* eslint-disable-next-line react/no-unknown-property */
      onDblClick={(e) => {
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        close()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        close()
      }}
    >
      <BasicFPSWebComp data={fpsInputData} onComplete={onComplete} onCancel={onCancel} onSave={onSave} />
    </div>
  )
}
