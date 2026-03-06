import { useLoadFpsWebComponent } from "./floorPlansMenu3d/MeshFps"
import { parseUrn, replaceRevision } from "src/lib/element/urn"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import type { FormaElement } from "@spacemakerai/element-types"
import { FloorPlansMenu3d } from "./floorPlansMenu3d/FloorPlansMenu3d"
import type { Building3d, FilledBuilding3d, Sketch3dBuilding } from "./3dSketchBuildingTypes"
import { extractGfaUnitsFrom3dSketchFloorPlans } from "./3dSketchGfaUnits"
import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { updateWSMCache } from "src/integrations/wsm-tools/wsm-integration/wsm-cache"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import { getBuildingPieceMeshesFromGFAUnits } from "src/integrations/wsm-tools/building/floorPlanUtils"
import type { RawMeshData, WSMGeometryData } from "src/integrations/wsm-tools/wsr/api/types"
import { getGIPBoundingBox } from "src/integrations/wsm-tools/wsr/api/usePrepareWSRSaveActions"
import type { PartialBuildingPieceMesh } from "src/integrations/wsm-tools/wsr/api/usePrepareWSRSaveActions"
import { makePartialBuildingPieceMeshesAndFloorVolumes } from "src/integrations/wsm-tools/wsr/api/usePrepareWSRSaveActions"
import { getIndexToRefHistoryIdArray } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import {
  generateGlb,
  generateGraphBuildingFrom3dsBuilding,
  getBufferGeometriesFromWSMGeometryData,
  lookupWSMObject,
} from "src/integrations/wsm-tools/wsr/api/mapping"
import { getDefaultRenderingPropertiesByCategory } from "src/lib/three/defaultRenderingProperties"
import type { BufferGeometry } from "three"
import { Color } from "three"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import { useSyncPath } from "src/integrations/wsm-tools/wsr/api/useSync"
import type { GFAUnit } from "src/lib/element/types"
import { isDefined } from "src/lib/array"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { selectionArraySignal } from "src/core/selection/selectionState"
import { createIntegrateElementCustomData } from "src/integrations/integrate-element-system/IntegrateElementSystem"
import { useInitializeFormitCoreCallback } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { FEET_TO_METER } from "@spacemakerai/forma-units"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"

export function isElement3dSketchBuilding(element: FormaElement): boolean {
  const system = parseUrn(element.urn).system
  if (system !== "integrate") return false
  if (element.properties?.category !== "building") return false
  return element.children !== undefined
}

function isElement3dSketchFloor(element: FormaElement): boolean {
  const system = parseUrn(element.urn).system
  if (system !== "integrate") return false
  if (element.properties?.category !== "floor") return false
  return true
}

function useGetSelected3dSketchBuilding(): string | undefined {
  const snapshot = elementState.currentSnapshot.value
  const selection = selectionArraySignal.value

  return useMemo(() => {
    // Only use paths if all selections are 3d sketch buildings or floors
    if (
      !selection.every((p) => {
        const element = snapshot.getNode(p)?.elementContainer.element
        return element && (isElement3dSketchBuilding(element) || isElement3dSketchFloor(element))
      })
    )
      return undefined
    const selectedElementPath = selection[0]
    const selectedElement = snapshot.getNode(selectedElementPath)?.element
    if (selectedElement === undefined) return undefined
    if (!isElement3dSketchBuilding(selectedElement) && isElement3dSketchFloor(selectedElement))
      return getParentPath(selectedElementPath)
    if (!isElement3dSketchBuilding(selectedElement)) return undefined

    return selectedElementPath
  }, [selection, snapshot])
}

// Gets the indices of the floors selected
export function useGetSelected3dSketchFloorIndices(buildingPath: string): number[] {
  const selection = selectionArraySignal.value
  const snapshot = elementState.currentSnapshot.value

  return useMemo(() => {
    const selectionPaths = selection
    const selectedElementPath = selectionPaths[0]
    if (!buildingPath || buildingPath !== getParentPath(selectedElementPath)) return []
    const selectedElement = snapshot.getNode(selectedElementPath)?.element
    if (selectedElement === undefined) return []
    if (!isElement3dSketchBuilding(selectedElement) && isElement3dSketchFloor(selectedElement)) {
      const selectedBuildingPath = getParentPath(selectedElementPath)
      if (!selectedBuildingPath) return []
      const buildingFloorPaths = snapshot
        .getNode(selectedBuildingPath)
        ?.elementContainer.element.children?.map((c) => selectedBuildingPath + "/" + c.key)
      const selectedFloorIndices = buildingFloorPaths
        ?.map((p, i) => (selectionPaths.includes(p) ? i : undefined))
        .filter(isDefined)
      return selectedFloorIndices ?? []
    }
    return []
  }, [selection, buildingPath, snapshot])
}

