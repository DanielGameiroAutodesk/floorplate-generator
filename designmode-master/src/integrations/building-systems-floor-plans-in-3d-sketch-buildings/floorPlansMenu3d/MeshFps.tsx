import type { Child, Transform } from "@spacemakerai/element-types"
import type { GeneratorFunctions } from "src/integrations/building-systems-common/FloorPlanSketcherTypes"
import reactWcWrapper from "@spacemakerai/react-wc-wrapper"
import useLazyLoadScript from "src/lib/useLazyLoadScript"
import type { CameraAPI } from "src/integrations/camera/CameraAPI"
import { cameraApi } from "src/integrations/camera/CameraAPI"
import { PROJECT_ID } from "src/core/project/project"
import { useCallback } from "react"
import { Vector3 } from "three"
import { useFloorPlanTemplates } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanTemplateHooks"
import type { MeshBuildingFloorPlans } from "./FloorPlansMenu3d"
import { getFixedFloors, getFloorPlan } from "./FloorPlansMenu3d"
import type { Sketch3dBuilding } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"
import { getGeneratorFunctions } from "src/integrations/building-systems-basic-building/floorPlansMenu/FloorPlanSketcher"
import type { PolygonWithHolesXY } from "src/lib/geometry/polygonXY"
import { elementState } from "src/core/elements/ElementState"
import { getVolumeMeshWithTerrainFallback } from "src/core/volume-mesh"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { setSelectionSignalValue } from "src/core/selection/selectionState"
import { HiddenPaths } from "src/core/hidden"
import { getBuildingFloorsForPath } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingWrapper"
import type { BuildingGrid } from "src/integrations/building-systems-basic-building/lib/types"
import {
  CONSTRAINT_DEFAULT_FACE_COLOR,
  CONSTRAINT_DEFAULT_FACE_OPACITY,
} from "src/integrations/wsm-tools/wsr/materials/constraintMaterials"
import { useIsImperial } from "src/lib/unitSettings"

export type FixedFloor = {
  outline: PolygonWithHolesXY[]
  elevation: number
  height?: number
}

type MeshBuilding = {
  id: string
  floors: FixedFloor[]
  floorPlans?: MeshBuildingFloorPlans
  transform: Child["transform"]
  volumeMeshes: { position: Float32Array }[]
  grid?: BuildingGrid
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

type UpdatedBuildingsData = Record<string, { floorPlans: MeshBuildingFloorPlans }>
export type MeshFpsOutputData = {
  updatedBuildingsData: UpdatedBuildingsData
  cameraData?: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }
  selectionData?: { selectedBuilding: string; selectedFloors: number[] }
}

export type SurroundingGeometriesV2 = {
  position: Float32Array
  transform: Transform
  color?: string
  opacity?: number
}

export type MeshFpsInputData = {
  data: {
    meshBuildings: MeshBuilding[]
    initialBuilding: string
    initialFloorSelection?: number[]
    canEdit: boolean
    terrainData?: {
      geometry?: BufferGeometryData
      texture?: ArrayBuffer
    }
    generatorFunctions?: GeneratorFunctions
    surroundingGeometriesV2?: SurroundingGeometriesV2[]
    projectId: string
  }
  onComplete: (e: CustomEvent<MeshFpsOutputData>) => void
  onCancel: (e: CustomEvent) => void
  onSave: (e: CustomEvent<MeshFpsOutputData>) => void
}

const MeshFPSWebComp = reactWcWrapper<MeshFpsInputData>("sm-fps-mesh-building-forma")
const WrapperStyle = `
  position: fixed;
  left: 0px;
  top: 0px;
  z-index: 100000;
  width: 100vw;
  height: 100vh;
`

export function useLoadFpsWebComponent() {
  return useLazyLoadScript("/web-components/sm-floor-plan-sketcher-elements/floor-plan-sketcher.js", "building-systems")
}

