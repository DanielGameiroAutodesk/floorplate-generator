import { useCallback } from "preact/hooks"
import type { RawMeshData, WSMGeometryData } from "./types"
import type { FormaElement, GrossFloorAreaPolygon } from "forma-elements"
import { createUrn, newChildKey, newId, newRevision, parseUrn, replaceRevision } from "src/lib/element/urn"
import { getDefaultRenderingPropertiesByCategory } from "src/lib/three/defaultRenderingProperties"
import {
  generateGlb,
  generateGraphBuildingFrom3dsBuilding,
  generateSemanticMeshGlb,
  getBufferGeometriesFromWSMGeometryData,
  getWSMGeo25DApproximations,
} from "./mapping"
import { Color, Matrix4 } from "three"
import { writeToWSMCache } from "src/integrations/wsm-tools/wsm-integration/wsm-cache"
import { v4 as uuid } from "uuid"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import sceneManager from "src/core/three/sceneManager"
import type { InternalPath } from "src/lib/element/path"
import { getLeafKey } from "src/lib/element/path"
import type { FilledBuilding3d } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"
import { extractGfaUnitsFrom3dSketchFloorPlans } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchGfaUnits"
import { getChildrenPathsOfParentPath } from "src/integrations/wsm-tools/wsr/integrated/utils"
import type { ChildNodeContainer, RootContext } from "src/core/elements/ChildNodeContainer"
import { elementState } from "src/core/elements/ElementState"
import { ElementContainer } from "src/core/elements/ElementContainer"
import { getGraphSpacesUpdateUnits } from "src/integrations/wsm-tools/building/floorPlanUtils"
import type { Unit } from "src/integrations/building-systems-basic-building/lib/types"
import {
  computeFloorVolumeMeshes,
  getIndexToRefHistoryIdArray,
} from "src/integrations/wsm-tools/building/buildingFloorUtils"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import { PROJECT_ID } from "src/core/project/project"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { createIntegrateElementCustomData } from "src/integrations/integrate-element-system/IntegrateElementSystem"
import { FEET_TO_METER, METER_TO_FEET } from "@spacemakerai/forma-units"
import { getElementTransformArrayFromWSMInstance } from "./Integrated3DSketchAPI"
import { getRepresentationJsonUnsafe } from "@spacemakerai/elements-client"
import type { GFAUnit } from "src/lib/element/types"

// A partial buiding piece mesh contains information to generate a building piece mesh.
// Note we cannot index a volume mesh since the triangle order can change. Do we need
// normals stored or should we compute them? For now, compute.
export type PartialBuildingPieceMesh = {
  info: { functionId?: string; areaType?: string; area?: number }
  geoArray: { positionArray: number[]; normalArray?: number[] }
}

// Helper function that makes floor volumes and partial building piece meshes from
// building piece meshes.
export function makePartialBuildingPieceMeshesAndFloorVolumes(
  bmps: BuildingPieceMesh[],
  partialBuildingPieceMeshArray: PartialBuildingPieceMesh[],
  floorVolumes: RawMeshData[],
) {
  if (bmps.length === 1) {
    floorVolumes.push(bmps[0].geo)
    partialBuildingPieceMeshArray.push({
      info: bmps[0].info,
      geoArray: { positionArray: Array.from(bmps[0].geo.position), normalArray: Array.from(bmps[0].geo.normal) },
    })
  } else if (bmps.length > 1) {
    // We have to combine float32arrays for the position and normal since
    // we want one mesh per floor.
    let totalPoints = bmps.reduce((acc, bmp) => acc + bmp.geo.position.length, 0)
    if (totalPoints > 0) {
      const rawMeshData: RawMeshData = {
        position: new Float32Array(totalPoints),
        normal: new Float32Array(totalPoints),
      }

      totalPoints = 0
      bmps.forEach((bmp) => {
        partialBuildingPieceMeshArray.push({
          info: bmp.info,
          geoArray: { positionArray: Array.from(bmp.geo.position), normalArray: Array.from(bmp.geo.normal) },
        })
        rawMeshData.position.set(bmp.geo.position, totalPoints)
        rawMeshData.normal.set(bmp.geo.normal, totalPoints)
        totalPoints += bmp.geo.position.length
      })

      floorVolumes.push(rawMeshData)
    }
  }
}