export function getBuildingFloorsForPath(snapshot: ElementSnapshot, path: string): undefined | Sketch3dBuilding {
  if (!path) {
    return undefined
  }
  const elementContainer = snapshot.getNode(path)?.elementContainer
  if (!elementContainer || !elementContainer.representations.buildingFloors3DSketch_UNSTABLE) return

  const repJson = snapshot.getNode(path)?.elementContainer.representations.buildingFloors3DSketch_UNSTABLE
  if (!repJson) {
    return undefined
  }

  return {
    urn: elementContainer.element.urn,
    children: elementContainer.element.children!,
    representations: {
      building3d: repJson,
    },
  }
}

export function useGet3dsBuilding3dElement(snapshot: ElementSnapshot, path: string): undefined | Sketch3dBuilding {
  const [building3dElement, setBuilding3dElement] = useState<undefined | Sketch3dBuilding>(undefined)
  useEffect(() => {
    function loadRep() {
      const result = getBuildingFloorsForPath(snapshot, path)
      if (result) {
        setBuilding3dElement(result)
      } else {
        setBuilding3dElement(undefined)
      }
    }
    loadRep()
  }, [snapshot, path])

  return building3dElement
}

// Helper function that updates the elements based on a building representation for both
// update and delete below. Note if function id is specified, this is being called to
// change the function id only and no intersections are required.
export function updateElementsBasedOnNewBuildingRep(
  buildingPath: InternalPath,
  newBuilding3d: Building3d,
  functionId?: string,
) {
  const snapshot = elementState.currentSnapshot.peek()

  const elementNode = snapshot.getNodeOrThrow(buildingPath)
  const elementContainer = elementNode.elementContainer
  const element = elementNode.element

  // if the existing element isn't persisted then the predecessor isn't the current
  // element it is the most recent persisted element.
  const newUrn = replaceRevision(element.urn)
  let predecessorUrn = elementContainer.isServerState
    ? elementContainer.element.urn
    : elementContainer.element.metadata?.predecessor
  // And in the case where it is not persisted but the element has no predecessor
  // then it is better to provide a predecessor so we don't lose important reps. For example
  // when creating a new 3DS building and then setting a function before it is persisted.
  if (!predecessorUrn) {
    predecessorUrn = elementContainer.element.urn
  }

  const revision = new Date().getTime().toString()
  const gfaUnits = extractGfaUnitsFrom3dSketchFloorPlans(newBuilding3d)

  elementState.edit(({ updateElement }) => {
    if (!elementNode) {
      throw new Error("Couldn't find building node when updating floor plans on 3D sketch buildings")
    }

    const allFloorPaths = elementNode.element.children?.map((c) => `${buildingPath}/${c.key}`) ?? []

    const newFloorNodes: ChildNodeContainer[] = allFloorPaths
      .map((path) => snapshot.getNode(path))
      .filter((n): n is ChildNodeContainer => {
        if (!n) {
          throw new Error("Couldn't find floor node when setting function on 3D sketch buildings or floors")
        }
        return true
      })

    const gipForBuilding = lookupWSMObject(buildingPath)?.groupInstancePath
    const indexToRefHistoryIdArray = gipForBuilding ? getIndexToRefHistoryIdArray(gipForBuilding) : []

    const floorGeometries: BufferGeometry[] = []
    const floorElements: FormaElement[] = []

    newFloorNodes.forEach((newFloorNode, i) => {
      const newFloorUrn = replaceRevision(newFloorNode.element.urn, revision)

      // If the existing element isn't persisted then the predecessor isn't the current
      // element it is the most recent persisted element.
      let newFloorPredecessorUrn = newFloorNode.elementContainer.isServerState
        ? newFloorNode.element.urn
        : newFloorNode.element.metadata?.predecessor
      // And in the case where it is not persisted but the element has no predecessor
      // then it is better to provide a predecessor so we don't lose important reps. For example
      // when creating a new 3DS building and then setting a function before it is persisted.
      if (!newFloorPredecessorUrn) {
        newFloorPredecessorUrn = newFloorNode.element.urn
      }

      const gfaUnitsForFloor = gfaUnits?.filter((unit) => unit.floorIndex === Number(i))
      const partialBuildingPieceMesh: PartialBuildingPieceMesh[] = []
      if (functionId) {
        if (
          newFloorNode.elementContainer.element.properties?.partialBuildingPieceMeshes &&
          newFloorNode.elementContainer.element.properties?.partialBuildingPieceMeshes.length > 0
        ) {
          // Copy the partial building piece meshes and change the function id as required.
          newFloorNode.elementContainer.element.properties.partialBuildingPieceMeshes.forEach(
            (partialBPM: PartialBuildingPieceMesh) => {
              partialBuildingPieceMesh.push({
                info: { ...partialBPM.info },
                geoArray: {
                  positionArray: [...partialBPM.geoArray.positionArray],
                  normalArray: partialBPM.geoArray.normalArray ? [...partialBPM.geoArray.normalArray] : undefined,
                },
              })
            },
          )
        } else {
          // Make the partial building piece mesh from the volume mesh.
          const volumeMesh = newFloorNode.elementContainer.representations.volumeMesh
          if (volumeMesh) {
            const position = Array.from(volumeMesh.getAttribute("position").array as Float32Array)
            const normal = Array.from(volumeMesh.getAttribute("normal").array as Float32Array)
            partialBuildingPieceMesh.push({
              info: {},
              geoArray: { positionArray: position, normalArray: normal },
            })
          }
        }

        // Check if the function id is matches all the gfa units.
        const isFunctionIdType = (
          gfaUnit: GFAUnit & {
            floorIndex: number
          },
        ) => {
          return gfaUnit.functionId === functionId
        }
        if (gfaUnitsForFloor.every(isFunctionIdType)) {
          partialBuildingPieceMesh.forEach((partialBPM) => {
            partialBPM.info.functionId = functionId
          })
        }
      } else {
        const bpms: BuildingPieceMesh[] = getBuildingPieceMeshesFromGFAUnits(
          i,
          gfaUnitsForFloor,
          indexToRefHistoryIdArray,
          newBuilding3d.floors3d[i],
        )

        if (bpms.length > 0) {
          const floorVolumes: RawMeshData[] = []
          makePartialBuildingPieceMeshesAndFloorVolumes(bpms, partialBuildingPieceMesh, floorVolumes)
          if (floorVolumes.length === 1) {
            const color = getDefaultRenderingPropertiesByCategory("building", true).color
            const geo: WSMGeometryData = { position: floorVolumes[0].position, normal: floorVolumes[0].normal }
            const { shell } = getBufferGeometriesFromWSMGeometryData(geo, new Color(color))
            floorGeometries.push(shell!)
          }
        }
      }

      const newFloorElement: FormaElement = {
        ...newFloorNode.elementContainer.element,
        urn: newFloorUrn,
        metadata: {
          predecessor: newFloorPredecessorUrn,
        },
        properties: {
          ...newFloorNode.elementContainer.element.properties,
          partialBuildingPieceMeshes: partialBuildingPieceMesh,
        },
        representations: {
          ...newFloorNode.elementContainer.element.representations,
          gfaUnits: {
            type: "embedded-json",
            data: gfaUnitsForFloor,
          },
        },
      }
      floorElements.push(newFloorElement)
    })

    let newFloorContainers: Record<string, ElementContainer> = {}
    let getFloorsGlb: (() => Promise<Uint8Array>) | null = null

    if (floorGeometries.length === 0) {
      newFloorContainers = Object.fromEntries(
        floorElements.map((floorElement, i) => {
          const floorContainer = ElementContainer.fromDraftElement(
            floorElement,
            newFloorNodes[i].elementContainer.children,
            newFloorNodes[i].elementContainer.representations,
          )
          return [newFloorNodes[i].child.key, floorContainer]
        }),
      )
    } else {
      const floorGeoPieces = floorGeometries.reduce(
        (pieces, geo, i) => ({ ...pieces, [`floor-${i}`]: { geometry: geo } }),
        {},
      )
      getFloorsGlb = () => generateGlb(floorGeoPieces)

      newFloorContainers = Object.fromEntries(
        floorElements.map((floorElement, i) => {
          const floorContainer = ElementContainer.fromDraftElement(
            floorElement,
            newFloorNodes[i].elementContainer.children,
            {
              volumeMesh: floorGeometries[i],
              footprint: undefined,
              terrainShape: undefined,
              terrainTexture: undefined,
              buildingFloors3DSketch_UNSTABLE: undefined,
            },
            createIntegrateElementCustomData({
              preparedLinkedRepresentations: {
                volumeMesh: {
                  getData: getFloorsGlb!,
                  selection: {
                    type: "equals",
                    value: `floor-${i}`,
                  },
                },
              },
            }),
          )
          return [newFloorNodes[i].child.key, floorContainer]
        }),
      )
    }

    const buildingRoofPeakElevation = gipForBuilding ? getGIPBoundingBox(gipForBuilding).upper.z * FEET_TO_METER : null

    const buildingContainer = ElementContainer.fromDraftElement(
      {
        ...elementNode.elementContainer.element,
        urn: newUrn,
        metadata: {
          predecessor: predecessorUrn,
        },
        children: elementNode.elementContainer.element.children?.map((child) =>
          newFloorContainers[child.key] ? { ...child, urn: newFloorContainers[child.key].element.urn } : child,
        ),
        properties: {
          ...element.properties,
        },
        representations: {
          // Placing here and in custom data because we want it available for edit before upload
          buildingFloors3DSketch_UNSTABLE: {
            type: "embedded-json",
            data: newBuilding3d,
          },
        },
      } as FormaElement,
      Object.values(newFloorContainers),
      {
        buildingFloors3DSketch_UNSTABLE: newBuilding3d,
        volumeMesh: undefined,
        terrainTexture: undefined,
        terrainShape: undefined,
        footprint: undefined,
      },
      createIntegrateElementCustomData({
        preparedLinkedRepresentations: {
          buildingFloors3DSketch_UNSTABLE: { getData: () => JSON.stringify(newBuilding3d) },
          ...(buildingRoofPeakElevation
            ? {
                graphBuilding_approximation: {
                  properties: { approximations: element.representations?.graphBuilding_approximation ?? undefined },
                  getData: () =>
                    JSON.stringify(
                      generateGraphBuildingFrom3dsBuilding(
                        newBuilding3d as FilledBuilding3d,
                        buildingRoofPeakElevation,
                      ),
                    ),
                },
              }
            : {}),
        },
        representationsToDelete: new Set(["volumeMesh", "gfaUnits"]),
      }),
    )

    updateElement(
      elementState.currentBaseSignal.peek().path.isAnchestorOf(elementNode.path) ? "base" : "proposal",
      { ...elementNode.child, urn: newUrn },
      buildingContainer,
    )
  })

  // Make sure the new urn is used for the cache and side effect adapter.
  wsmSideEffectAdapter.updateCacheFromSave(buildingPath, newUrn)
  void updateWSMCache(element.urn, newUrn)
}

