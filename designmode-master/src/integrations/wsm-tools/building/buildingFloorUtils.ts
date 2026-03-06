import type { FormaElement, Urn } from "@spacemakerai/element-types"
import type { LevelData } from "src/integrations/wsm-tools/wsr/integrated/types"
import type {
  MultiRingPolygon,
  Polygon,
  ReducedMeshesAndTransformsData,
  WSMGeometryData,
} from "src/integrations/wsm-tools/wsr/api/types"
import { WSM_DISTANCE_TOL, WSM_MACHINE_TOL } from "src/integrations/wsm-tools/wsr/api/types"
import type { InternalPath } from "src/lib/element/path"
import { getParentPath } from "src/lib/element/path"
import { reducedMeshesArrayToWSMGeometryData } from "src/integrations/wsm-tools/wsr/api/mapping"
import { FEET_TO_METER } from "@spacemakerai/forma-units"
import { getTranslator } from "src/i18n"
export type GrossFloorAreaType = "CORE" | "CORRIDOR" | "LIVING_UNIT" | "UNASSIGNED"
export type GrossFloorAreaPolygon = {
  grossFloorPolygon: MultiRingPolygon
  elevation: number
  areaType: GrossFloorAreaType
}

// String key for attributes to find a group containing all floors, each floor
// in its own group.
export const keyForFloorBrepsAttribute: string = "I3dS: Floor collection"

// String key for the floor index on the group containing all the breps from the floor.
export const keyForFloorIndexAttribute: string = "I3DS: Floor index"

// The minimum area in feet squared that will be used for gfa units.
export const minGFAUnitAreaInFeetSquared = 4.0

// Determines if the current editing path is a Building (has levels) or Generic (no levels)
export function isCurrentI3DSPathBuilding() {
  const editingPath = FormIt.GroupEdit.GetInContextEditingPath()
  // Only do the Levels check if the editing path is valid
  if (WSM.GroupInstancePath.IsValid(editingPath)) {
    const topObjectHistoryId = WSM.GroupInstancePath.GetTopObjectHistoryID(editingPath)
    if (WSM.APIIsObjectLiveReadOnly(topObjectHistoryId.History, topObjectHistoryId.Object)) {
      const levelIds = WSM.APIGetObjectLevelsReadOnly(topObjectHistoryId.History, topObjectHistoryId.Object)
      // If one or more levels found, this is a building
      if (levelIds !== undefined && levelIds.length > 0) {
        return true
      } else {
        return false
      }
    } else {
      // If we delete all geometry, the instance is deleted too.
      return false
    }
    // Not a building if editing path is not valid
  } else {
    return false
  }
}

// Determines if a WSM object can have levels added by checking its volume and bounding box size
// and whether levels already exist when bIgnoreLevels is either undefined or false.
export function canAddLevelsToInstance(
  historyId: number,
  instanceId: number,
  floorHeight: number,
  bIgnoreLevels?: boolean,
): boolean {
  const instanceBox = WSM.APIGetBoxReadOnly(historyId, instanceId)

  // If too short to support a floor, return false
  if (instanceBox?.upper.z - instanceBox?.lower.z + WSM_MACHINE_TOL <= floorHeight) {
    return false
  }

  if (bIgnoreLevels !== true) {
    // If the instance already has levels, return false. Don't add again.
    const levelIds = WSM.APIGetObjectLevelsReadOnly(historyId, instanceId)
    if (levelIds?.length > 0) {
      return false
    }
  } else {
    // Make sure we can calculate the instance volume from meshes which is what we get from
    // dynamo elements with gfa units and no floors.
    const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, instanceId)
    const meshIds = WSM.APIGetAllObjectsByTypeReadOnly(refHistId, WSM.nObjectType.nMeshType)
    meshIds.forEach((meshId) => {
      WSM.APISetMeshEdgesComputed(refHistId, meshId, true)
    })
  }

  // Finally check the instance volume. No levels if the volume is zero.
  const dVolume = WSM.APIComputeVolumeReadOnly(historyId, instanceId)
  if (dVolume < WSM_MACHINE_TOL) {
    return false
  }

  return true
}

// Applies new levels to the given instance based on a given floor height. Nothing fancy here!
export function addLevelsToInstance(historyId: number, instanceId: number, floorHeightInFeet: number) {
  const instanceBox = WSM.APIGetBoxReadOnly(historyId, instanceId)

  let levelIndex = 1
  let nextFloorElevationInFeet = 0
  const wsmLevelData: LevelData[] = []

  const t = getTranslator()

  // We want the levels to always start at 0 and end so the top floor has floorHeight height
  // at least.
  while (instanceBox.lower.z + nextFloorElevationInFeet < instanceBox.upper.z + WSM_MACHINE_TOL - floorHeightInFeet) {
    wsmLevelData.push({
      first: t(($) => $.wsm.floors.floorWithNumberLabel, { level: levelIndex }),
      second: nextFloorElevationInFeet,
    })

    nextFloorElevationInFeet += floorHeightInFeet
    levelIndex++
  }

  if (wsmLevelData.length > 0) {
    const levelsIds = WSM.APICreateLevelObjects(historyId, wsmLevelData, true)
    WSM.APISetObjectProperties(historyId, instanceId, "", true, levelsIds)
  }
}

