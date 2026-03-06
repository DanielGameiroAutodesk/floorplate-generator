import type { InternalPath } from "src/lib/element/path"
import type { FormaElement, Transform, Urn } from "@spacemakerai/element-types"
import { isDefined } from "src/lib/array"
import type {
  ElementStateSideEffectInterface,
  SideEffectAdapterCache,
  SideEffectData,
} from "src/integrations/element-state-side-effects-adapter/ElementStateSideEffectInterface"
import type { VolumeMesh } from "src/core/volume-mesh"
import { parseUrn } from "src/lib/element/urn"
import { FEET_TO_METER, METER_TO_FEET } from "@spacemakerai/forma-units"
import type { Feature, Polygon, Position } from "geojson"
import { request } from "src/lib/request"

import { readFromWSMCache, writeToWSMCache } from "./wsm-cache"
import {
  allocateStringToMemoryAvailableToWASM,
  applyWorldTransform,
  createScaledPositionWorldTransform,
  createWSMMeshUsingPointers,
  getBoundingBox3For3DSElement,
  transposeTransform,
} from "./wsm-utils"
import { captureException } from "@sentry/browser"
import { createBrepFromFloorDataArray } from "src/integrations/wsm-tools/building/basicBuildingToWSMShell"
import { WSM_DISTANCE_TOL, WSM_MACHINE_TOL } from "src/integrations/wsm-tools/wsr/api/types"
import { Box3 } from "three"
import { TRIANGLE_LIMIT_ABSOLUTE_MAX, TRIANGLE_THRESHOLD_FOR_USE_GLB } from "src/integrations/wsm-tools/wsr/api/limits"
import {
  getRepresentationJsonUnsafe,
  loadRepresentationBinary,
  loadRepresentationJson,
} from "@spacemakerai/elements-client"
import type { LevelData } from "src/integrations/wsm-tools/wsr/integrated/types"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { elementState } from "src/core/elements/ElementState"
import { utils } from "@spacemakerai/web-sketch-renderer"
import { getElementsClient } from "src/core/elements-loading/loading"
import { recoveryExists, recoveryForEdit } from "src/integrations/wsm-tools/wsr/recovery"
import { getMappedCategory } from "src/core/categories"
import { addWSMLevelDataToWSMInstance } from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { PROJECT_ID } from "src/core/project/project"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import { lineMeshCache } from "./line-mesh-cache"
import { v4 } from "uuid"
import { getTranslator } from "src/i18n"

const { isSearchInGroupsResult } = utils

export type WSMDetailsForElementPath = {
  urn: Urn
  groupInstancePath: WSM.GroupInstancePathInterface
  appliedWorldTransform: Transform
  hasOwnedWSMOrAXMRep?: boolean
}

function getIndex(volumeMesh: VolumeMesh): number[] {
  const { position, index: originalIndex } = volumeMesh

  let index: number[] | undefined = originalIndex ? Array.from(originalIndex) : undefined
  if (!index) {
    if (Math.floor(position.length / 9) !== position.length / 9) {
      // The positions do not make an even number of triangles.
      console.warn("There are %f triangles", position.length / 9)
      return []
    }

    index = []
    for (let i = 0; i < position.length / 3; i += 1) {
      index.push(i)
    }
  }
  return index
}

// Note centers along the middle bottom of the combined bounding box of all objects. Also aligns x with the longest edge
// (or with the LCS if present, which it won't be in the cases where this is used).
export function centerObjectsAlongWorldCenter(historyId: number, objectIds: number[]): WSM.Transf3dInterface {
  const alignAndCenterTransf3d = WSM.Utils.ComputeAlignAndCenterTransformation(historyId, objectIds)
  if (!WSM.Transf3d.IsIdentity(alignAndCenterTransf3d)) {
    WSM.APITransformObjects(historyId, objectIds, WSM.Transf3d.Invert(alignAndCenterTransf3d))
  }
  return alignAndCenterTransf3d
}

function createBrepFromGeoJSON(historyId: number, geoJSON: Feature, scale: number) {
  const coordinates: Position[][] = (geoJSON.geometry as Polygon).coordinates

  const elevation = geoJSON.properties?.elevation ? geoJSON.properties.elevation : 0

  coordinates.forEach((loop, index) => {
    const isInteriorLoop = index > 0
    let previousDelta: number = 0
    let previousPoint: any

    if (isInteriorLoop) {
      previousDelta = WSM.APIGetIdOfActiveDeltaReadOnly(historyId)
    }

    loop.forEach((pointData) => {
      const newPoint = WSM.Geom.Point3d(pointData[0], pointData[1], elevation)

      if (previousPoint) {
        WSM.APIConnectPoint3ds(historyId, previousPoint, newPoint)
      }

      previousPoint = newPoint
    })

    if (isInteriorLoop) {
      const newDelta = WSM.APIGetIdOfActiveDeltaReadOnly(historyId)
      if (newDelta !== previousDelta) {
        const data = WSM.APIGetCreatedChangedAndDeletedInDeltaRangeReadOnly(historyId, previousDelta, newDelta, [
          WSM.nFaceType,
        ])

        if (data.created.length > 0) {
          WSM.APIDeleteObjects(historyId, data.created)
        }
      }
    }
  })

  const faceIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nFaceType)
  const dragHeight = geoJSON.properties?.height
  const faceDragHeightArray = Array(faceIds.length).fill(dragHeight)
  WSM.APIDragFaces(historyId, faceIds, faceDragHeightArray, [], true)

  const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nBodyType)

  //Likely need to rethink this when not dealing with constraints. For now constraint creation tool
  //Would just create 1 body.
  if (bodyIds.length !== 1) {
    console.error("Did not create exactly one body when converting from geoJSON")
    return
  }

  const bodyId = bodyIds[0]
  const scaleTransform = WSM.Geom.MakeScalingTransform(
    WSM.Point3d.Point3d(0, 0, 0),
    WSM.Vector3d.Vector3d(scale, scale, scale),
  )

  WSM.APITransformObject(historyId, bodyId, scaleTransform)

  return centerObjectsAlongWorldCenter(historyId, [bodyId])
}

