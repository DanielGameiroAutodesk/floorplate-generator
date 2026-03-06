import type { Transform, Volume25D } from "@spacemakerai/element-types"
import type { LevelData } from "src/integrations/wsm-tools/wsr/integrated/types"
import { transposeTransform } from "src/integrations/wsm-tools/wsm-integration/wsm-utils"
import { WSM_MACHINE_TOL } from "src/integrations/wsm-tools/wsr/api/types"
import type { FloorData } from "src/integrations/element-state-side-effects-adapter/ElementStateSideEffectInterface"
import { centerObjectsAlongWorldCenter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import { getTranslator } from "src/i18n"

type WSMRing = WSM.Point3dInterface[]
type WSMPolygonWithHoles = WSMRing[]
type WSMFloorData = { height: number; polygonWithHoles: WSMPolygonWithHoles }

// Makes an array of loops of WSM point3ds that represents a face.
// The elevations and transform are taken into account. Note we
// do not make the face yet since we want to be able to match
// previous floors.
function constructWSMPoint3dLoopsFromFloorVolume25D(
  floorVolume25D: { volume: Volume25D; transform?: Transform },
  scale: number,
): WSMFloorData {
  const polygonWithHoles: WSMPolygonWithHoles = []

  // Use the floor transform if available.
  const transf3d = WSM.Geom.Transf3d()
  if (floorVolume25D?.transform !== undefined) {
    transf3d.data = transposeTransform(floorVolume25D?.transform)
  }

  // Return the floor elevation
  let floorElevation: number | undefined

  // Use the floor evelation if available.
  const elevation =
    floorVolume25D.volume.properties.elevation !== undefined ? floorVolume25D.volume.properties.elevation : 0

  floorVolume25D.volume.geometry.coordinates.forEach((loop) => {
    const point3dLoop: WSM.Point3dInterface[] = []
    loop.forEach((pointData) => {
      let newPoint = WSM.Geom.Point3d(scale * pointData[0], scale * pointData[1], scale * elevation)
      newPoint = WSM.Transf3d.Multiply(transf3d, newPoint)
      if (floorElevation === undefined) {
        floorElevation = newPoint.z
      } else {
        if (Math.abs(floorElevation - newPoint.z) > WSM_MACHINE_TOL * Math.max(1.0, floorElevation)) {
          // The floor is not flat!!!
          console.error("The floor is not flat - expect elevation: ", elevation, " but got: ", newPoint.z)
        }
        // Make this completely flat.
        newPoint.z = floorElevation
      }
      point3dLoop.push(newPoint)
    })

    if (point3dLoop.length > 2) {
      polygonWithHoles.push(point3dLoop)
    }
  })

  return { height: floorVolume25D.volume.properties.height * scale, polygonWithHoles }
}

// Converts the volume25Ds into wsm point3d loops and sorts them by elevation. Note we need to do the
// conversion and take the transforms on the floors into account so we can match floors to extrude.
function convertVolume25DArrayToSortedWSMFloorData(
  floorVolume25DArray: { volume: Volume25D; transform?: Transform }[],
  scale: number,
): WSMFloorData[] {
  const wsmFloorDataArray: WSMFloorData[] = []

  floorVolume25DArray.forEach((floorVolume25D) => {
    const heightAndPoint3ds = constructWSMPoint3dLoopsFromFloorVolume25D(floorVolume25D, scale)
    if (heightAndPoint3ds.polygonWithHoles.length > 0) {
      wsmFloorDataArray.push(heightAndPoint3ds)
    }
  })

  // Note we can sort because we checked that the elevations are not undefined before adding to the array.
  wsmFloorDataArray.sort((a, b) => {
    const elavationA = a.polygonWithHoles[0][0].z
    const elevationB = b.polygonWithHoles[0][0].z
    return elavationA - elevationB
  })

  return wsmFloorDataArray
}

//The first loop is always an outer loop, and any additional loops are interior loops which would create courtyards
//so delete any faces created by interior loops.
function constructFacesFromWSMPolygonWithHoles(tempHistoryId: number, polygonWithHoles: WSMPolygonWithHoles) {
  polygonWithHoles.forEach((loop, index) => {
    const isInteriorLoop = index > 0
    let previousDelta: number = -1
    let previousPoint: WSM.Point3dInterface

    if (isInteriorLoop) {
      previousDelta = WSM.APIGetIdOfActiveDeltaReadOnly(tempHistoryId)
    }

    loop.forEach((currentPoint) => {
      if (previousPoint) {
        WSM.APIConnectPoint3ds(tempHistoryId, previousPoint, currentPoint)
      }

      previousPoint = currentPoint
    })

    if (isInteriorLoop) {
      const newDelta = WSM.APIGetIdOfActiveDeltaReadOnly(tempHistoryId)
      if (newDelta !== previousDelta) {
        const data = WSM.APIGetCreatedChangedAndDeletedInDeltaRangeReadOnly(tempHistoryId, previousDelta, newDelta, [
          WSM.nFaceType,
        ])

        if (data.created.length > 0) {
          WSM.APIDeleteObjects(tempHistoryId, data.created)
        }
      }
    }
  })
}

// Helper function to drag faces in a given history.
function dragFloorPolygonInTempHistory(temphistoryId: number, dragHeight: number) {
  const faceIds = WSM.APIGetAllObjectsByTypeReadOnly(temphistoryId, WSM.nFaceType)
  const faceDragHeightArray = Array(faceIds.length).fill(dragHeight)

  WSM.APIDragFaces(temphistoryId, faceIds, faceDragHeightArray, [], true /*bMerge*/)
}

// Helper function that returns true if 2 WSMPolygonWithHoles match in x and y.
function polygonsMatchInXAndY(poly1: WSMPolygonWithHoles, poly2: WSMPolygonWithHoles) {
  if (poly1.length !== poly2.length) {
    return false
  }

  for (let i = 0; i < poly1.length; i++) {
    if (poly1[i].length !== poly2[i].length) {
      return false
    }

    for (let j = 0; j < poly1[i].length; j++) {
      if (Math.abs(poly1[i][j].x - poly2[i][j].x) > WSM_MACHINE_TOL * Math.max(1.0, Math.abs(poly1[i][j].x))) {
        return false
      }
      if (Math.abs(poly1[i][j].y - poly2[i][j].y) > WSM_MACHINE_TOL * Math.max(1.0, Math.abs(poly1[i][j].y))) {
        return false
      }
    }
  }

  return true
}

// Construct bodies from the volume 25d array extruding as much as possible
// so there are fewer bodies to unite. In the typical case, only one body will
// be constructed.
function constructBodiesFromFloorDataArray(floorDataArray: FloorData[], scale: number) {
  const allCreatedHistoryIds: Array<number> = []
  const levelData: Array<LevelData> = []

  // Open floor polygon that can be matched. Note the corresponding lowest face to drag is
  // created in temporary history tempHistoryId
  type UnextrudedFloor = {
    faceDragHeight: number
    tempHistoryId: number
    polygonWithHoles: WSMPolygonWithHoles
  }

  // Keep track of floors that have not been extruded to use in matching.
  let previousUnextrudedFloors: Array<UnextrudedFloor> = []
  let currentUnextrudedFloors: Array<UnextrudedFloor> = []

  // Convert the floor data array into a sorted array of WSMFloorData
  const wsmFloorDataArray = convertVolume25DArrayToSortedWSMFloorData(floorDataArray, scale)

  if (wsmFloorDataArray.length === 0) {
    return { allCreatedHistoryIds, levelData }
  }

  // As a flag pick an elevation below the lowest floor elevation.
  let previousElevation: number = wsmFloorDataArray[0].polygonWithHoles[0][0].z - 1

  const t = getTranslator()

  wsmFloorDataArray.forEach((floorData) => {
    const currentElevation = floorData.polygonWithHoles[0][0].z
    if (currentElevation > previousElevation + WSM_MACHINE_TOL) {
      // Reset for floors at a new elevation. First drag polygons that did not match.
      previousUnextrudedFloors.forEach((unextrudedFloor: UnextrudedFloor) => {
        dragFloorPolygonInTempHistory(unextrudedFloor.tempHistoryId, unextrudedFloor.faceDragHeight)
      })

      // Update the current and previous floors for search.
      previousElevation = currentElevation
      previousUnextrudedFloors = currentUnextrudedFloors
      currentUnextrudedFloors = []

      if (levelData.length === 0 || currentElevation > levelData[levelData.length - 1].second) {
        levelData.push({
          first: t(($) => $.wsm.floors.floorWithNumberLabel, { level: levelData.length + 1 }),
          second: currentElevation,
        })
      }
    }

    //If floor coordinates are the same as floor below it, then no need to draw a new floor polygon
    //We will just drag the floor polygon from the floor below (but keep track of how far we need to drag).
    let bFoundMatch = false
    for (let i = 0; !bFoundMatch && i < previousUnextrudedFloors.length; i++) {
      if (polygonsMatchInXAndY(previousUnextrudedFloors[i].polygonWithHoles, floorData.polygonWithHoles)) {
        // This floor matches a previous floor. Move the floor to the current unextruded
        // floors array and update the face drag height.
        previousUnextrudedFloors[i].faceDragHeight = previousUnextrudedFloors[i].faceDragHeight + floorData.height
        currentUnextrudedFloors.push(previousUnextrudedFloors[i])
        previousUnextrudedFloors.splice(i, 1)
        bFoundMatch = true
        break
      }
    }

    if (!bFoundMatch) {
      //Start on the next set of distinct floor geometry
      //Safest (and just easier) to just construct new geometry in a new temp history.
      const tempHistId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
      allCreatedHistoryIds.push(tempHistId)

      constructFacesFromWSMPolygonWithHoles(tempHistId, floorData.polygonWithHoles)

      currentUnextrudedFloors.push({
        faceDragHeight: floorData.height,
        tempHistoryId: tempHistId,
        polygonWithHoles: floorData.polygonWithHoles,
      })
    }
  })

  //Now that we've looped over every floor - drag the unextruded floor geometry
  previousUnextrudedFloors.forEach((unextrudedFloor: UnextrudedFloor) => {
    dragFloorPolygonInTempHistory(unextrudedFloor.tempHistoryId, unextrudedFloor.faceDragHeight)
  })
  currentUnextrudedFloors.forEach((unextrudedFloor: UnextrudedFloor) => {
    dragFloorPolygonInTempHistory(unextrudedFloor.tempHistoryId, unextrudedFloor.faceDragHeight)
  })

  return {
    allCreatedHistoryIds,
    levelData,
  }
}

// Extrudes floor polygons as much as possible then unites to get the
// final volume. Also adds levels to the created shell.
export function createBrepFromFloorDataArray(
  historyId: number,
  floorDataArray: FloorData[],
  scale: number,
  groupInstancePath: WSM.GroupInstancePathInterface,
): WSM.Transf3dInterface | undefined {
  if (floorDataArray.length === 0 || groupInstancePath.ids.length === 0) {
    return
  }

  const { allCreatedHistoryIds, levelData } = constructBodiesFromFloorDataArray(floorDataArray, scale)

  // Aggregrate and union all the created bodies in the temporary histories.
  allCreatedHistoryIds.forEach((tempHistoryId) => {
    const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(tempHistoryId, WSM.nBodyType)
    WSM.APICopyOrSketchAndTransformObjects(tempHistoryId, historyId, bodyIds, WSM.Geom.Transf3d(), 1)
    WSM.APIDeleteHistory(tempHistoryId)
  })

  const bodyIdsToUnite = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nBodyType)

  const inverseTransform = centerObjectsAlongWorldCenter(historyId, bodyIdsToUnite)

  //If we have more than 1 body, need to unite them.
  const bodyId1 = bodyIdsToUnite.shift()
  const bodyId2 = bodyIdsToUnite.shift()
  if (bodyId1 !== undefined && bodyId2 !== undefined) {
    WSM.APIUnite(historyId, bodyId1, bodyId2, bodyIdsToUnite)
  }

  // We need the owning instance for levels.
  if (levelData.length > 0) {
    const levelsIDs = WSM.APICreateLevelObjects(groupInstancePath.ids[0].History, levelData, true)
    WSM.APISetObjectProperties(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object, "", true, levelsIDs)
  }

  return inverseTransform
}