export function removeLevels(historyId: number, objectId: number) {
  const currentLevels = WSM.APIGetObjectLevelsReadOnly(historyId, objectId)
  if (!currentLevels.length) return
  WSM.APIDeleteObjects(historyId, currentLevels)
}

// Rename all levels
export function renameLevels(historyId: number, objectId: number) {
  const currentLevels = WSM.APIGetObjectLevelsReadOnly(historyId, objectId)
  const mainHistoryId = FormIt.Model.GetHistoryID()
  if (currentLevels.length === 0) return

  const wsmLevelData: LevelData[] = currentLevels.map((levelId) => {
    // Get current level data
    const levelData = WSM.APIGetLevelDataReadOnly(mainHistoryId, levelId, false)
    const { sLevelName: first, dElevation: second } = levelData
    const wsmLevelData: LevelData = { first, second }
    return wsmLevelData
  })

  // Create new levels with the same elevations but new names
  const newWSMLevelData: LevelData[] = []

  const t = getTranslator()

  // Rename all levels
  for (let i = 0; i < wsmLevelData.length; i++) {
    newWSMLevelData.push({
      first: t(($) => $.wsm.floors.floorWithNumberLabel, { level: i + 1 }),
      second: wsmLevelData[i].second,
    })
  }

  // Check if the current levels and new levels data have the same length
  if (wsmLevelData.length === newWSMLevelData.length) {
    WSM.APISetLevelsData(historyId, currentLevels, newWSMLevelData, true)
  } else {
    throw new Error("Renaming levels failed, mismatch between Object Level Data and new Level Data!")
  }
}

// Removes a level from the given instance based on the index of the level
export function removeLevel(historyId: number, objectId: number, index: number) {
  const currentLevels = WSM.APIGetObjectLevelsReadOnly(historyId, objectId)
  if (index < currentLevels.length) {
    WSM.APIDeleteObject(historyId, currentLevels[index])
  } else {
    throw new Error("Failed to remove level, index out of bounds")
  }
}

// Applies new levels to the given instance
export function addWSMLevelDataToWSMInstance(historyId: number, objectId: number, wsmLevelData: LevelData[]) {
  FormIt.UndoManagement.BeginState()
  removeLevels(historyId, objectId)
  if (wsmLevelData.length > 0) {
    const levelsIds = WSM.APICreateLevelObjects(historyId, wsmLevelData, true)
    WSM.APISetObjectProperties(historyId, objectId, "", true, levelsIds)
  }
  FormIt.UndoManagement.EndState("addWSMLevelDataToWSMInstance")
}

// Function that finds faces at or below elevation with normal (0, 0, -1). This is O(n) time.
// Note returns face Ids found at the same minimum elevation.
function computeFaceIdsWithNegativeZOnFloor(nTempHistId: number, blockId: number, elevation: number) {
  let faceIdsOnFloor: number[] = []
  const allFaceIds = WSM.APIGetObjectsByTypeReadOnly(nTempHistId, blockId, WSM.nObjectType.nFaceType)

  allFaceIds.forEach((faceId) => {
    const facePlane = WSM.APIGetFacePlaneReadOnly(nTempHistId, faceId)
    if (
      Math.abs(facePlane.normal.x) < WSM_MACHINE_TOL &&
      Math.abs(facePlane.normal.y) < WSM_MACHINE_TOL &&
      Math.abs(facePlane.normal.z + 1) < WSM_MACHINE_TOL
    ) {
      const tolForElevation = WSM_MACHINE_TOL * Math.max(1, Math.abs(elevation))
      if (
        Math.abs(facePlane.point.x) < WSM_MACHINE_TOL &&
        Math.abs(facePlane.point.y) < WSM_MACHINE_TOL &&
        facePlane.point.z < elevation + tolForElevation
      ) {
        if (facePlane.point.z < elevation - tolForElevation) {
          // We found a lower elevation floor. Reset the minimum and the floor ids.
          elevation = facePlane.point.z
          faceIdsOnFloor = []
        }

        faceIdsOnFloor.push(faceId)
      }
    }
  })

  return { faceIds: faceIdsOnFloor, elevationUsed: elevation }
}