// Function that is used to create site limit and zone linemeshes in WSM.
// The historyId says where to put the new geometry. The terrainGIP is
// used to identify the terrain which is used to create the linemeshes.
function createBoundaryFromGeoJSONAndTerrain(
  historyId: number,
  terrainGIP: WSM.GroupInstancePathInterface,
  geoJSON: Feature,
  scale: number,
  worldTransform: Transform | undefined,
) {
  const terrainTransf3d = WSM.APIGetInstanceTransf3dReadOnly(terrainGIP.ids[0].History, terrainGIP.ids[0].Object)
  const terrainInvertedTransf3d = WSM.Transf3d.Invert(terrainTransf3d)

  let coordinates: Position[] = []
  if (geoJSON.geometry.type === "Polygon") {
    coordinates = geoJSON.geometry.coordinates.flat()
  } else if (geoJSON.geometry.type === "LineString") {
    coordinates = geoJSON.geometry.coordinates
  }

  if (coordinates.length === 0) {
    return
  }

  // Use the transform from the element and change meters to feet in the coordinates.
  let transf3d = transposeTransform(worldTransform)

  // Scale * worldTransform moves the ground polygon into the right place globally
  const point = WSM.Geom.Point3d(0, 0, 0)
  const vector = WSM.Vector3d.Vector3d(scale, scale, scale)
  const metersToFeetTransf3d = WSM.Transf3d.MakeScalingTransform(point, vector)
  transf3d = WSM.Transf3d.Multiply(metersToFeetTransf3d, transf3d)

  // Mesh instance transf3d inverse * Scale * worldTransform, moves the ground
  // polygon into the reference history of the terrain mesh.
  transf3d = WSM.Transf3d.Multiply(terrainInvertedTransf3d, transf3d)

  const points3d: WSM.Point3dInterface[] = coordinates.map((coordinate) => {
    let point3d = WSM.Geom.Point3d(coordinate[0], coordinate[1], 0)
    point3d = WSM.Transf3d.Multiply(transf3d, point3d)

    return point3d
  })

  const terrainHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(terrainGIP.ids[0].History, terrainGIP.ids[0].Object)
  const [terrainMesh] = WSM.APIGetAllObjectsByTypeReadOnly(terrainHistoryId, WSM.nMeshType)

  const allLineMeshIds = []

  type TerrainLineMeshData = {
    start: WSM.Point3dInterface
    end: WSM.Point3dInterface
    mid: WSM.Point3dInterface
  }
  const allLineMeshData: TerrainLineMeshData[] = []

  const terrainBox = WSM.APIGetBoxReadOnly(terrainHistoryId)

  // Create one WSM line mesh for each edge of the terrain shape
  for (let i = 0; i < points3d.length - 1; i++) {
    const planes = []

    const currentPoint = points3d[i]
    const nextPoint = points3d[i + 1]
    const vector = WSM.Point3d.SubtractPoint(nextPoint, currentPoint)
    if (WSM.Vector3d.IsNull(vector)) {
      continue
    }
    const perpendicularVector = WSM.Vector3d.GetNormalized(
      WSM.Vector3d.CrossProduct(vector, WSM.Vector3d.Vector3d(0, 0, 1)),
    )

    // Plane is what we intersect with the mesh.
    const plane = WSM.Geom.Plane(currentPoint, perpendicularVector)
    planes.push(plane)

    // Bound the plane by perpendicular planes at the start and end of the segment. This is always safe. Note we could
    // pass less data to CreateBoudingLineMesh when we know the region is convex but that saves 1/3 the number of
    // planes (each plane is 4 doubles) with some risk. It seems worth it for now to write simpler code in this case.
    const planeNextPoint = WSM.Geom.Plane(nextPoint, vector)
    planes.push(planeNextPoint)
    const planeCurrentPoint = WSM.Geom.Plane(currentPoint, WSM.Vector3d.Vector3d(-vector.x, -vector.y, -vector.z))
    planes.push(planeCurrentPoint)

    const lineMeshId = WSM.Utils.CreateBoundingLineMesh(
      terrainHistoryId,
      terrainMesh,
      planes,
      true /*bUsePlaneLinearly*/,
    )

    // Create the start, mid and end point of each edge of the terrain shape
    // These will be added as an attribute to each line mesh
    if (lineMeshId != WSM.INVALID_ID) {
      allLineMeshIds.push(lineMeshId)

      let intPoints = []
      let linePts = [
        currentPoint,
        WSM.Point3d.Point3d(
          currentPoint.x + vector.x * 0.5,
          currentPoint.y + vector.y * 0.5,
          currentPoint.z + vector.z * 0.5,
        ),
        nextPoint,
      ]
      for (let j = 0; j < 3; j++) {
        // Fire a ray through the point at the minimum terrain z elevation up at the terrain to get
        // the projection of the point on the terrain
        const rayOrigin = WSM.Point3d.Point3d(linePts[j].x, linePts[j].y, -terrainBox.lower.z - 1.0)
        const ray = WSM.Line3d.Line3d(rayOrigin, WSM.Vector3d.ZDirection())
        const hitData = WSM.APIRayFireSortedReadOnly(
          terrainHistoryId,
          ray,
          WSM_MACHINE_TOL,
          false,
          false,
          true,
          1.0e30,
          true,
        )

        if (isSearchInGroupsResult(hitData)) {
          if (hitData.sortedParameters && hitData.sortedParameters.length > 0) {
            for (let index = 0; index < hitData.sortedParameters.length; index++) {
              if (hitData.sortedParameters[index] > WSM_DISTANCE_TOL) {
                const intersectionPt = WSM.Line3d.GetPointFromParameter(ray, hitData.sortedParameters[index])
                intPoints.push(intersectionPt)
                break
              }
            }
          }
        }
      }

      if (intPoints.length == 3) {
        let lineMeshData: TerrainLineMeshData = {
          start: intPoints[0],
          mid: intPoints[1],
          end: intPoints[2],
        }
        allLineMeshData.push(lineMeshData)
      }
    }
  }

  // Copy the line mesh to historyId. We need to account for the transform on the instance that refers to
  // historyId. This instance will have transform S * W * S^-1 * C^-1 where S is the scale, W is the world
  // transform, and C is the centering transform. Currently the geometry has transform T^-1 * S * W where
  // T is the transform on the terrain instance. So we need to multiple the geometry by S * W^-1 * S^-1 * T
  // and then center the geometry. Then the final transform on the geometry will be
  // S * W * S^-1 * C^-1 * C * S * W^-1 * S^-1 * T * T^-1 * S * W = S * W (the hard way!!)
  let SWInvSInvTransf3d = WSM.Geom.Transf3d()
  if (worldTransform) {
    SWInvSInvTransf3d = WSM.Transf3d.Invert(createScaledPositionWorldTransform(worldTransform))
  }
  const totalGeomTransf3d = WSM.Transf3d.Multiply(SWInvSInvTransf3d, terrainTransf3d)
  const lineMeshCopies = WSM.APICopyOrSketchAndTransformObjects(
    terrainHistoryId,
    historyId,
    allLineMeshIds,
    totalGeomTransf3d,
    1,
  )
  WSM.APIDeleteObjects(terrainHistoryId, allLineMeshIds)

  const centerTransf = lineMeshCopies.length >= 1 ? centerObjectsAlongWorldCenter(historyId, lineMeshCopies) : undefined

  // Add the terrain shape data to the new line mesh instances (transformed into the instance's space)
  if (lineMeshCopies.length == allLineMeshData.length && centerTransf != undefined) {
    const centerTransfInv = WSM.Transf3d.Invert(centerTransf)
    const instTransfInv = WSM.Transf3d.Multiply(centerTransfInv, totalGeomTransf3d)

    for (let i = 0; i < lineMeshCopies.length; i++) {
      allLineMeshData[i].start = WSM.Transf3d.Multiply(instTransfInv, allLineMeshData[i].start)
      allLineMeshData[i].mid = WSM.Transf3d.Multiply(instTransfInv, allLineMeshData[i].mid)
      allLineMeshData[i].end = WSM.Transf3d.Multiply(instTransfInv, allLineMeshData[i].end)
      const data = JSON.stringify(allLineMeshData[i])
      WSM.Utils.SetOrCreateStringAttributeForObject(
        historyId,
        lineMeshCopies[i],
        WSM.Utils.FORMA_TERRAIN_SHAPE_DATA,
        data,
      )
    }
  }

  return centerTransf
}