export function getGIPBoundingBox(groupInstancePath: WSM.GroupInstancePathInterface) {
  const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
    groupInstancePath.ids[0].History,
    groupInstancePath.ids[0].Object,
  )
  const bbox = WSM.APIGetBoxReadOnly(refHistId)

  return bbox
}

function generateAXMFile(axmDataString: string): File {
  const binaryAxmRepresentationString = atob(axmDataString)
  const binaryArray = new Uint8Array(new ArrayBuffer(binaryAxmRepresentationString.length))
  for (let i = 0; i < binaryAxmRepresentationString.length; i++) {
    binaryArray[i] = binaryAxmRepresentationString.charCodeAt(i)
  }

  const fileBlob = new Blob([binaryArray], { type: "application/octet-stream" })
  const file = new File([fileBlob], "rep.axm")
  return file
}

function updateElementContainerTree(
  snapshot: ElementSnapshot,
  geo: WSMGeometryData,
  editingNode: ChildNodeContainer,
  groupInstancePath: WSM.GroupInstancePathInterface,
  elementMatrix: Matrix4,
): ElementContainer {
  const editedElement = editingNode.elementContainer.element
  const parsed = parseUrn(editedElement.urn)
  const replacementURN =
    parsed.system !== "integrate"
      ? createUrn("integrate", parsed.authcontext, newId(), newRevision())
      : replaceRevision(editedElement.urn)

  const axmFile = geo.axmRepresentation ? generateAXMFile(geo.axmRepresentation) : undefined

  if (!geo.floorPolygons?.length) {
    //not a building
    const color = getDefaultRenderingPropertiesByCategory(editedElement.properties?.category, true).color
    const { shell } = getBufferGeometriesFromWSMGeometryData(geo, new Color(color))
    const isConstraint =
      editedElement.properties?.category === "constraints" ||
      // Fixes data regression from pr https://github.com/spacemakerai/designmode/pull/2301
      (editedElement.properties?.category === undefined && editedElement.properties?.name === "Constraint")
    const isBuilding = editedElement.properties?.category === "building"
    const updatedElement = {
      ...editedElement,
      urn: replacementURN,
      metadata: {
        predecessor: editedElement.urn,
      },
      children: [], //Clearing the children here seems odd, but I didn't want to change behaviour when doing the refactor
      properties: {
        ...editedElement.properties,
        category: isConstraint
          ? "constraints" // Make sure constraints maintain the constraint category
          : isBuilding
            ? undefined // Buildings with no floors are no longer buildings
            : editedElement.properties?.category, // Fallback to original value
      },
      representations: {},
    } as FormaElement
    const container = ElementContainer.fromDraftElement(
      updatedElement,
      undefined,
      {
        volumeMesh: shell,
        footprint: undefined,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      createIntegrateElementCustomData({
        preparedLinkedRepresentations: {
          ...(axmFile
            ? {
                axm: {
                  properties: { internalRepresentationHeightOffset: 0 },
                  getData: () => axmFile,
                },
              }
            : {}),
          volumeMesh: {
            getData: () => generateGlb({ [replacementURN]: { geometry: shell! } }),
          },
        },
        representationsToDelete: new Set(["buildingFloors3DSketch_UNSTABLE", "graphBuilding_approximation"]),
      }),
    )
    wsmSideEffectAdapter.updateCacheFromSave(editingNode.path, replacementURN, elementMatrix.toArray())
    return container
  }

  const currentFloorPaths = getChildrenPathsOfParentPath(snapshot, editingNode.path)

  const indexToRefHistoryIdArray: number[] = getIndexToRefHistoryIdArray(groupInstancePath)

  const previousBuildingRep = editingNode.elementContainer.representations.buildingFloors3DSketch_UNSTABLE
  const gfaUnitsFromBuilding: GFAUnit[][] = []
  if (currentFloorPaths.length === 0 && previousBuildingRep === undefined) {
    // Look for gfaUnits on the parent. This can happen with dynamo elements.
    if (editedElement.properties?.category === "building" && editedElement.representations?.gfaUnits !== undefined) {
      // Add levels to the WSM instance at the heights of the gfa units.
      const gfaUnits = getRepresentationJsonUnsafe(editedElement.representations.gfaUnits)
      const levelHeightAndUnits: { elevation: number; gfaUnit: GFAUnit }[] = []
      gfaUnits.forEach((unit) => {
        if (unit.areas.length > 0) {
          levelHeightAndUnits.push({ elevation: unit.areas[0].elevation, gfaUnit: unit })
        }
      })
      levelHeightAndUnits.sort((a, b) => a.elevation - b.elevation)
      if (levelHeightAndUnits.length > 0) {
        gfaUnitsFromBuilding.push([])
        gfaUnitsFromBuilding[gfaUnitsFromBuilding.length - 1].push(levelHeightAndUnits[0].gfaUnit)
        for (let i = 1; i < levelHeightAndUnits.length; i++) {
          if ((levelHeightAndUnits[i].elevation - levelHeightAndUnits[i - 1].elevation) * METER_TO_FEET > 0.01) {
            gfaUnitsFromBuilding.push([])
          }
          gfaUnitsFromBuilding[gfaUnitsFromBuilding.length - 1].push(levelHeightAndUnits[i].gfaUnit)
        }
      }

      console.log("gfaUnitsFromBuilding", gfaUnitsFromBuilding)
    }
  }

  // To get the old gfa units in the spacce of the new element, need to apply the following matrix.
  const gfaMatrix = elementMatrix.clone().invert().multiply(editingNode.globalMatrix)

  const units: Unit[] = []
  const partialBuildingPieceMeshArray: PartialBuildingPieceMesh[][] = []
  const floorVolumes: RawMeshData[] = []

  const building3dRep: FilledBuilding3d = {
    floors3d: geo.floorPolygons.map((gfaPolygonData: GrossFloorAreaPolygon[], index: number) => {
      const floorOutline = gfaPolygonData.map(({ grossFloorPolygon }) => {
        return grossFloorPolygon
      })

      const floorId = index.toString()

      const { unitsGraph, bmps } = getGraphSpacesUpdateUnits(
        snapshot,
        floorOutline,
        index,
        floorId,
        units,
        currentFloorPaths[index],
        indexToRefHistoryIdArray,
        previousBuildingRep?.floors3d[index],
        gfaUnitsFromBuilding[index],
        gfaMatrix,
      )

      partialBuildingPieceMeshArray[index] = []
      makePartialBuildingPieceMeshesAndFloorVolumes(bmps, partialBuildingPieceMeshArray[index], floorVolumes)

      return {
        //Discussions on TODOs below here https://spacemakercore.slack.com/archives/C040M2UN41Z/p1711138835313959
        //TODO need to agree on this value. Also, for now keeping as string. Discuss with building systems
        id: floorId,
        elevation: gfaPolygonData[0]?.elevation,
        //TODO, his seems not needed? Discuss with building systems
        //TODO next elevation - current elev
        //height: 3,
        floorOutline,
        graph: unitsGraph.graph,
        spaces: unitsGraph.spaces,
      }
    }),
    units,
  }

  const gfaUnits = extractGfaUnitsFrom3dSketchFloorPlans(building3dRep)

  const floorElements = geo.floorPolygons.map((_, i) => {
    const gfaUnitsForFloor = gfaUnits?.filter((unit) => unit.floorIndex === i)
    return {
      urn: createUrn("integrate", PROJECT_ID, newId() + "+" + i, newRevision()),
      properties: {
        category: "floor",
        floorIndex: i,
        partialBuildingPieceMeshes: partialBuildingPieceMeshArray[i],
      },
      representations: {
        gfaUnits: {
          type: "embedded-json",
          data: gfaUnitsForFloor,
        },
      },
    } satisfies FormaElement
  })

  const color = getDefaultRenderingPropertiesByCategory("building", true).color
  geo.floorVolumes = floorVolumes.length !== 0 ? floorVolumes : computeFloorVolumeMeshes(groupInstancePath)
  const { floors } = getBufferGeometriesFromWSMGeometryData(geo, new Color(color))
  const floorGeoPieces = floors!.reduce((pieces, geo, i) => ({ ...pieces, [`floor-${i}`]: { geometry: geo } }), {})
  const getFloorsGlb = () => generateGlb(floorGeoPieces)

  const floorContainers = floorElements.map((element, i) => {
    return ElementContainer.fromDraftElement(
      element,
      undefined,
      {
        volumeMesh: floors![i],
        footprint: undefined,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      createIntegrateElementCustomData({
        preparedLinkedRepresentations: {
          volumeMesh: {
            getData: getFloorsGlb,
            selection: {
              type: "equals",
              value: `floor-${i}`,
            },
          },
        },
      }),
    )
  })

  const buildingElement = {
    ...editedElement,
    urn: replacementURN,
    children: floorElements.map((element) => ({ urn: element.urn, key: uuid() })),
    metadata: {
      predecessor: editedElement.urn,
    },
    properties: {
      ...editedElement.properties,
      category: "building",
    },
    representations: {
      //still add the representations to "representations" property in memory - to handle case when the element is not fetched.
      buildingFloors3DSketch_UNSTABLE: {
        type: "embedded-json",
        data: building3dRep,
      },
    },
  } satisfies FormaElement

  //Calculating hitboxes here is not necessary. But we may want to persist them in the future. So keeping this code here for now.
  //First we need this code to be refactored into element-systems directory for access to needed APIs.
  /*if (bgeoArray && bgeoArray.length > 1 && bgeoArray[bgeoArray.length - 1]) {
        const extrudedFootprint = geometryToExtrudedFootprint(bgeoArray[bgeoArray.length - 1], Infinity) // Infinity for convex footprint
        const roofGeometry = buildGeoFromBlockWithHole({
          color: new Color("white"),
          height: 0.001,
          coordinates: extrudedFootprint.coordinates as [number, number][][],
          elevation: extrudedFootprint.elevation + extrudedFootprint.height + 0.01,
        })
        roofGeometry.applyMatrix4(inverseTransform)
        hitboxes[element.urn] = [roofGeometry]
    }*/

  const buildingRoofPeakElevation = getGIPBoundingBox(groupInstancePath).upper.z * FEET_TO_METER

  wsmSideEffectAdapter.updateCacheFromSave(editingNode.path, replacementURN, elementMatrix.toArray())
  const buildingContainer = ElementContainer.fromDraftElement(
    buildingElement,
    floorContainers,
    {
      buildingFloors3DSketch_UNSTABLE: building3dRep,
      footprint: undefined,
      terrainShape: undefined,
      terrainTexture: undefined,
      volumeMesh: undefined,
    },
    createIntegrateElementCustomData({
      preparedLinkedRepresentations: {
        ...(axmFile
          ? {
              axm: {
                properties: { internalRepresentationHeightOffset: 0 },
                getData: () => axmFile,
              },
            }
          : {}),
        buildingFloors3DSketch_UNSTABLE: { getData: () => JSON.stringify(building3dRep) },
        semanticMesh: {
          getData: () => generateSemanticMeshGlb(geo),
        },
        graphBuilding_approximation: {
          properties: { approximations: getWSMGeo25DApproximations(geo, indexToRefHistoryIdArray) },
          getData: () => JSON.stringify(generateGraphBuildingFrom3dsBuilding(building3dRep, buildingRoofPeakElevation)),
        },
      },
      representationsToDelete:
        parseUrn(editedElement.urn).system === "integrate" ? new Set(["volumeMesh", "gfaUnits"]) : undefined,
    }),
  )

  return buildingContainer
}

function useWSRUpdateElements() {
  return useCallback(
    (
      geo: WSMGeometryData,
      groupInstancePath: WSM.GroupInstancePathInterface,
      editingPath: InternalPath,
      elementMatrix: Matrix4,
    ) => {
      const currentSnapshot = elementState.currentSnapshot.peek()
      const editedNode = currentSnapshot.getNodeOrThrow(editingPath)
      if (!geo.position.length && !geo.floorPolygons?.length) {
        //when editing, need to delete the element
        wsmSideEffectAdapter.delete(editingPath)
        wsmSideEffectAdapter.cache.delete(editingPath)
        return elementState.edit(({ removeElement }) => {
          removeElement(editedNode.context, getLeafKey(editingPath))
        })
      }
      const container = updateElementContainerTree(currentSnapshot, geo, editedNode, groupInstancePath, elementMatrix)
      if (geo.axmRepresentation) {
        // Make sure axm rep is in cache, since is not available on element until persisted
        void writeToWSMCache(container.element.urn, geo.axmRepresentation)
      }
      elementState.edit(({ updateElement }) => {
        updateElement(
          editedNode.context,
          {
            ...editedNode.child,
            urn: container.element.urn,
            ...{ transform: elementMatrix.toArray() },
          },
          container,
        )
      })
      return editingPath
    },
    [],
  )
}

function createElementContainerTree(
  snapshot: ElementSnapshot,
  geo: WSMGeometryData,
  groupInstancePath: WSM.GroupInstancePathInterface,
): ElementContainer {
  const newElementUrn = createUrn("integrate", PROJECT_ID, newId(), newRevision())
  const axmFile = geo.axmRepresentation ? generateAXMFile(geo.axmRepresentation) : undefined
  if (!geo.floorPolygons?.length) {
    //not a building
    const elementToCreate = {
      urn: newElementUrn,
      properties: {
        // These props are temporary and will be overwritten once persisted
        spacemakerObjectStorageReferences: ["in-cache"],
        spacemakerObjectStorageReferenceFormats: ["axm"],
        internalRepresentationHeightOffset: 0,
      },
    }
    const color = getDefaultRenderingPropertiesByCategory(undefined, true).color
    const { shell } = getBufferGeometriesFromWSMGeometryData(geo, new Color(color))
    return ElementContainer.fromDraftElement(
      elementToCreate,
      undefined,
      {
        volumeMesh: shell!,
        footprint: undefined,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      createIntegrateElementCustomData({
        preparedLinkedRepresentations: {
          ...(axmFile
            ? {
                axm: {
                  properties: { internalRepresentationHeightOffset: 0 },
                  getData: () => axmFile,
                },
              }
            : {}),
          volumeMesh: {
            getData: () => generateGlb({ [elementToCreate.urn]: { geometry: shell! } }),
          },
        },
      }),
    )
  }

  const indexToRefHistoryIdArray: number[] = getIndexToRefHistoryIdArray(groupInstancePath)
  const units: Unit[] = []
  const partialBuildingPieceMeshArray: PartialBuildingPieceMesh[][] = []
  const floorVolumes: RawMeshData[] = []

  const building3dRep: FilledBuilding3d = {
    floors3d: geo.floorPolygons.map((gfaPolygonData: GrossFloorAreaPolygon[], index: number) => {
      const floorOutline = gfaPolygonData.map(({ grossFloorPolygon }) => {
        return grossFloorPolygon
      })

      const floorId = index.toString()

      const { unitsGraph, bmps } = getGraphSpacesUpdateUnits(
        snapshot,
        floorOutline,
        index,
        floorId,
        units,
        undefined,
        indexToRefHistoryIdArray,
      )

      partialBuildingPieceMeshArray[index] = []
      makePartialBuildingPieceMeshesAndFloorVolumes(bmps, partialBuildingPieceMeshArray[index], floorVolumes)
      return {
        //Discussions on TODOs below here https://spacemakercore.slack.com/archives/C040M2UN41Z/p1711138835313959
        //TODO need to agree on this value. Also, for now keeping as string. Discuss with building systems
        id: floorId,
        elevation: gfaPolygonData[0]?.elevation,
        //TODO, his seems not needed? Discuss with building systems
        //TODO next elevation - current elev
        //height: 3,
        floorOutline,
        graph: unitsGraph.graph,
        spaces: unitsGraph.spaces,
      }
    }),
    units,
  }

  const gfaUnits = extractGfaUnitsFrom3dSketchFloorPlans(building3dRep)

  const floorElements = geo.floorPolygons.map((_, i) => {
    const gfaUnitsForFloor = gfaUnits?.filter((unit) => unit.floorIndex === i)
    return {
      urn: createUrn("integrate", PROJECT_ID, newId() + "+" + i, newRevision()),
      properties: {
        category: "floor",
        floorIndex: i,
        partialBuildingPieceMeshes: partialBuildingPieceMeshArray[i],
      },
      representations: {
        gfaUnits: {
          type: "embedded-json",
          data: gfaUnitsForFloor,
        },
      },
    } satisfies FormaElement
  })

  const color = getDefaultRenderingPropertiesByCategory("building", true).color
  geo.floorVolumes = floorVolumes.length !== 0 ? floorVolumes : computeFloorVolumeMeshes(groupInstancePath)
  const { floors } = getBufferGeometriesFromWSMGeometryData(geo, new Color(color))
  const floorGeoPieces = floors!.reduce((pieces, geo, i) => ({ ...pieces, [`floor-${i}`]: { geometry: geo } }), {})
  const getFloorsGlb = () => generateGlb(floorGeoPieces)

  const floorContainers = floorElements.map((element, i) => {
    return ElementContainer.fromDraftElement(
      element,
      undefined,
      {
        volumeMesh: floors![i],
        footprint: undefined,
        terrainShape: undefined,
        terrainTexture: undefined,
        buildingFloors3DSketch_UNSTABLE: undefined,
      },
      createIntegrateElementCustomData({
        preparedLinkedRepresentations: {
          volumeMesh: {
            getData: getFloorsGlb,
            selection: {
              type: "equals",
              value: `floor-${i}`,
            },
          },
        },
      }),
    )
  })

  const buildingElement = {
    urn: newElementUrn,
    children: floorElements.map((element) => ({ urn: element.urn, key: uuid() })),
    properties: {
      category: "building",
      // These props are temporary and will be overwritten once persisted
      spacemakerObjectStorageReferences: ["in-cache"],
      spacemakerObjectStorageReferenceFormats: ["axm"],
      internalRepresentationHeightOffset: 0,
    },
    representations: {
      buildingFloors3DSketch_UNSTABLE: {
        type: "embedded-json",
        data: building3dRep,
      },
    },
  } satisfies FormaElement

  const buildingRoofPeakElevation = getGIPBoundingBox(groupInstancePath).upper.z * FEET_TO_METER

  const buildingContainer = ElementContainer.fromDraftElement(
    buildingElement,
    floorContainers,
    {
      buildingFloors3DSketch_UNSTABLE: building3dRep,
      footprint: undefined,
      terrainShape: undefined,
      terrainTexture: undefined,
      volumeMesh: undefined,
    },
    createIntegrateElementCustomData({
      preparedLinkedRepresentations: {
        ...(axmFile
          ? {
              axm: {
                properties: { internalRepresentationHeightOffset: 0 },
                getData: () => axmFile,
              },
            }
          : {}),
        buildingFloors3DSketch_UNSTABLE: { getData: () => JSON.stringify(building3dRep) },
        semanticMesh: {
          getData: () => generateSemanticMeshGlb(geo),
        },
        graphBuilding_approximation: {
          properties: { approximations: getWSMGeo25DApproximations(geo, indexToRefHistoryIdArray) },
          getData: () => JSON.stringify(generateGraphBuildingFrom3dsBuilding(building3dRep, buildingRoofPeakElevation)),
        },
      },
    }),
  )
  return buildingContainer
}

function useWSRCreateElements() {
  return useCallback(
    (
      geo: WSMGeometryData,
      context: RootContext,
      groupInstancePath: WSM.GroupInstancePathInterface,
      elementMatrix: Matrix4,
    ) => {
      if (!geo.position.length && !geo.floorPolygons?.length) {
        sceneManager.render(false, false)
        wsmSideEffectAdapter.deleteSyncDataForGIP(groupInstancePath)
        return
      }

      const rootContainer = createElementContainerTree(elementState.currentSnapshot.peek(), geo, groupInstancePath)
      const childKey = newChildKey()
      const createdPath = `${context === "base" ? elementState.currentBaseSignal.peek().path.value : elementState.currentProposalSignal.peek().path.value}/${childKey}`
      elementState.edit(({ addElement }) => {
        addElement(
          context,
          { urn: rootContainer.element.urn, key: childKey, transform: elementMatrix.toArray() },
          rootContainer,
        )
      })
      // Sync the new path to wsm geometry.
      wsmSideEffectAdapter.addExternalDataToMapAndCache(createdPath, {
        urn: rootContainer.element.urn,
        groupInstancePath,
        appliedWorldTransform: elementMatrix.toArray(),
        hasOwnedWSMOrAXMRep: true,
      })
      if (geo.axmRepresentation) {
        // Make sure axm rep is in cache, since is not available on element until persisted
        void writeToWSMCache(rootContainer.element.urn, geo.axmRepresentation)
      }
      return createdPath
    },
    [],
  )
}

// context is provided as a parameter here to bind the callback to the
// context at the time of creation. This is as of writing needed to support
// saving on "exit base", as the "current context" changes before the save
// is triggered. By binding the value here it can still operate on the
// original context during a callback operation.
export function usePrepareWSRSaveActions(context: RootContext) {
  const update = useWSRUpdateElements()
  const create = useWSRCreateElements()

  return useCallback(
    (geo: WSMGeometryData, groupInstancePath: WSM.GroupInstancePathInterface, editingPath?: InternalPath) => {
      // Use the transformation on the instance for the element.
      const transposedData: number[] = getElementTransformArrayFromWSMInstance(groupInstancePath)
      let matrix = new Matrix4().fromArray(transposedData)

      if (editingPath) {
        return update(geo, groupInstancePath, editingPath, matrix)
      }
      return create(geo, context, groupInstancePath, matrix)
    },
    [create, update, context],
  )
}