// Function computes a polygon from a loop. If bReversePolygon is true, the polygon is reversed for
// example in the case the face normal is (0, 0, -1). Note this only works for loops in the xy plane.
function computePolygonFromLoop(nTempHistId: number, loopId: number, bReversePolygon: boolean): Polygon {
  const poly: Polygon = []

  const coedgeIds = WSM.APIGetObjectsByTypeReadOnly(nTempHistId, loopId, WSM.nObjectType.nCoedgeType)
  coedgeIds.forEach((coedgeId) => {
    const isForward = WSM.APIGetCoedgeDirectionReadOnly(nTempHistId, coedgeId)
    const edgeIds = WSM.APIGetObjectsByTypeReadOnly(nTempHistId, coedgeId, WSM.nObjectType.nEdgeType)
    if (edgeIds.length !== 1) {
      console.error("Coedge has 0 edges!!! This should never happen!")
    } else {
      const vertexIds = WSM.APIGetObjectsByTypeReadOnly(nTempHistId, edgeIds[0], WSM.nObjectType.nVertexType)
      if (vertexIds[0] !== vertexIds[1]) {
        const pt = WSM.APIGetVertexPoint3dReadOnly(nTempHistId, vertexIds[isForward === true ? 0 : 1])
        // Note we can only take x and y from the points of the loops because
        // the face normal is (0, 0, -1)
        poly.push([pt.x, pt.y])
      }
    }
  })

  if (bReversePolygon) {
    // For example when the normal is -z, we have to reverse the polygon so the winding
    // is correct.
    poly.reverse()
  }

  return poly
}

// Function computes multi-rings polygon for a face. If bReversePolygons is true, polygons are reversed for
// example in the case the face normal is (0, 0, -1). Note this only works for faces in the xy plane.
export function computeMultiRingPolygonFromFace(
  nTempHistId: number,
  faceId: number,
  bReversePolygons: boolean,
): MultiRingPolygon {
  const multiRingPoly: MultiRingPolygon = []

  // Note the first loop is always the outer loop. The inner loops if any follow.
  const allLoops = WSM.APIGetObjectsByTypeReadOnly(nTempHistId, faceId, WSM.nObjectType.nLoopType)
  allLoops.forEach((loopId) => {
    const polyFromLoop = computePolygonFromLoop(nTempHistId, loopId, bReversePolygons)
    multiRingPoly.push(polyFromLoop)
  })

  return multiRingPoly
}

// Function computes the floor polygons from the floor volume stored in blockId the temp history.
function computeGrossFloorAreaPolygons(
  nTempHistId: number,
  blockId: number,
  elevation: number,
): GrossFloorAreaPolygon[] {
  const grossFloorPolygons: GrossFloorAreaPolygon[] = []
  let faceIdsOnFloorAndElevation = computeFaceIdsWithNegativeZOnFloor(nTempHistId, blockId, elevation)

  faceIdsOnFloorAndElevation.faceIds.forEach((faceId) => {
    const faceArea = WSM.APIComputeAreaReadOnly(nTempHistId, faceId)
    // Note don't make a gfa unit for areas less than 4 square feet.
    if (faceArea > minGFAUnitAreaInFeetSquared) {
      const multiRingPolyForFace = computeMultiRingPolygonFromFace(nTempHistId, faceId, true /*bReversePolygons*/)
      grossFloorPolygons.push({
        grossFloorPolygon: multiRingPolyForFace,
        elevation: faceIdsOnFloorAndElevation.elevationUsed,
        areaType: "UNASSIGNED",
      })
    }
  })

  return grossFloorPolygons
}

// Function to snap vertices to a given height if close to but not at the height. Keep track of snapping
// already done so it only happens once.
function snapVerticesToHeight(
  nHistId: number,
  nBodyId: number,
  dHeight: number,
  allConsideredHeights: Set<number>,
  dHeightTol: number,
) {
  if (allConsideredHeights.has(dHeight)) {
    return
  }
  allConsideredHeights.add(dHeight)

  // Create planes above and below the given height to use in the search. These will
  // bound the vertices to adjust.
  const dTightHeightTol = WSM_MACHINE_TOL * Math.max(1.0, Math.abs(dHeight))
  const planeAbove = WSM.Geom.Plane(WSM.Geom.Point3d(0, 0, dHeight + dHeightTol), WSM.Geom.Vector3d(0, 0, 1))
  const planeBelow = WSM.Geom.Plane(WSM.Geom.Point3d(0, 0, dHeight - dHeightTol), WSM.Geom.Vector3d(0, 0, -1))

  const hits = WSM.APIIntersectsNegativeSideOfPlanesReadOnly(
    nHistId,
    [planeAbove, planeBelow],
    true /*bVertices*/,
    false /*bEdges*/,
    false /*bFaces*/,
    false /*bStrict*/,
    WSM_MACHINE_TOL,
  )
  if (Array.isArray(hits)) {
    // Collect the positions that vertices need to move to.
    const verticesToMove: number[] = []
    const newVertexPositions: Array<WSM.Point3dInterface> = []

    hits.forEach((nHitId) => {
      const nOwnerIds = WSM.APIGetTopLevelOwnersReadOnly(nHistId, nHitId)
      if (nOwnerIds.length === 1 && nOwnerIds[0] === nBodyId) {
        // We found a vertex to check.
        const vertexPos = WSM.APIGetVertexPoint3dReadOnly(nHistId, nHitId)
        const dDist = Math.abs(vertexPos.z - dHeight)
        if (dDist > dTightHeightTol) {
          // We found a vertex to snap.
          //console.log(`vertex ${nHitId} at height ${dHeight} has distance ${dDist}`)
          verticesToMove.push(nHitId)
          vertexPos.z = dHeight
          newVertexPositions.push(vertexPos)
        }
      }
    })

    if (verticesToMove.length > 0) {
      // Found vertices just outside the plane. Move these.
      WSM.APIMoveVertices(nHistId, verticesToMove, newVertexPositions)
    }
  }
}