function createWSMMesh({
  historyId,
  worldTransform,
  volumeMesh,
  scale,
  urn,
  forBrep,
  meshFileData,
}: {
  historyId: number
  worldTransform: Transform | undefined
  volumeMesh: VolumeMesh | undefined
  scale: number
  urn: Urn
  forBrep: boolean
  meshFileData: Uint8Array | undefined
}): WSM.Transf3dInterface | undefined {
  if (!volumeMesh) return

  const isTerrainElement = parseUrn(urn).system === "terrain"
  const bComputeEdges = !isTerrainElement && volumeMesh.position.length <= TRIANGLE_LIMIT_ABSOLUTE_MAX

  const position = volumeMesh.position
  const index = getIndex(volumeMesh)
  const transform = transposeTransform(worldTransform)

  const scaleTransform = WSM.Geom.MakeScalingTransform(
    WSM.Point3d.Point3d(0, 0, 0),
    WSM.Vector3d.Vector3d(scale, scale, scale),
  )

  const tf = WSM.Transf3d.Multiply(scaleTransform, transform)

  let meshIds: number[] = []

  // If we don't have the original GLB data, or if the amount of triangles we're dealing with
  // is pretty small, then just create using a pointer (faster)
  if (!meshFileData) {
    meshIds.push(createWSMMeshUsingPointers(historyId, position, index, tf, bComputeEdges))
  } else {
    // Otherwise, try using the GLB data so we can be smarter about creating line meshes
    const id = v4()
    const path = `/tmp/meshdata-${id}.glb`
    window.FormItModule.FS_createDataFile("", path, meshFileData, true, true, true)

    console.time("WSM APILoadGltfFile")
    WSM.Gltf.APILoadGltfFile(historyId, path)
    console.timeEnd("WSM APILoadGltfFile")

    meshIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nMeshType)
    // transform all the mesh ids
    for (const meshId of meshIds) {
      WSM.APITransformObject(historyId, meshId, tf)
    }
  }

  if (meshIds.length > 0) {
    const moveFromCenterTransf3d = centerObjectsAlongWorldCenter(historyId, meshIds)

    for (const meshId of meshIds) {
      if (isTerrainElement) {
        const hintObject = {
          [WSM.INFERENCE_HINT_FORCEZNORMAL]: true,
          [WSM.INFERENCE_HINT_NO_VERTEX_INF]: true,
        }
        WSM.Utils.SetOrCreateStringAttributeForObject(historyId, meshId, WSM.INFERENCE_HINT, JSON.stringify(hintObject))

        // Add an attribute so WSR knows to ignore this
        WSM.Utils.SetOrCreateStringAttributeForObject(
          historyId,
          meshId,
          "WSR_IGNORE",
          "true",
          WSM.nCopyBehavior.nCopyAlways,
        )
      } else if (forBrep) {
        // If we know the mesh is going to become a brep, there is no need
        // to make a line mesh for inferencing. Note making the line mesh
        // does not hurt except for the unnecessary expense.
        lineMeshCache.markAsDontCache(WSM.ObjectHistoryID(historyId, meshId))
      }
    }

    return moveFromCenterTransf3d
  }

  console.warn("Did not create a valid mesh")
}

// Create a new group. Set the copy behavior to be group behavior, not instance behavior.
function createEmptyGroup(historyId: number) {
  const groupId = WSM.APICreateGroup(historyId, [])
  const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, groupId)
  const instanceIds = WSM.APIGetObjectsByTypeReadOnly(historyId, groupId, WSM.nObjectType.nInstanceType)
  if (instanceIds.length !== 1) {
    throw new Error("wrong amount of instances")
  }
  const instanceId = instanceIds[0]
  WSM.APICreateStringAttribute(refHistoryId, FormIt.MAKE_UNIQUE_BEFORE_EDIT_KEY, "", [])
  return {
    groupInstancePath: WSM.GroupInstancePath([WSM.ObjectHistoryID(historyId, instanceId)]),
    refHistoryId,
    groupId,
  }
}

// This loads a string stored in a wsm or axm format to the specified history.
function loadWSMRep(wsmRepAsString: string, historyId: number) {
  const { pointer, length } = allocateStringToMemoryAvailableToWASM(wsmRepAsString)
  const module = window.FormItModule

  module.ccall(
    "WSM_APILoadFromStringWithMemoryPointers",
    "",
    ["number", "number", "number"],
    [historyId, pointer, length],
  )

  if (!module._emscripten_builtin_free) {
    module._free(pointer)
  } else {
    module._emscripten_builtin_free(pointer)
  }
}

async function fetchWSMRep(element: FormaElement): Promise<string | undefined> {
  let refIndex: number = -1
  let isWSMRep: boolean = false
  let isAXMRep: boolean = false

  if (element?.properties?.spacemakerObjectStorageReferences) {
    refIndex = (element?.properties?.spacemakerObjectStorageReferenceFormats as Array<string>).indexOf("wsm")
    if ((element?.properties?.spacemakerObjectStorageReferences as Array<string>)[refIndex]) {
      isWSMRep = true
    } else {
      refIndex = (element?.properties?.spacemakerObjectStorageReferenceFormats as Array<string>).indexOf("axm")
      if ((element?.properties?.spacemakerObjectStorageReferences as Array<string>)[refIndex]) {
        isAXMRep = true
      }
    }
  }

  if (isWSMRep === false && isAXMRep === false) {
    throw new Error(`WSM rep is not defined for ${element.urn}`)
  }

  const wsmOrAXMResult = await request(
    `/api/spacemaker-object-storage/v2/${encodeURIComponent(element?.properties?.spacemakerObjectStorageReferences[refIndex] ?? "")}?authcontext=${encodeURIComponent(PROJECT_ID)}`,
    {
      method: "GET",
    },
  )

  if (wsmOrAXMResult.ok) {
    let wsmRepAsString: string = ""
    if (isWSMRep) {
      wsmRepAsString = await wsmOrAXMResult.text()
    } else {
      // AXM is also stored to s3 in binary for the Revit converter.
      const binaryWSMRepAsBlob: Blob = await wsmOrAXMResult.blob()
      const binaryWSMRepAsArrayBuffer = await binaryWSMRepAsBlob.arrayBuffer()
      const binaryWSMRepAsBytes = new Uint8Array(binaryWSMRepAsArrayBuffer)
      let binaryWSMRepAsString: string = ""
      for (let i = 0; i < binaryWSMRepAsBytes.length; i++) {
        binaryWSMRepAsString += String.fromCharCode(binaryWSMRepAsBytes[i])
      }

      wsmRepAsString = btoa(binaryWSMRepAsString)
    }

    void writeToWSMCache(element.urn, wsmRepAsString)
    return wsmRepAsString
  } else {
    throw new Error(`WSM rep is not defined for ${element.urn}`)
  }
}