export function FloorPlansMenu3dSketchBuilding() {
  useLoadFpsWebComponent()

  const selectedBuildingPath = useGetSelected3dSketchBuilding() ?? ""
  const snapshot = elementState.currentSnapshot.value
  const building3dElement = useGet3dsBuilding3dElement(snapshot, selectedBuildingPath)
  const sync = useSyncPath()
  const selectedFloorIndices = useGetSelected3dSketchFloorIndices(selectedBuildingPath) ?? []
  const initialize = useInitializeFormitCoreCallback()

  const updateFloorPlans = useCallback(
    async (updatedFloorPlans: { [buildingPath: string]: Building3d }, onComplete?: () => void) => {
      // Do the save only once the building is synced. This is fast since there is an axm file.
      const onReadyCallback = () => {
        updateElementsBasedOnNewBuildingRep(selectedBuildingPath, updatedFloorPlans[selectedBuildingPath])
        onComplete?.()
      }

      await initialize()
      sync(selectedBuildingPath, onReadyCallback)
    },
    [initialize, selectedBuildingPath, sync],
  )

  if (selectedBuildingPath === undefined || building3dElement === undefined) return <></>

  return (
    <FloorPlansMenu3d
      selectedBuildingPath={selectedBuildingPath}
      sketch3dBuildings={{ [selectedBuildingPath]: building3dElement }}
      updateFloorPlansInBuildings={(...args) => void updateFloorPlans(...args)}
      selectedFloorIndices={selectedFloorIndices}
    />
  )
}