// Creates group for given floor index within a floors group. Returns the reference history.
function createHistoryForFloorBrep(historyId: number, instanceId: number, floorIndex: number): number {
  const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(historyId, instanceId)
  if (refHistId === WSM.INVALID_ID) {
    console.error("No reference history for instance!")
    return WSM.INVALID_ID
  }

  const strAtts = WSM.APIGetStringAttributesByKeyReadOnly(refHistId, WSM.INVALID_ID, keyForFloorBrepsAttribute)
  if (strAtts.length > 1) {
    console.error("Just one group owns the string attribute!")
    return WSM.INVALID_ID
  }

  let floorCollectionGroupId = WSM.INVALID_ID
  if (strAtts.length === 0) {
    // Make a new group for the floors.
    floorCollectionGroupId = WSM.APICreateGroup(refHistId, [])
    if (floorCollectionGroupId === WSM.INVALID_ID) {
      console.error("Could not create a group!")
      return WSM.INVALID_ID
    }

    // Add a string attribute to the group so it can be found.
    WSM.APICreateStringAttribute(refHistId, keyForFloorBrepsAttribute, "", [floorCollectionGroupId])

    // NOTE do we need the floors to be invisible? Seems like we want this for inferencing in the measure tool.
    const layerName = "Floor breps"
    let floorLayerId = FormIt.Layers.GetLayerID(layerName)
    if (floorLayerId === WSM.INVALID_ID) {
      // Make the layer
      FormIt.Layers.AddLayer(refHistId, layerName, false /*bIsVisible*/)
      floorLayerId = FormIt.Layers.GetLayerID(layerName)
    }

    if (floorLayerId === WSM.INVALID_ID) {
      console.error("Could not create a layer to hide the floor geometry!")
    } else {
      // Hide the floor brep.
      const instanceIds = WSM.APIGetObjectsByTypeReadOnly(
        refHistId,
        floorCollectionGroupId,
        WSM.nObjectType.nInstanceType,
      )
      if (instanceIds.length === 1) {
        FormIt.Layers.AssignLayerToObjects(floorLayerId, [
          WSM.GroupInstancePath([WSM.ObjectHistoryID(refHistId, instanceIds[0])]),
        ])
      }
    }
  } else {
    // Get the Group that owns the attribute. Should be one.
    const ownerIds = WSM.APIGetTopLevelOwnersReadOnly(refHistId, strAtts[0])
    if (ownerIds.length !== 1) {
      console.error("Should be one owning group!")
      return WSM.INVALID_ID
    }

    floorCollectionGroupId = ownerIds[0]
  }

  // Make a group from the specific floor geometry
  const floorCollectionRefHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(refHistId, floorCollectionGroupId)
  const floorGroupId = WSM.APICreateGroup(floorCollectionRefHistoryId, [])
  if (floorGroupId === WSM.INVALID_ID) {
    console.error("Could not create a group!")
    return WSM.INVALID_ID
  }

  // Add a string attribute to identify the floor by index that the brep belongs to.
  const floorIndexStr = floorIndex.toString()
  WSM.APICreateStringAttribute(floorCollectionRefHistoryId, keyForFloorIndexAttribute, floorIndexStr, [floorGroupId])
  return WSM.APIGetGroupReferencedHistoryReadOnly(floorCollectionRefHistoryId, floorGroupId)
}