export function loadWSMRepAndSetNewGroupReferencedHistory({
  wsmRepAsString,
  targetGroupInstancePath,
  targetRefHistoryId,
  worldTransformToApply,
  path,
  internalRepresentationHeightOffset,
  snapshot,
}: {
  wsmRepAsString: string
  targetGroupInstancePath: WSM.GroupInstancePathInterface
  targetRefHistoryId: number
  worldTransformToApply: WSM.Transf3dInterface
  path: string
  internalRepresentationHeightOffset: number | undefined
  snapshot: ElementSnapshot
}): { transform: WSM.Transf3dInterface; newRefHistId: number } {
  //Should not alter any state in main history in this block
  FormIt.UndoManagement.BeginState()

  const mainHistoryId = WSM.InferenceEngine.GetTopLevelHistory()

  //const tempHistId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
  const previousDelta = WSM.APIGetIdOfActiveDeltaReadOnly(mainHistoryId)

  loadWSMRep(wsmRepAsString, mainHistoryId)

  const newDelta = WSM.APIGetIdOfActiveDeltaReadOnly(mainHistoryId)
  let data: WSM.ChangeDataInterface = { changed: [], created: [], deleted: [] }
  if (newDelta !== previousDelta) {
    data = WSM.APIGetCreatedChangedAndDeletedInDeltaRangeReadOnly(mainHistoryId, previousDelta, newDelta, [
      WSM.nInstanceType,
    ])

    // We expect one instance to be created here.
    if (data.created.length !== 1) {
      console.error(`Expected one instance to be loaded, got ${data.created.length}`)
    }
  }

  let inverseTransformOfLoadedWSMRep = WSM.Geom.Transf3d()
  let totalTransformToApplyToInstance

  let loadedRefHistoryId = WSM.INVALID_ID

  const currentNodeForElement = snapshot.getNode(path)

  if (data.created.length > 0) {
    let instanceId = data.created[0]
    if (data.created.length > 1) {
      // Find the best instance to use based on matching the instance box to the volume mesh box.
      const bboxElement = currentNodeForElement?.elementContainer.bbox.getOrCompute()
      if (bboxElement && bboxElement instanceof Box3) {
        const lowerPt = WSM.Geom.Point3d(
          bboxElement.min.x * METER_TO_FEET,
          bboxElement.min.y * METER_TO_FEET,
          bboxElement.min.z * METER_TO_FEET,
        )
        const upperPt = WSM.Geom.Point3d(
          bboxElement.max.x * METER_TO_FEET,
          bboxElement.max.y * METER_TO_FEET,
          bboxElement.max.z * METER_TO_FEET,
        )
        const bboxElementForWSM = WSM.Interval3d.Interval3d(lowerPt, upperPt)
        for (let index = 0; index < data.created.length; index++) {
          const bboxInstance = WSM.APIGetBoxReadOnly(mainHistoryId, data.created[index])
          if (WSM.Interval3d.AreEqual(bboxElementForWSM, bboxInstance)) {
            instanceId = data.created[index]
            break
          }
        }
      }
    }

    loadedRefHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(mainHistoryId, instanceId)

    const loadedInstancePath = WSM.GroupInstancePath([WSM.ObjectHistoryID(mainHistoryId, instanceId)])

    const loadedTransform = WSM.GroupInstancePath.GetObjectTransform(loadedInstancePath)
    inverseTransformOfLoadedWSMRep = WSM.Geom.InvertTransform(loadedTransform)

    totalTransformToApplyToInstance = WSM.Transf3d.Multiply(worldTransformToApply, loadedTransform)

    if (internalRepresentationHeightOffset === undefined) {
      // This is code to fix old classic 3d sketch elements that were not saved with an
      // internalRepresentationHeightOffset property. We can figure the offset out by
      // comparing the boudning box of the element to the axm bounding box.
      // Note when we have an axm building, we need to compose the bounding boxes of
      // the children taking into account the transforms on the children.
      let bboxElement = getBoundingBox3For3DSElement(snapshot, path)

      if (bboxElement && bboxElement instanceof Box3) {
        const bboxAXM = WSM.APIGetBoxReadOnly(mainHistoryId, instanceId)
        const bboxElementSizeZ = bboxElement.max.z - bboxElement.min.z
        // Sanity check - the boxes should be the same size although possibly different locations.
        const dTol = WSM_DISTANCE_TOL * Math.max(1, Math.abs(bboxElementSizeZ), Math.abs(bboxElement.min.z))
        if (Math.abs(bboxElementSizeZ - (bboxAXM.upper.z - bboxAXM.lower.z) * FEET_TO_METER) < dTol) {
          internalRepresentationHeightOffset = bboxElement.min.z - bboxAXM.lower.z * FEET_TO_METER
        }
      }
    }

    if (internalRepresentationHeightOffset) {
      const offsetVec = WSM.Vector3d.Vector3d(0, 0, METER_TO_FEET * internalRepresentationHeightOffset)
      const translationTransf = WSM.Transf3d.MakeTranslationTransform(offsetVec)
      totalTransformToApplyToInstance = WSM.Transf3d.Multiply(translationTransf, totalTransformToApplyToInstance)
    }

    const owningGroups: WSM.ObjectHistoryID[] = WSM.APIGetHistoryReferencingGroupsReadOnly(targetRefHistoryId)
    if (owningGroups.length === 0) {
      throw new Error(`No owning group for targetRefHistoryId: ${targetRefHistoryId}`)
    }
    const targetGroupId = owningGroups[0].Object
    const targetInstanceId = targetGroupInstancePath.ids[0].Object

    const levelsOnInst = WSM.APIGetObjectLevelsReadOnly(mainHistoryId, instanceId)
    WSM.APISetGroupReferencedHistory(mainHistoryId, targetGroupId, loadedRefHistoryId)

    // Make sure the newly loaded wsm geometry acts like a group not a component.
    const makeUniqueAtts = WSM.APIGetStringAttributesByKeyReadOnly(
      loadedRefHistoryId,
      WSM.INVALID_ID,
      FormIt.MAKE_UNIQUE_BEFORE_EDIT_KEY,
    )
    if (makeUniqueAtts.length === 0) {
      WSM.APICreateStringAttribute(loadedRefHistoryId, FormIt.MAKE_UNIQUE_BEFORE_EDIT_KEY, "", [])
    }

    if (levelsOnInst?.length) {
      WSM.APISetObjectProperties(mainHistoryId, targetInstanceId, "", true, levelsOnInst)
    }

    if (!levelsOnInst?.length) {
      const curElement = currentNodeForElement?.elementContainer.element
      if (curElement && curElement.properties?.category === "building" && curElement.children?.length) {
        console.error("We're fixing a data regression. Rebuilding level data from floor elements.")
        const levelDataArray: LevelData[] = []
        const levelHeights: number[] = []
        // Loop through the element children, get the child element, then convert the gfaUnits to level data and add it to level data array
        curElement.children.forEach((child) => {
          const childElement = snapshot.getNode(path + "/" + child.key)?.elementContainer.element
          if (childElement && childElement.representations?.gfaUnits) {
            const gfaUnits = getRepresentationJsonUnsafe(childElement.representations.gfaUnits)
            gfaUnits.forEach((unit) => {
              if (unit.areas.length > 0) {
                levelHeights.push(unit.areas[0].elevation)
              }
            })
          }
        })
        levelHeights.sort((a, b) => a - b)

        if (levelHeights.length > 0) {
          const t = getTranslator()
          const firstFloorHeight = levelHeights[0] * METER_TO_FEET
          levelDataArray.push({
            first: t(($) => $.wsm.floors.floorWithNumberLabel, { level: levelDataArray.length + 1 }),
            second: firstFloorHeight < 0.01 ? 0 : firstFloorHeight,
          })
          for (let i = 1; i < levelHeights.length; i++) {
            if ((levelHeights[i] - levelHeights[i - 1]) * METER_TO_FEET > 0.01) {
              levelDataArray.push({
                first: t(($) => $.wsm.floors.floorWithNumberLabel, {
                  level: levelDataArray.length + 1,
                }),
                second: levelHeights[i] * METER_TO_FEET,
              })
            }
          }
        }

        if (levelDataArray.length) {
          addWSMLevelDataToWSMInstance(mainHistoryId, targetInstanceId, levelDataArray)
        }
      }
    }

    //Update string attributes that are used for debugging in model tree.
    //The code below deletes all the path attributes except one if it is
    //correct.
    let stringAttribsToDelete: number[] = []
    let createStringAttrib = true
    const allStringAttribs = WSM.APIGetStringAttributesByKeyReadOnly(
      loadedRefHistoryId,
      WSM.INVALID_ID,
      "Forma::ElementPath",
    )

    allStringAttribs.forEach((stringId) => {
      const stringKeyVal = WSM.APIGetStringAttributeKeyValueReadOnly(loadedRefHistoryId, stringId)
      if (createStringAttrib === true && stringKeyVal.sValue === path) {
        createStringAttrib = false
      } else {
        stringAttribsToDelete.push(stringId)
      }
    })

    if (stringAttribsToDelete.length > 0) {
      WSM.APIDeleteObjects(loadedRefHistoryId, stringAttribsToDelete)
    }

    if (createStringAttrib) {
      WSM.APICreateStringAttribute(
        loadedRefHistoryId,
        "Forma::ElementPath",
        path,
        [],
        WSM.nCopyBehavior.nDoNotCopyNorShare,
        false,
      )
    }

    WSM.APIDeleteHistory(targetRefHistoryId)
    WSM.APIDeleteObjects(mainHistoryId, data.created)
  }

  FormIt.UndoManagement.EndState("sync create for path")

  if (loadedRefHistoryId !== WSM.INVALID_ID) {
    // Prevent undoing before the current State for refHistoryId
    const currentState = FormIt.UndoManagement.GetCurrentState(loadedRefHistoryId)
    FormIt.UndoManagement.SetMinimumHistoryStateID(loadedRefHistoryId, currentState)
  }

  if (totalTransformToApplyToInstance) {
    applyWorldTransform(targetGroupInstancePath, totalTransformToApplyToInstance)
  }

  return {
    transform: inverseTransformOfLoadedWSMRep,
    newRefHistId: loadedRefHistoryId !== WSM.INVALID_ID ? loadedRefHistoryId : targetRefHistoryId,
  }
}