export function useGetInputDataToMeshFps(): (
  selectedBuildingPath: string,
  selectedFloorNumbers: number[],
  sketch3dBuildings: { [path: string]: Sketch3dBuilding },
) => Promise<MeshFpsInputData["data"] | undefined> {
  const canEditProposal = canEditProposalSignal.value
  const floorPlanTemplates = useFloorPlanTemplates()
  const imperial = useIsImperial()

  return useCallback(
    async (
      selectedBuildingPath: string,
      selectedFloorNumbers: number[],
      sketch3dBuildings: { [path: string]: Sketch3dBuilding },
    ) => {
      const proposal = elementState.currentProposalSignal.peek()
      const sketch3dBuildingPaths = Object.keys(sketch3dBuildings)

      const meshBuildings: MeshBuilding[] = []
      for (const buildingPath of sketch3dBuildingPaths) {
        const sketch3dBuilding = sketch3dBuildings[buildingPath]
        const floorPlans = getFloorPlan(sketch3dBuilding.representations.building3d)
        const fixedFloors = getFixedFloors(sketch3dBuilding.representations.building3d)
        if (fixedFloors === undefined) continue

        const floorUrns = sketch3dBuilding.children.map((child) => child.urn)
        const volumeMeshes: { position: Float32Array }[] = []
        for (const floorUrn of floorUrns) {
          const floorVolumeMesh = proposal.snapshot.elements.get(floorUrn)?.representations.volumeMesh
          if (!floorVolumeMesh) continue
          volumeMeshes.push({
            position: floorVolumeMesh.getAttribute("position").array as Float32Array,
          })
        }
        const firstFloorKey = sketch3dBuilding.children[0].key
        const firstFloorPath = buildingPath + "/" + firstFloorKey

        const firstFloorNode = proposal.snapshot.getNodeOrThrow(firstFloorPath)
        const firstFloorTransform = firstFloorNode.globalMatrix.toArray()

        const meshBuilding: MeshBuilding = {
          id: buildingPath,
          floors: fixedFloors,
          floorPlans: floorPlans,
          transform: firstFloorTransform,
          volumeMeshes: volumeMeshes,
          grid: sketch3dBuilding.representations.building3d.grid,
        }
        meshBuildings.push(meshBuilding)
      }

      const surroundingGeometriesV2: MeshFpsInputData["data"]["surroundingGeometriesV2"] = []
      for (const node of proposal.snapshot.traverseNodesDepthFirstIterable()) {
        if (node === proposal.snapshot.rootNode) continue

        const path = node.path
        const element = node.elementContainer.element

        if (sketch3dBuildingPaths.some((buildingPath) => path.startsWith(buildingPath))) {
          continue
        }

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
      }

      const cameraData = cameraApi.getCurrentCameraState()
      const position = { ...cameraData.position }
      const direction = { ...cameraData.direction }
      const target = { ...cameraData.target }

      const terrainData: MeshFpsInputData["data"]["terrainData"] = proposal.terrain
        ? {
            geometry: proposal.terrain.getTerrainGeometryData(),
            texture: await proposal.terrain.getTerrainBackgroundTexture().then((t) => t?.arraybuffer),
          }
        : undefined

      const generatorFunctions = getGeneratorFunctions(imperial)

      return {
        meshBuildings,
        initialBuilding: selectedBuildingPath,
        initialFloorSelection: [...selectedFloorNumbers],
        canEdit: canEditProposal,
        cameraData: { position, direction, target },
        terrainData,
        surroundingGeometriesV2,
        projectId: PROJECT_ID,
        floorPlanTemplates,
        generatorFunctions,
      }
    },
    [imperial, canEditProposal, floorPlanTemplates],
  )
}

function updateCameraOnExit(e: CustomEvent<MeshFpsOutputData>, cameraApi: CameraAPI) {
  if (e.detail.cameraData) {
    const { position, target } = e.detail.cameraData
    const positionVec = new Vector3(position.x, position.y, position.z)
    const targetVec = new Vector3(target.x, target.y, target.z)
    void cameraApi.moveCamera(positionVec, targetVec).then()
  }
}

type MeshFpsProps = {
  fpsInputData: MeshFpsInputData["data"]
  setFpsInputData: any
  updateFloorPlans: (
    updatedData: {
      [buildingPath: string]: { floorPlans: MeshBuildingFloorPlans; grid?: BuildingGrid }
    },
    onComplete?: () => void,
  ) => void
}
export const MeshFps = ({ fpsInputData, setFpsInputData, updateFloorPlans }: MeshFpsProps) => {
  const getInputDataToMeshFps = useGetInputDataToMeshFps()
  const onComplete = useCallback(
    (e: CustomEvent<MeshFpsOutputData>) => {
      setFpsInputData(undefined)
      updateCameraOnExit(e, cameraApi)
      const updatedBuildingsData = e.detail.updatedBuildingsData
      updateFloorPlans(updatedBuildingsData)
      if (e.detail.selectionData?.selectedBuilding) {
        const selectedBuildingPath = e.detail.selectionData?.selectedBuilding
        setSelectionSignalValue([selectedBuildingPath])
      }
    },
    [setFpsInputData, updateFloorPlans],
  )
  const onCancel = useCallback(() => {
    setFpsInputData(undefined)
  }, [setFpsInputData])

  // Does essentially the same as onComplete above but without exiting the floor plan sketcher
  const onSave = useCallback(
    (e: CustomEvent<MeshFpsOutputData>) => {
      const updatedBuildingsData = e.detail.updatedBuildingsData
      updateFloorPlans(updatedBuildingsData, () => {
        const updateData = async () => {
          // After the save is complete, get the updated 3d floor volume data back into floor plan sketcher
          const selectedBuildingPath = Object.keys(updatedBuildingsData)[0]
          const newBuildingFloors = getBuildingFloorsForPath(elementState.currentSnapshot.peek(), selectedBuildingPath)
          if (!newBuildingFloors) return
          const sketch3dBuildings = { [selectedBuildingPath]: newBuildingFloors }
          const meshFpsInputData = await getInputDataToMeshFps(
            selectedBuildingPath,
            fpsInputData.initialFloorSelection!,
            sketch3dBuildings,
          )
          setFpsInputData(meshFpsInputData)
        }
        void updateData()
      })
    },
    [fpsInputData.initialFloorSelection, getInputDataToMeshFps, setFpsInputData, updateFloorPlans],
  )

  return (
    <>
      {fpsInputData && (
        <div
          style={WrapperStyle}
          /* eslint-disable-next-line react/no-unknown-property */
          onDblClick={(e) => {
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            setFpsInputData(undefined)
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            setFpsInputData(undefined)
          }}
        >
          <MeshFPSWebComp data={fpsInputData} onComplete={onComplete} onCancel={onCancel} onSave={onSave} />
        </div>
      )}
    </>
  )
}