// This function creates the floors for a given instance in a temporary history returning the geometry
// needed to display the floor in design mode. The floors are created by intersecting blocks between
// two levels with all the bodies in the instance.
export function createFloorsFromInstance(historyId: number, instanceId: number): GrossFloorAreaPolygon[][] {
  const objectType = WSM.APIGetObjectTypeReadOnly(historyId, instanceId)

  const floorGrossPolygons: GrossFloorAreaPolygon[][] = []
  const floorReferenceHistory: number[] = []

  if (objectType !== WSM.nObjectType.nInstanceType) {
    // Only get floors for an instance.
    return floorGrossPolygons
  }

  // Note if we get here there should be no floor collection. But we're seen this
  // happen now more than once. Just to be save, clean up here.
  if (deleteFloorCollection(WSM.GroupInstancePath([WSM.ObjectHistoryID(historyId, instanceId)]))) {
    console.error("Deleted floor collection that should not exist")
  }

  const levelIds = WSM.APIGetObjectLevelsReadOnly(historyId, instanceId)
  if (levelIds.length === 0) {
    // Not a building.
    return floorGrossPolygons
  }

  const levelElevations: number[] = []
  levelIds.forEach((levelId) => {
    const levelData = WSM.APIGetLevelDataReadOnly(historyId, levelId, false /*bGlobalElevation*/)
    levelElevations.push(levelData.dElevation)
  })
  levelElevations.sort((a, b) => {
    return a - b
  })

  // We use the instance box to create floor blocks since all the floors are based on the
  // minimum z value of the instance.
  const instanceBoundingBox = WSM.APIGetBoxReadOnly(historyId, instanceId)
  const boxZLength = instanceBoundingBox.upper.z - instanceBoundingBox.lower.z

  // Convert levelElevations into relative floor elevations. The first floor always starts
  // at 0 height. These elevations are relative to the instance.
  const relativeFloorElevations: number[] = []
  for (let i = 0; i < levelElevations.length; i++) {
    if (i === 0) {
      if (levelElevations[0] > WSM_MACHINE_TOL) {
        relativeFloorElevations.push(0)
      }
    } else {
      const levelTol = WSM_DISTANCE_TOL * Math.max(1.0, levelElevations[i])
      if (Math.abs(levelElevations[i] - relativeFloorElevations[relativeFloorElevations.length - 1]) < levelTol) {
        // Don't make a zero height floor.
        continue
      }
    }

    // Don't add floors above the top of the instance.
    if (levelElevations[i] > boxZLength) {
      break
    }

    relativeFloorElevations.push(levelElevations[i])
  }

  // Add a floor elevation at the top of the building.
  const topLevelElevation = levelElevations[levelElevations.length - 1]
  if (topLevelElevation < boxZLength - WSM_MACHINE_TOL) {
    relativeFloorElevations.push(boxZLength)
  } else {
    relativeFloorElevations[relativeFloorElevations.length - 1] = boxZLength
  }

  // Create a temporary history to hold the building's bodies. Since the history is
  // temporary, we don't have to worry about supressing callbacks. There are none.
  const nTempHistId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)

  // The building comes from an instance in the main history. Copy that instance into the temporary history.
  // This copy is inexpensive since the new instance refers to the original reference history.
  const identityTransf3d = WSM.Geom.Transf3d()
  const newIds = WSM.APICopyOrSketchAndTransformObjects(historyId, nTempHistId, [instanceId], identityTransf3d, 1)

  // Flatten the instance in the temporary history. Note this cost is similar to making copies for a nondestructive
  // boolean which is a small part of the cost of the boolean.
  WSM.APIFlattenGroupsOrInstances(nTempHistId, newIds, true /*bRecursive*/, false /*bImprint*/)

  // Convert all meshes to breps so they can be split below.
  const allMeshes = WSM.APIGetAllObjectsByTypeReadOnly(nTempHistId, WSM.nObjectType.nMeshType)
  if (allMeshes.length > 0) {
    WSM.APIConvertMeshesToObjects(nTempHistId, allMeshes)
  }

  // Next split bodies at nonmaniofld edges and vertices.
  WSM.APISplitAtNonManifoldEdgesAndVertices(nTempHistId)

  // Now we do the boolean on bodies in the temporary history.
  const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(nTempHistId, WSM.nObjectType.nBodyType)

  // Get the inverse of the instance transform. Une this when storing floor volumes.
  const inverseInstanceTransform = WSM.Transf3d.Invert(WSM.APIGetInstanceTransf3dReadOnly(historyId, instanceId))

  try {
    // Start a state to undo the boolean.
    FormIt.UndoManagement.BeginState()

    // Split every manifold body into floors.
    bodyIds.forEach((nBodyId) => {
      let isBodyManifold = WSM.APIIsObjectManifoldReadOnly(nTempHistId, nBodyId)
      if (!isBodyManifold) {
        // Check if all the nonmanifold edges are mergable (i.e. dangling edges). If so
        // merge then to make the body manifold.
        const edgeIds = WSM.APIGetObjectsByTypeReadOnly(nTempHistId, nBodyId, WSM.nObjectType.nEdgeType)
        let bMergable = true
        for (let i = 0; i < edgeIds.length; i++) {
          if (!WSM.APIIsEdgeManifoldReadOnly(nTempHistId, edgeIds[i])) {
            if (!WSM.APIIsEdgeMergeableReadOnly(nTempHistId, edgeIds[i])) {
              bMergable = false
              break
            }
          }
        }

        if (bMergable) {
          WSM.APIMergeBody(nTempHistId, nBodyId, -1)
          isBodyManifold = WSM.APIIsObjectManifoldReadOnly(nTempHistId, nBodyId)
        }
      }

      // Don't do a boolean on bodies that have no volume or are nonmanifold, but keep these bodies for
      // design mode. Note volume can be negative in bad cases - but don't slice that.
      if (!isBodyManifold || WSM.APIComputeVolumeReadOnly(nTempHistId, nBodyId) < WSM_MACHINE_TOL) {
        // We might want to return information about floors not being made here to warn users.
        // Only keep bodies that we can see though. Note, the area is positive.
        if (WSM.APIComputeAreaReadOnly(nTempHistId, nBodyId) > WSM_MACHINE_TOL) {
          if (floorGrossPolygons[0] === undefined) {
            floorGrossPolygons[0] = []
            floorReferenceHistory[0] = createHistoryForFloorBrep(historyId, instanceId, 0)
          }

          WSM.APICopyOrSketchAndTransformObjects(
            nTempHistId,
            floorReferenceHistory[0],
            [nBodyId],
            inverseInstanceTransform,
            1,
          )
        }
        return
      }

      // Get the body bounding box once.
      const bodyBoundingBox = WSM.APIGetBoxReadOnly(nTempHistId, nBodyId)

      // Make the snapping tolerance based on the total building height.
      const snappingTol = WSM_DISTANCE_TOL * Math.max(1.0, bodyBoundingBox.upper.z - bodyBoundingBox.lower.z)

      // Move the body to be centered around the origin to have a more successful boolean.
      const moveToCenterVec3d = WSM.Geom.Vector3d(
        -(bodyBoundingBox.lower.x + bodyBoundingBox.upper.x) / 2,
        -(bodyBoundingBox.lower.y + bodyBoundingBox.upper.y) / 2,
        -bodyBoundingBox.lower.z,
      )
      const moveToCenterTransf3d = WSM.Transf3d.MakeTranslationTransform(moveToCenterVec3d)
      WSM.APITransformObjects(nTempHistId, [nBodyId], moveToCenterTransf3d)

      // Also need the tranform to put the floor volume back in the right place.
      const moveFromCenterVec3d = WSM.Geom.Vector3d(
        (bodyBoundingBox.upper.x + bodyBoundingBox.lower.x) / 2,
        (bodyBoundingBox.upper.y + bodyBoundingBox.lower.y) / 2,
        bodyBoundingBox.lower.z,
      )
      const moveFromCenterTransf3d = WSM.Transf3d.MakeTranslationTransform(moveFromCenterVec3d)

      // Keep track of where snapping has occured.
      const allConsideredheights = new Set<number>()

      for (let floorIndex = 0; floorIndex < relativeFloorElevations.length - 1; floorIndex++) {
        const lowerFloorZ = relativeFloorElevations[floorIndex] + instanceBoundingBox.lower.z
        let upperFloorZ = relativeFloorElevations[floorIndex + 1] + instanceBoundingBox.lower.z

        if (
          lowerFloorZ > bodyBoundingBox.upper.z - WSM_MACHINE_TOL ||
          upperFloorZ < bodyBoundingBox.lower.z + WSM_MACHINE_TOL
        ) {
          // This floor does not intersect the body. Update the elevation
          // to continue the search for intersections.
          continue
        }

        let lowerFloorZAdjustment = 0
        if (lowerFloorZ < bodyBoundingBox.lower.z + WSM_MACHINE_TOL) {
          // Adjust so the block does not overlap on the bottom.
          lowerFloorZAdjustment = -1.0
        }

        if (upperFloorZ > bodyBoundingBox.upper.z - WSM_MACHINE_TOL) {
          // Adjust so the block does not overlap on the top.
          upperFloorZ += 1.0
        }

        // Create a block that is larger than the instance in x and y but matches a floor in z. Intersecting with
        // this block creates the floor geometry. Note adjust the block so it matches the centered body.
        const point1 = WSM.Geom.Point3d(
          moveToCenterVec3d.x + instanceBoundingBox.lower.x - 1,
          moveToCenterVec3d.y + instanceBoundingBox.lower.y - 1,
          moveToCenterVec3d.z + lowerFloorZ + lowerFloorZAdjustment,
        )
        const point2 = WSM.Geom.Point3d(
          moveToCenterVec3d.x + instanceBoundingBox.upper.x + 1,
          moveToCenterVec3d.y + instanceBoundingBox.upper.y + 1,
          moveToCenterVec3d.z + upperFloorZ,
        )

        const blockId = WSM.APICreateBlock(nTempHistId, point1, point2)
        snapVerticesToHeight(nTempHistId, nBodyId, point1.z, allConsideredheights, snappingTol)
        snapVerticesToHeight(nTempHistId, nBodyId, point2.z, allConsideredheights, snappingTol)

        // Get the body box again after snapping and moving. Get the intersection box.
        // If the intersection does not lie in the intersection box, the boolean has
        // gone wrong.
        const bodyBoundingBoxWithAdjustment = WSM.APIGetBoxReadOnly(nTempHistId, nBodyId)
        const blockBoundingBoxBefore = WSM.APIGetBoxReadOnly(nTempHistId, blockId)
        const intersectBoundingBox = WSM.Interval3d.IntersectInterval3d(
          bodyBoundingBoxWithAdjustment,
          blockBoundingBoxBefore,
        )

        // Do the intersection boolean.
        const blockGroupInstancePath = WSM.GroupInstancePath([WSM.ObjectHistoryID(nTempHistId, blockId)])
        WSM.APIIntersectNonDestructive(blockGroupInstancePath, [
          WSM.GroupInstancePath([WSM.ObjectHistoryID(nTempHistId, nBodyId)]),
        ])

        // The boolean could have deleted the floor entirely when there is no
        // intersection. Check that the intersection is valid.
        if (WSM.APIIsObjectLiveReadOnly(nTempHistId, blockId)) {
          const blockBoundingBoxAfter = WSM.APIGetBoxReadOnly(nTempHistId, blockId)
          if (!WSM.Interval3d.IsSubinterval(blockBoundingBoxAfter, intersectBoundingBox)) {
            console.error(
              "Intersection failed with Body %d and block (%f, %f, %f), (%f, %f, %f)",
              nBodyId,
              point1.x,
              point1.y,
              point1.z,
              point2.x,
              point2.y,
              point2.z,
            )
          }

          WSM.APITransformObjects(nTempHistId, [blockId], moveFromCenterTransf3d)

          // Get the geometry from the floor ids. Note because we copied the instance with its transform and then
          // flattened, there is no transform left on the floor geometry from the body with block intersections.
          if (floorGrossPolygons[floorIndex] === undefined) {
            floorGrossPolygons[floorIndex] = []
            floorReferenceHistory[floorIndex] = createHistoryForFloorBrep(historyId, instanceId, floorIndex)
          }
          // Note we use the inverse instance transform here since we're storing the floor volumes in that
          // instance. Also we're assuming the DM element transform and the instance transform are equal, so
          // get the floors from the untransformed floor volumes.
          const floorVolumeIds = WSM.APICopyOrSketchAndTransformObjects(
            nTempHistId,
            floorReferenceHistory[floorIndex],
            [blockId],
            inverseInstanceTransform,
            1,
          )
          // Allow 2 ft variation on the ground floor
          const elevationPointForFloor = WSM.Geom.Point3d(
            0,
            0,
            floorIndex === 0 ? instanceBoundingBox.lower.z + 2 : lowerFloorZ,
          )
          const minZForFloors = WSM.Transf3d.Multiply(inverseInstanceTransform, elevationPointForFloor).z
          floorGrossPolygons[floorIndex].push(
            ...computeGrossFloorAreaPolygons(floorReferenceHistory[floorIndex], floorVolumeIds[0], minZForFloors),
          )
        }
      }
    })
  } catch (e) {
    console.error(e)
  } finally {
    FormIt.UndoManagement.EndState("Booleans for floors on save")
  }

  // Delete the temp history as we're done with it.
  WSM.APIDeleteHistory(nTempHistId)

  // We have code that depends on floors being created in order lowest elevation to
  // highest elevation, for example the hit box code uses the last floor. Doing a
  // quick sanity check here so we don't violate that assumption.
  if (floorGrossPolygons.length > 1) {
    for (let kk = 0; kk < floorGrossPolygons.length - 1; kk++) {
      if (
        floorGrossPolygons[kk] === undefined ||
        floorGrossPolygons[kk + 1] === undefined ||
        floorGrossPolygons[kk].length === 0 ||
        floorGrossPolygons[kk + 1].length === 0 ||
        floorGrossPolygons[kk][0].elevation > floorGrossPolygons[kk + 1][0].elevation - WSM_MACHINE_TOL
      ) {
        console.error("Floor order is bad! How could that happen?")
      }
    }
  }

  return floorGrossPolygons
}