//Should not alter any state in main history here.
function loadAlternativeRepInRefHistory({
  data,
  urn,
  refHistoryId,
  path,
  useImperial,
  terrainGIP,
  groupInstancePath,
}: {
  data: SideEffectData
  urn: Urn
  refHistoryId: number
  path: string
  useImperial: boolean
  terrainGIP: WSM.GroupInstancePathInterface | undefined
  groupInstancePath: WSM.GroupInstancePathInterface
}) {
  getMessageHandler().broadcastJSMessage("WSR.PauseUpdates", true)
  FormIt.UndoManagement.BeginState()

  //used for debugging in model tree
  WSM.APICreateStringAttribute(
    refHistoryId,
    "Forma::ElementPath",
    path,
    [],
    WSM.nCopyBehavior.nDoNotCopyNorShare,
    false,
  )

  const scale = useImperial ? METER_TO_FEET : 1

  let inverseTransform: WSM.Transf3dInterface | undefined

  if (data.floorDataArray && data.floorDataArray.length > 0) {
    inverseTransform = createBrepFromFloorDataArray(refHistoryId, data.floorDataArray, scale, groupInstancePath)
  } else if (data.geoJSON) {
    if (data.volumeMesh) {
      inverseTransform = createBrepFromGeoJSON(refHistoryId, data.geoJSON, scale)
    } else if (terrainGIP !== undefined) {
      inverseTransform = createBoundaryFromGeoJSONAndTerrain(
        refHistoryId,
        terrainGIP,
        data.geoJSON,
        scale,
        data.worldTransform,
      )
    }
  } else {
    inverseTransform = createWSMMesh({
      historyId: refHistoryId,
      worldTransform:
        data.childTransform /* We want the child transform for imports applied here and not as part of the instance transform.*/,
      volumeMesh: data.volumeMesh,
      scale,
      urn,
      forBrep: data.forBrep ? data.forBrep : false,
      meshFileData: data.meshFileContents,
    })

    if (
      groupInstancePath.ids.length > 0 &&
      data.element.properties?.category === "building" &&
      (data.element.children === undefined || data.element.children.length === 0) &&
      data.element.representations?.gfaUnits !== undefined
    ) {
      // Add levels to the WSM instance at the heights of the gfa units.
      const gfaUnits = getRepresentationJsonUnsafe(data.element.representations.gfaUnits)
      const levelHeights: number[] = []
      gfaUnits.forEach((unit) => {
        if (unit.areas.length > 0) {
          levelHeights.push(unit.areas[0].elevation)
        }
      })
      levelHeights.sort((a, b) => a - b)

      const levelDataArray: LevelData[] = []
      if (levelHeights.length > 0) {
        const t = getTranslator()
        const minZ = inverseTransform ? inverseTransform.data[11] : 0
        const firstFloorHeight = levelHeights[0] * METER_TO_FEET - minZ
        levelDataArray.push({
          first: t(($) => $.wsm.floors.floorWithNumberLabel, { level: levelDataArray.length + 1 }),
          second: firstFloorHeight < 0.01 ? 0 : firstFloorHeight,
        })
        for (let i = 1; i < levelHeights.length; i++) {
          if ((levelHeights[i] - levelHeights[i - 1]) * METER_TO_FEET > 0.01) {
            levelDataArray.push({
              first: t(($) => $.wsm.floors.floorWithNumberLabel, {
                level: levelDataArray.length + 1,
              }),
              second: levelHeights[i] * METER_TO_FEET - minZ,
            })
          }
        }
      }

      addWSMLevelDataToWSMInstance(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object, levelDataArray)
      console.log("levelHeightsNoDuplicates", levelDataArray)
    }
  }

  FormIt.UndoManagement.EndState("sync create for path")
  // Prevent undoing before the current State for refHistoryId
  const currentState = FormIt.UndoManagement.GetCurrentState(refHistoryId)
  FormIt.UndoManagement.SetMinimumHistoryStateID(refHistoryId, currentState)
  getMessageHandler().broadcastJSMessage("WSR.PauseUpdates", false)
  return inverseTransform
}

class WsmSideEffectAdapter implements ElementStateSideEffectInterface {
  cache: SideEffectAdapterCache = new Map()

  mapping: Map<InternalPath, WSMDetailsForElementPath> = new Map()

  // If the same path is synced multiple times (with work done
  // once because of the pathsPendingLoad set), we keep only
  // the last onReady callback. So for example, if a path is
  // syncing but not finished before sync is called with the
  // same path to start i3ds, we'll keep the onReadyCallback
  // that starts i3ds with this map.
  pathToOnReadyMap: Map<InternalPath, () => void> = new Map()

  // Set of paths that are pending loading. This is used to prevent
  // loading the same path multiple times.
  pathsPendingLoad: Set<InternalPath> = new Set()