// Returns true if an element is a wsm or axm backed building.
export function isWSMOrAXMBackedBuilding(element: FormaElement): boolean {
  return (
    element?.properties?.category === "building" &&
    (element?.properties?.spacemakerObjectStorageReferenceFormats?.includes("axm") ||
      element?.properties?.spacemakerObjectStorageReferenceFormats?.includes("wsm"))
  )
}

// Returns the parent path of a floor of a wsm or axm backed building.
// Returns undefined when the element is not of the correct type.
export function getPathOfWSMOrAXMBackedBuildingFromFloor(
  path: InternalPath,
  element: FormaElement,
  getUrnFromPath: (path: InternalPath) => Urn | undefined,
  getElement: (urn: Urn) => FormaElement,
): InternalPath | undefined {
  if (element.properties?.category === "floor") {
    const parentPath = getParentPath(path)
    if (parentPath && parentPath !== "root") {
      const parentUrn = getUrnFromPath(parentPath)
      if (parentUrn) {
        const parentElement = getElement(parentUrn)

        //Don't desire to sync the floors of an axm building as levels are part of the axm
        if (isWSMOrAXMBackedBuilding(parentElement)) {
          return parentPath
        }
      }
    }
  }
}

// Deletes the group containing the floor collection if found. Return true if the floor collection
// group was deleted.
export function deleteFloorCollection(groupInstancePath: WSM.GroupInstancePathInterface): boolean {
  let bGroupDeleted = false
  if (groupInstancePath.ids.length === 1) {
    const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
      groupInstancePath.ids[0].History,
      groupInstancePath.ids[0].Object,
    )
    if (refHistId === WSM.INVALID_ID) {
      console.error("No reference history for instance!")
      return bGroupDeleted
    }

    const floorAttIDs = WSM.APIGetStringAttributesByKeyReadOnly(refHistId, WSM.INVALID_ID, keyForFloorBrepsAttribute)
    if (floorAttIDs.length > 1) {
      console.error("This should not be possible!")
    }

    if (floorAttIDs.length > 0) {
      for (let i = 0; i < floorAttIDs.length; i++) {
        // The string attribute should be on a single group. Delete it.
        const ownerIds = WSM.APIGetTopLevelOwnersReadOnly(refHistId, floorAttIDs[i])
        if (ownerIds.length !== 1) {
          console.error("Should be one owning group!")
          if (ownerIds.length === 0) {
            // Delete the attribute.
            WSM.APIDeleteObjects(refHistId, [floorAttIDs[i]])
            continue
          }
        }
        WSM.APIDeleteObjects(refHistId, ownerIds)
        bGroupDeleted = true
      }
    }

    // Prevent undoing before the current State for refHistoryId
    const currentState = FormIt.UndoManagement.GetCurrentState(refHistId)
    FormIt.UndoManagement.SetMinimumHistoryStateID(refHistId, currentState)
  }

  return bGroupDeleted
}

// Undoes the deletion of the floor collection. Note this is just an undo but we could add
// more checking here to make sure we're undoing the right thing.
export function undoFloorCollectionDelete(groupInstancePath: WSM.GroupInstancePathInterface) {
  if (groupInstancePath.ids.length === 1) {
    const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
      groupInstancePath.ids[0].History,
      groupInstancePath.ids[0].Object,
    )
    if (refHistId === WSM.INVALID_ID) {
      console.error("No reference history for instance!")
      return
    }

    WSM.APIUndoHistory(refHistId, true /*bAndDeleteRedo*/)
  }
}

// Returns an array of floor index to reference history id.
export function getIndexToRefHistoryIdArray(groupInstancePath: WSM.GroupInstancePathInterface): number[] {
  const indexToRefHistoryArray: number[] = []

  if (groupInstancePath.ids.length === 1) {
    const refHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
      groupInstancePath.ids[0].History,
      groupInstancePath.ids[0].Object,
    )
    if (refHistId === WSM.INVALID_ID) {
      console.error("No reference history for instance!")
      return indexToRefHistoryArray
    }

    const floorCollectionAttIDs = WSM.APIGetStringAttributesByKeyReadOnly(
      refHistId,
      WSM.INVALID_ID,
      keyForFloorBrepsAttribute,
    )

    if (floorCollectionAttIDs.length === 1) {
      // The string attribute should be on a single group. Delete it.
      const ownerIds = WSM.APIGetTopLevelOwnersReadOnly(refHistId, floorCollectionAttIDs[0])
      if (ownerIds.length !== 1) {
        console.error("Should be one owning group!")
        return indexToRefHistoryArray
      }

      const refFloorCollectionHistId = WSM.APIGetGroupReferencedHistoryReadOnly(refHistId, ownerIds[0])
      if (refFloorCollectionHistId === WSM.INVALID_ID) {
        console.error("No reference history for instance!")
        return indexToRefHistoryArray
      }

      // Each floor index attribute identifies one floor group.
      const floorIndexAttIds = WSM.APIGetStringAttributesByKeyReadOnly(
        refFloorCollectionHistId,
        WSM.INVALID_ID,
        keyForFloorIndexAttribute,
      )

      floorIndexAttIds.forEach((floorIndexAttId) => {
        const stringAttData = WSM.APIGetStringAttributeKeyValueReadOnly(refFloorCollectionHistId, floorIndexAttId)
        if (stringAttData.aOwnerIDs.length !== 1) {
          console.error("Should be one owning group for each floor index!")
          return
        }

        const refFloorIndexHistId = WSM.APIGetGroupReferencedHistoryReadOnly(
          refFloorCollectionHistId,
          stringAttData.aOwnerIDs[0],
        )
        if (refFloorIndexHistId === WSM.INVALID_ID) {
          console.error("No reference history for floor index instance!")
          return
        }

        indexToRefHistoryArray[parseInt(stringAttData.sValue)] = refFloorIndexHistId
      })
    } else if (floorCollectionAttIDs.length > 1) {
      console.error("This should not be possible!")
    }
  }

  return indexToRefHistoryArray
}