  // If urns are re-used, keep map to share geometry. We need both the reference
  // history id and the transform used to center the geometry in the instance but
  // save the inverse of that since it is more efficient.
  mapUrnToRefIdInverseTranf3f: Map<Urn, { refHistId: number; inverseTransf3d: WSM.Transf3dInterface }> = new Map()

  // This is called when editing an element in i3ds on save. Note the reference history could have changed if
  // the element was previously shared. Get it again.
  updateCacheFromSave(path: InternalPath, replacementUrn: Urn, transform?: Transform) {
    const cacheVal = this.cache.get(path)
    if (cacheVal !== undefined) {
      this.cache.set(path, { urn: replacementUrn, transform: transform !== undefined ? transform : cacheVal.transform })
    }

    const wsmDetailsVal = this.mapping.get(path)
    if (wsmDetailsVal !== undefined) {
      // Update the urn to ref history id map.
      this.mapUrnToRefIdInverseTranf3f.delete(wsmDetailsVal.urn)
      if (wsmDetailsVal.groupInstancePath.ids.length === 1) {
        const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
          wsmDetailsVal.groupInstancePath.ids[0].History,
          wsmDetailsVal.groupInstancePath.ids[0].Object,
        )
        const identityTransf3d = WSM.Geom.Transf3d()
        this.mapUrnToRefIdInverseTranf3f.set(replacementUrn, { refHistId, inverseTransf3d: identityTransf3d })
      }

      this.mapping.set(path, {
        ...wsmDetailsVal,
        urn: replacementUrn,
        hasOwnedWSMOrAXMRep: true,
        appliedWorldTransform: transform !== undefined ? transform : wsmDetailsVal.appliedWorldTransform,
      })
    }
  }

  // Function adds an entry to the map and cache. This is called when creating a new
  // element in i3ds.
  addExternalDataToMapAndCache(path: InternalPath, details: WSMDetailsForElementPath) {
    this.mapping.set(path, details)
    this.cache.set(path, { urn: details.urn, transform: details.appliedWorldTransform })

    // Save to mapUrnToRefIdInverseTranf3f
    if (details.groupInstancePath.ids.length === 1) {
      const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
        details.groupInstancePath.ids[0].History,
        details.groupInstancePath.ids[0].Object,
      )
      const identityTransf3d = WSM.Geom.Transf3d()
      this.mapUrnToRefIdInverseTranf3f.set(details.urn, { refHistId, inverseTransf3d: identityTransf3d })
    }
  }

  useImperialInWSM = false

  // The terrain path is set once the terrain has been synced and is available.
  // Note terrain syncing is asynchronous which is why we need this flag.
  terrainGIP: WSM.GroupInstancePathInterface | undefined

  // Array of callbbacks that happen only after terrain is synced.
  terrainSyncDependencies: Array<() => void | Promise<void>> = []

  // Note: this needs to be called before everything else.
  // Would be better to set this in the constructor, but that
  // would involve changing a lot more code to make this not a
  // global object
  setImperial(imperial: boolean) {
    this.useImperialInWSM = imperial
  }

  loadSync({
    mainHistoryId,
    urn,
    groupInstancePath,
    refHistoryId,
    path,
    data,
    worldTransformToApply,
  }: {
    mainHistoryId: number
    urn: Urn
    groupInstancePath: WSM.GroupInstancePathInterface
    refHistoryId: number //this refHistoryId is matched with the groupInstancePath, just passing it
    path: InternalPath
    data: SideEffectData
    worldTransformToApply: WSM.Transf3dInterface
  }): WSM.Transf3dInterface {
    let inverseTransf3d = WSM.Geom.Transf3d()

    const inverseTransform = loadAlternativeRepInRefHistory({
      data,
      urn,
      refHistoryId,
      path,
      useImperial: this.useImperialInWSM,
      terrainGIP: this.terrainGIP,
      groupInstancePath,
    })

    const instanceId = groupInstancePath.ids[0].Object

    // Suppose S is the scale transformation, W is the world transformation, C is the center and
    // align transformation. C^(-1) is returned from loadAlternativeRepInRefHistory. Then on the
    // instance we have S * W * S^(-1) * C^(-1) and on the geometry in the ref history, we have
    // C * S * geometry. Note S * W * S^(-1) is the same as just scaling the translation part of
    // W. So the overall transformation is S * W * S^(-1) * C^(-1) * C * S = S * W as we'd want.
    // The ref geometry is aligned and scaled as required.

    //Also when applying transform, operate in this order so when we save to cache we are not
    //saving the world transform, which could change.
    //1. apply inverse trans
    //2. save to cache, if it should
    //3. apply world transform

    //Step 1
    if (inverseTransform) {
      inverseTransf3d = inverseTransform

      WSM.APITransformObject(mainHistoryId, instanceId, inverseTransf3d)
    }

    //Step 2
    //Caching only terrain on load for now.
    const isCreatingTerrainElement = parseUrn(urn).system === "terrain"
    if (isCreatingTerrainElement) {
      const owningGroups = WSM.APIGetHistoryReferencingGroupsReadOnly(refHistoryId)

      if (owningGroups.length === 1) {
        const terrainGroupId = owningGroups[0].Object

        //TODO Something to investigate - discussed, with Seth that we should
        //be able to save with instanceId here, but that isn't working properly
        const wsmRepAsAXMString = WSM.APISaveToAXMStringReadOnly(WSM.InferenceEngine.GetTopLevelHistory(), [
          terrainGroupId,
        ])
        void writeToWSMCache(urn as string, wsmRepAsAXMString)
      } else {
        console.warn("Did not find exactly one group instance path when trying to cache terrain")
      }
    }

    //Step 3
    WSM.APITransformObject(mainHistoryId, instanceId, worldTransformToApply)

    return inverseTransf3d
  }

  //This code does the following:
  //Try to lookup element wsm rep in cache, load it if found.
  //Else if the element owns a WSM rep, fetch it over network and load it
  //Finally, default to loading another representation (mesh or geoJSON, currently)
  async loadAsync({
    mainHistoryId,
    element,
    hasOwnedWSMOrAXMRep,
    groupInstancePath,
    refHistoryId,
    path,
    data,
    worldTransformToApply,
    isTerrainElement,
    snapshot,
  }: {
    mainHistoryId: number
    element: FormaElement
    hasOwnedWSMOrAXMRep: boolean
    groupInstancePath: WSM.GroupInstancePathInterface
    refHistoryId: number //this refHistoryId is matched with the groupInstancePath, just passing it
    path: InternalPath
    data: SideEffectData
    worldTransformToApply: WSM.Transf3dInterface
    isTerrainElement: boolean
    snapshot: ElementSnapshot
  }) {
    let inverseTransf3d = WSM.Geom.Transf3d()

    const urn = element.urn

    let wsmRepAsString: string | undefined = await readFromWSMCache(urn)

    if (!isTerrainElement) {
      // Attempt recovery if the user has unsaved changes and confirms they want to continue
      wsmRepAsString = await recoveryForEdit(path, element.urn, wsmRepAsString)
    }

    if (!wsmRepAsString && hasOwnedWSMOrAXMRep) {
      wsmRepAsString = await fetchWSMRep(element)
    }

    if (wsmRepAsString) {
      const { transform, newRefHistId } = loadWSMRepAndSetNewGroupReferencedHistory({
        wsmRepAsString,
        targetGroupInstancePath: groupInstancePath,
        targetRefHistoryId: refHistoryId,
        worldTransformToApply,
        path,
        internalRepresentationHeightOffset: isTerrainElement
          ? 0
          : element.properties?.internalRepresentationHeightOffset,
        snapshot,
      })
      inverseTransf3d = transform
      refHistoryId = newRefHistId
    } else {
      inverseTransf3d = this.loadSync({
        mainHistoryId,
        urn,
        groupInstancePath,
        refHistoryId,
        path,
        data,
        worldTransformToApply,
      })
    }

    if (data.volumeMesh !== undefined || (hasOwnedWSMOrAXMRep && data.element.properties?.category === "building")) {
      // The only 2D data we sync is site limit and zone. These cannot be instanced since they
      // must be recreated at each location to match the terrain. Also a 3d sketch building does
      // not have a volume mesh as it is on the floors.
      this.mapUrnToRefIdInverseTranf3f.set(urn, { refHistId: refHistoryId, inverseTransf3d })
    }

    this.mapping.set(path, {
      urn,
      groupInstancePath,
      hasOwnedWSMOrAXMRep,
      appliedWorldTransform: data.worldTransform,
    })

    // For debugging, sometimes it is nice to sleep right here to check for race
    // conditions in sync.
    //const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    //await sleep(20000)

    // now ready in WSM
    this.callOnReadyAndRemoveFromPendingLoad(path)

    if (isTerrainElement) {
      // Set the terrain path so elements that require terrain to sync (like site limits and zone),
      // can be synced
      this.terrainGIP = groupInstancePath

      WSM.InferenceEngine.SetGroundObject(this.terrainGIP)

      // If we have callbacks waiting for terrain to be finished, call them.
      while (this.terrainSyncDependencies.length > 0) {
        const syncCallback = this.terrainSyncDependencies.shift()
        if (syncCallback) {
          void syncCallback()
        }
      }
    }
  }

  // This does all the work of create but is separated out so it can be used in a callback
  // for site limits and zones when the terrain is not ready.
  async createInternal(path: InternalPath, urn: Urn, data: SideEffectData, mainHistoryId: number) {
    // see if we should read the mesh data from the import service
    try {
      if (
        data.volumeMesh &&
        data.volumeMesh.position.length >= TRIANGLE_THRESHOLD_FOR_USE_GLB &&
        data.element.representations?.underlyingGlb
      ) {
        const underlyingGlb = await loadRepresentationBinary(
          data.element.urn,
          data.element.representations.underlyingGlb,
          getElementsClient(),
        )

        if (underlyingGlb) {
          data.meshFileContents = new Uint8Array(underlyingGlb)
        }
      }
    } catch (e) {
      console.error("Error fetching underlying glb data", e)
    }

    const refHistIdInverseTransf3d = this.mapUrnToRefIdInverseTranf3f.get(urn)
    if (refHistIdInverseTransf3d) {
      // Make a new instance of the reference history.
      if (refHistIdInverseTransf3d.refHistId) {
        const allOwningGroups: WSM.ObjectHistoryID[] = WSM.APIGetHistoryReferencingGroupsReadOnly(
          refHistIdInverseTransf3d.refHistId,
        )
        if (allOwningGroups.length === 1 && allOwningGroups[0].History === mainHistoryId) {
          // Add a new instance to the group.
          const transf3ds: WSM.Transf3dInterface[] = []
          const worldTransformToApply = WSM.Transf3d.Multiply(
            createScaledPositionWorldTransform(data.worldTransform),
            refHistIdInverseTransf3d.inverseTransf3d,
          )
          transf3ds.push(worldTransformToApply)
          const newInstances = WSM.APIAddInstancesToGroup(mainHistoryId, allOwningGroups[0].Object, transf3ds)

          // If the element is a building, add levels to the new instance.
          if (newInstances.length === 1 && data.element.representations?.buildingFloors3DSketch_UNSTABLE) {
            const buildingRep = await loadRepresentationJson(
              data.element.urn,
              data.element.representations?.buildingFloors3DSketch_UNSTABLE,
              getElementsClient(),
            )
            const t = getTranslator()
            const wsmLevelDataArray: LevelData[] = []
            const lowestElevation =
              buildingRep.floors3d.length > 0 ? buildingRep.floors3d[0].elevation * METER_TO_FEET : 0
            buildingRep.floors3d.forEach((floor, index) => {
              wsmLevelDataArray.push({
                first: t(($) => $.wsm.floors.floorWithNumberLabel, { level: index + 1 }),
                second: floor.elevation * METER_TO_FEET - lowestElevation,
              })
            })
            if (wsmLevelDataArray.length > 0) {
              const levelIds = WSM.APICreateLevelObjects(mainHistoryId, wsmLevelDataArray, true)
              WSM.APISetObjectProperties(mainHistoryId, newInstances[0], "", true, levelIds)
            }
          }

          this.mapping.set(path, {
            urn,
            groupInstancePath: WSM.GroupInstancePath([WSM.ObjectHistoryID(mainHistoryId, newInstances[0])]),
            hasOwnedWSMOrAXMRep: false,
            appliedWorldTransform: data.worldTransform,
          })

          this.callOnReadyAndRemoveFromPendingLoad(path)
          return
        }
      }
    }

    let hasOwnedWSMOrAXMRep = false
    const element = data.element

    if (element?.properties?.spacemakerObjectStorageReferences) {
      const refIndex = (element?.properties?.spacemakerObjectStorageReferenceFormats as Array<string>).indexOf("wsm")
      if ((element?.properties?.spacemakerObjectStorageReferences as Array<string>)[refIndex]) {
        hasOwnedWSMOrAXMRep = true
      } else {
        const refIndex = (element?.properties?.spacemakerObjectStorageReferenceFormats as Array<string>).indexOf("axm")
        if ((element?.properties?.spacemakerObjectStorageReferences as Array<string>)[refIndex]) {
          hasOwnedWSMOrAXMRep = true
        }
      }
    }

    const { groupInstancePath, refHistoryId } = createEmptyGroup(mainHistoryId)

    // Save element category with top level instance, if element is a constraint
    const category = getMappedCategory(element)
    if (category === "constraints") {
      const topObjectHistoryID = WSM.GroupInstancePath.GetTopObjectHistoryID(groupInstancePath)
      WSM.Utils.SetOrCreateStringAttributeForObject(
        topObjectHistoryID.History,
        topObjectHistoryID.Object,
        WSM.Utils.FORMA_CATEGORY,
        category,
        WSM.nCopyBehavior.nDoNotCopyNorShare,
        false,
      )
    }

    let worldTransformToApply = createScaledPositionWorldTransform(data.worldTransform)

    const isTerrainElement = parseUrn(urn).system === "terrain"

    //Currently, we know that terrain and elements with an owned WSM rep can (or need to) asyncrously load
    //as we try to look up the WSM rep in cache or fetch it over network
    if (isTerrainElement || hasOwnedWSMOrAXMRep || recoveryExists(path)) {
      this.loadAsync({
        mainHistoryId,
        element,
        hasOwnedWSMOrAXMRep,
        groupInstancePath,
        refHistoryId,
        path,
        data,
        worldTransformToApply,
        isTerrainElement,
        snapshot: elementState.currentSnapshot.peek(),
      }).catch((err) => {
        captureException(err, {
          tags: { owner: "conceptual", errorPoint: "Load Async", "integration-type": "integrated" },
        })
      })
    } else {
      try {
        const inverseTransf3d = this.loadSync({
          mainHistoryId,
          urn,
          groupInstancePath,
          refHistoryId,
          path,
          data,
          worldTransformToApply,
        })

        if (data.volumeMesh !== undefined) {
          // The only 2D data we sync is site limit and zone. These cannot be instanced since they
          // must be recreated at each location to match the terrain.
          this.mapUrnToRefIdInverseTranf3f.set(urn, { refHistId: refHistoryId, inverseTransf3d })
        }

        this.mapping.set(path, {
          urn,
          groupInstancePath,
          hasOwnedWSMOrAXMRep,
          appliedWorldTransform: data.worldTransform,
        })

        // now ready in WSM
        this.callOnReadyAndRemoveFromPendingLoad(path)
      } catch (err) {
        captureException(err, {
          tags: { owner: "conceptual", errorPoint: "Load Sync", "integration-type": "integrated" },
        })
      }
    }
  }

  create(path: InternalPath, urn: Urn, data: SideEffectData, onReady?: () => void /* ready for editing in WSM */) {
    this.pathsPendingLoad.add(path)
    if (onReady) {
      this.pathToOnReadyMap.set(path, onReady)
    }

    const mainHistoryId = WSM.InferenceEngine.GetTopLevelHistory()
    if (mainHistoryId === WSM.INVALID_ID) return

    const isWsmOrAxmBacked =
      data.element.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm") ||
      data.element.properties?.spacemakerObjectStorageReferenceFormats?.includes("wsm")

    if (!data.volumeMesh && !isWsmOrAxmBacked && !data.floorDataArray) {
      if (data.element?.representations === undefined) {
        // We have no data to sync with.
        this.pathsPendingLoad.delete(path)
        return
      }

      const terrainShapeRep = data.element.representations?.terrainShape

      if (terrainShapeRep === undefined) {
        // There is nothing to sync with this element so return.
        this.pathsPendingLoad.delete(path)
        return
      }

      if (this.terrainGIP === undefined) {
        // Add a callback to sync the ground polygons once terrain is loaded.
        this.terrainSyncDependencies.push(this.createInternal.bind(this, path, urn, data, mainHistoryId))
        return
      }
    }

    void this.createInternal(path, urn, data, mainHistoryId)
  }

  // Deletes the instance and reference history for an aborted 3d sketch
  // element create and for 3d sketch element deletion.
  // TODO: delete all unreachable referenced histories.
  deleteSyncDataForGIP(groupInstancePath: WSM.GroupInstancePathInterface): boolean {
    let bDeletedRefHistory = false
    try {
      if (groupInstancePath.ids.length !== 1) {
        return bDeletedRefHistory
      }

      const finalObjectHistoryId = WSM.Utils.GetGroupInstancePathFinalObjectHistoryID(groupInstancePath)
      const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(
        finalObjectHistoryId.History,
        finalObjectHistoryId.Object,
      )
      WSM.APIDeleteObjects(finalObjectHistoryId.History, [finalObjectHistoryId.Object])
      const owners = WSM.APIGetHistoryReferencingGroupsReadOnly(refHistoryId)
      if (owners.length === 0) {
        // Shared ref histories (for example with tree area), mean we cannot assume
        // the ref history is unused after deleting the owning instance.
        WSM.APIDeleteHistory(refHistoryId)
        bDeletedRefHistory = true
      }
    } catch (err) {
      captureException(err, {
        tags: { owner: "conceptual", errorPoint: "deleteSyncDataForGIP", "integration-type": "integrated" },
      })
    }

    return bDeletedRefHistory
  }

  // Deletes the data stored for WSM syncing including the instance and if unused the history
  // referenced by the instance.
  delete(path: InternalPath): void {
    try {
      const current = this.mapping.get(path)?.groupInstancePath
      if (!isDefined(current)) {
        return
      }

      const bDeletedRefHistory = this.deleteSyncDataForGIP(current)
      const wsmDetailsForElementPath = this.mapping.get(path)
      this.mapping.delete(path)
      if (wsmDetailsForElementPath && bDeletedRefHistory) {
        this.mapUrnToRefIdInverseTranf3f.delete(wsmDetailsForElementPath?.urn)
      }
    } catch (err) {
      captureException(err, { tags: { owner: "conceptual", errorPoint: "Delete", "integration-type": "integrated" } })
    }
  }

  update(
    path: InternalPath,
    urn: Urn,
    data: SideEffectData,
    onReady?: () => void /* ready for editing in WSM */,
  ): void {
    this.pathsPendingLoad.add(path)
    if (onReady) {
      this.pathToOnReadyMap.set(path, onReady)
    }

    const wsmDetailsForElementPath = this.mapping.get(path)

    if (wsmDetailsForElementPath) {
      const isLoadedWithSameUrnInWSM = urn === wsmDetailsForElementPath.urn

      //Just for WSM backed elements for now, just transform if we can.
      //Though there is future POTENTIAL to include things like meshes - just need to get transform on instance vs mesh
      //If the cache has the same urn as the mapping to what's in memory of WSM, then all we need to do is transform
      //Ground polygons must be re-intersected with the terrain if moved, so also verify there is a volumeMesh. Also
      //allow axm backed buildings (which only have volumeMesh per child floor elements) for updateTransform.
      if (
        wsmDetailsForElementPath.hasOwnedWSMOrAXMRep &&
        isLoadedWithSameUrnInWSM &&
        (data.volumeMesh !== undefined || data.element.properties?.category === "building")
      ) {
        this.updateTransform(path, data, wsmDetailsForElementPath)
      } else {
        this.delete(path)
        this.create(path, urn, data, onReady /* ready for editing in WSM */)
      }
    }
  }

  updateTransform(path: InternalPath, data: SideEffectData, wsmDetailsForElementPath: WSMDetailsForElementPath): void {
    const worldTransformToApply = createScaledPositionWorldTransform(data.worldTransform)
    const worldTransformToInverse = createScaledPositionWorldTransform(wsmDetailsForElementPath?.appliedWorldTransform)
    applyWorldTransform(wsmDetailsForElementPath.groupInstancePath, worldTransformToApply, worldTransformToInverse)
    wsmDetailsForElementPath.appliedWorldTransform = data.worldTransform
    this.mapping.set(path, wsmDetailsForElementPath)
    // now ready for editing in WSM
    this.callOnReadyAndRemoveFromPendingLoad(path)
  }

  // Calls associated onReady callback and removes the path from the pending load set.
  callOnReadyAndRemoveFromPendingLoad(path: InternalPath): void {
    const onReady = this.pathToOnReadyMap.get(path)
    onReady?.()
    this.pathToOnReadyMap.delete(path)
    this.pathsPendingLoad.delete(path)
  }

  // Sets the onReady callback for a path. This is used so only the last onReadyCallback
  // is called when a sync is finished.
  setOnReadyCallback(path: InternalPath, onReady: () => void): void {
    this.pathToOnReadyMap.set(path, onReady)
  }

  isPendingLoad(path: InternalPath): boolean {
    return this.pathsPendingLoad.has(path)
  }

  isLoading(): boolean {
    return this.pathsPendingLoad.size !== 0
  }
}

export const wsmSideEffectAdapter = new WsmSideEffectAdapter()