// Return meshes from floor geometry.
export function computeFloorVolumeMeshes(groupInstancePath: WSM.GroupInstancePathInterface): WSMGeometryData[] {
  const floorVolumeMeshes: ReducedMeshesAndTransformsData[][] = []
  const floorIndexToReferenceHistoryId = getIndexToRefHistoryIdArray(groupInstancePath)

  const scaleTransform = WSM.Geom.MakeScalingTransform(
    WSM.Point3d.Point3d(0, 0, 0),
    WSM.Vector3d.Vector3d(FEET_TO_METER, FEET_TO_METER, FEET_TO_METER),
  )

  for (let ii = 0; ii < floorIndexToReferenceHistoryId.length; ii++) {
    if (floorVolumeMeshes[ii] === undefined) {
      floorVolumeMeshes[ii] = []
    }
    if (floorIndexToReferenceHistoryId[ii] !== undefined) {
      const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(floorIndexToReferenceHistoryId[ii], WSM.nObjectType.nBodyType)
      bodyIds.forEach((bodyId) => {
        floorVolumeMeshes[ii].push(...WSM.Utils.GetAllGeometryInformation(floorIndexToReferenceHistoryId[ii], bodyId))
      })
    }
  }

  const floorVolumes = floorVolumeMeshes.map((reducedMeshesArray: ReducedMeshesAndTransformsData[]) => {
    return reducedMeshesArrayToWSMGeometryData(reducedMeshesArray, scaleTransform)
  })

  return floorVolumes
}
