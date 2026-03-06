import type { MultiRingPolygon } from "src/integrations/wsm-tools/wsr/api/types"
import { WSM_DISTANCE_TOL, WSM_MACHINE_TOL } from "src/integrations/wsm-tools/wsr/api/types"
import { randomId } from "src/integrations/building-systems-basic-building/lib/utils"
import type { Edges, Graph, Vertices } from "src/integrations/building-systems-basic-building/lib/graph/graph"
import type { Space, Spaces, Unit } from "src/integrations/building-systems-basic-building/lib/types"
import type { InternalPath } from "src/lib/element/path"
import type { GFAUnit } from "src/lib/element/types"
import { isDefined } from "src/lib/array"
import { FEET_TO_METER, METER_TO_FEET } from "@spacemakerai/forma-units"
import type { BuildingPieceMesh } from "src/lib/visualizationSettings"
import { reducedMeshesArrayToWSMGeometryData } from "src/integrations/wsm-tools/wsr/api/mapping"
import { getRepresentationJsonUnsafe } from "@spacemakerai/elements-client"
import type { ElementSnapshot } from "src/core/elements/ElementSnapshot"
import { utils } from "@spacemakerai/web-sketch-renderer"
import type { EmptyFloor3d } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"
import type { Matrix4 } from "three"
import { transposeTransform } from "src/integrations/wsm-tools/wsm-integration/wsm-utils"

const { isSearchInGroupsResult } = utils

// String key for attributes to find exterior edges.
export const keyForExteriorEdgeAttribute: string = "I3dS: Exterior Edge"

// String key for attributes to find previously existing faces.
export const keyForExistingFaceAttribute: string = "I3dS: Existing Face"

// Make floor plan from the outline only. This will be one big space per floor.
function getGraphSpacesUpdateUnitsNoInterior(
  floorOutline: MultiRingPolygon[],
  floorId: string,
  units: Unit[],
  functionId?: string,
  areaType?: "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING",
) {
  const spaces: Spaces = {}
  const edges: Edges = {}
  const vertices: Vertices = {}

  floorOutline.forEach((mrp) => {
    // Make vertices and polygons with vertex ids from the multiring polgon.
    const polygons: string[][] = mrp.map((polygon) =>
      polygon.map((point) => {
        const id = randomId()
        vertices[id] = { x: point[0], y: point[1], id }
        return id
      }),
    )

    // The space is defined now.
    const space: Space = {
      id: randomId(),
      polygon: polygons[0],
      holes: polygons.slice(1),
      program: areaType,
    }

    spaces[space.id] = space

    // Create edges for all the polygons.
    polygons.forEach((polygon) => {
      const n = polygon.length
      for (let i = 0; i < n; i++) {
        const edgeId = randomId()
        edges[edgeId] = { start: polygon[i], end: polygon[(i + 1) % n], id: edgeId }
      }
    })

    const unit: Unit = {
      id: randomId(),
      spaces: [{ spaceId: space.id, floorId: floorId }],
      functionId: functionId === undefined ? "unspecified" : functionId,
      program: areaType,
    }
    units.push(unit)
  })

  const graph: Graph = { vertices, edges }

  return { spaces, graph }
}

// Function to return the area type from a object.
function getAreaType(historyId: number, objId: number): "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING" | undefined {
  let areaType: "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING" | undefined = undefined
  const areaTypeAtts = WSM.APIGetStringAttributesByKeyReadOnly(historyId, objId, "areaType")
  if (areaTypeAtts.length > 0) {
    // There should only be one - use it.
    const areaTypeString = WSM.APIGetStringAttributeKeyValueReadOnly(historyId, areaTypeAtts[0]).sValue
    if (
      areaTypeString === "CORE" ||
      areaTypeString === "CORRIDOR" ||
      areaTypeString === "LIVING_UNIT" ||
      areaTypeString === "PARKING"
    ) {
      areaType = areaTypeString
    }
  }

  return areaType
}

// Function to return the function id from an object
function getFunctionId(historyId: number, objId: number): string | undefined {
  let functionId: string | undefined = undefined
  const functionIdAtts = WSM.APIGetStringAttributesByKeyReadOnly(historyId, objId, "functionId")
  if (functionIdAtts.length > 0) {
    // There should only be one - use it.
    functionId = WSM.APIGetStringAttributeKeyValueReadOnly(historyId, functionIdAtts[0]).sValue
  }

  return functionId
}

// Function creates floor plan from all the geometry in the given history.
function getGraphSpacesUpdateUnitsFromWSMFaces(historyId: number, floorId: string, units: Unit[]) {
  const spaces: Spaces = {}
  const edges: Edges = {}
  const vertices: Vertices = {}

  const wsmVertexIdToString = new Map<number, string>()

  // Create the vertices
  const vertexIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nVertexType)
  vertexIds.forEach((vertexId) => {
    const pt = WSM.APIGetVertexPoint3dReadOnly(historyId, vertexId)
    const id = randomId()
    vertices[id] = { x: pt.x, y: pt.y, id }
    wsmVertexIdToString.set(vertexId, id)
  })

  // Create the edges.
  const edgeIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nEdgeType)
  edgeIds.forEach((edgeId) => {
    const vertexIdsOnEdge = WSM.APIGetObjectsByTypeReadOnly(
      historyId,
      edgeId,
      WSM.nObjectType.nVertexType,
      false /*bUpstream*/,
    )
    if (vertexIdsOnEdge.length === 2) {
      const vert1Id = wsmVertexIdToString.get(vertexIdsOnEdge[0])
      const vert2Id = wsmVertexIdToString.get(vertexIdsOnEdge[1])
      if (vert1Id && vert2Id) {
        const id = randomId()
        edges[id] = { start: vert1Id, end: vert2Id, id }
      }
    }
  })

  // The graph is created.
  const graph: Graph = { vertices, edges }

  // Next make the polygons from the existing faces.
  const faceIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nFaceType)
  faceIds.forEach((faceId) => {
    // Get area type and functionId from the face which was previously saved in string attributes.
    const areaType = getAreaType(historyId, faceId)
    const functionId = getFunctionId(historyId, faceId)

    const loopIds = WSM.APIGetObjectsByTypeReadOnly(historyId, faceId, WSM.nObjectType.nLoopType)
    const polygons: string[][] = loopIds.map((loopId) => {
      // Use the start of each coedge to make the polygon. Take the coedge direction into account.
      const coedgeIdsOnLoop = WSM.APIGetObjectsByTypeReadOnly(historyId, loopId, WSM.nObjectType.nCoedgeType)
      return coedgeIdsOnLoop
        .map((coedgeId) => {
          const bIsForward = WSM.APIGetCoedgeDirectionReadOnly(historyId, coedgeId)
          const vertexIdsOnCoedge = WSM.APIGetObjectsByTypeReadOnly(historyId, coedgeId, WSM.nObjectType.nVertexType)
          if (vertexIdsOnCoedge.length === 2) {
            const vertexIdAtStart = bIsForward ? vertexIdsOnCoedge[0] : vertexIdsOnCoedge[1]
            return wsmVertexIdToString.get(vertexIdAtStart)
          }
        })
        .filter(isDefined)
    })

    // The space is defined now.
    const space: Space = {
      id: randomId(),
      polygon: polygons[0],
      holes: polygons.slice(1),
      program: areaType,
    }

    spaces[space.id] = space

    const unit: Unit = {
      id: randomId(),
      spaces: [{ spaceId: space.id, floorId: floorId }],
      functionId: functionId !== undefined ? functionId : "unspecified",
      program: areaType,
    }
    units.push(unit)
  })

  return { spaces, graph }
}

// Creates a wsm face from a gross floor area. If bSplitOnly is true,
// the edges are sketched but no faces are processed.
function createWSMFaceFromMultiRingPolygon(
  historyId: number,
  grossFloorArea: MultiRingPolygon,
  transf3d: WSM.Transf3dInterface,
  bSplitOnly: boolean,
): number {
  let faceId = WSM.INVALID_ID

  grossFloorArea.forEach((loop, index) => {
    if (loop.length > 2) {
      const pointsOnExteriorLoop: WSM.Point3dInterface[] = []
      const isInteriorLoop = index > 0
      let previousDelta = bSplitOnly === false ? WSM.APIGetIdOfActiveDeltaReadOnly(historyId) : WSM.INVALID_ID
      let previousPoint: WSM.Point3dInterface | undefined

      loop.forEach((xAndYArray) => {
        const currentPoint = WSM.Transf3d.Multiply(transf3d, WSM.Point3d.Point3d(xAndYArray[0], xAndYArray[1], 0))

        // Note - we need to project onto the xy plane for the slicing to work.
        currentPoint.z = 0

        if (!isInteriorLoop && !bSplitOnly) {
          pointsOnExteriorLoop.push(currentPoint)
        }

        if (previousPoint) {
          WSM.APIConnectPoint3ds(historyId, previousPoint, currentPoint)
        }

        previousPoint = currentPoint
      })

      // Close the loop
      if (previousPoint) {
        const currentPoint = WSM.Transf3d.Multiply(transf3d, WSM.Point3d.Point3d(loop[0][0], loop[0][1], 0))
        currentPoint.z = 0

        if (!isInteriorLoop && !bSplitOnly) {
          pointsOnExteriorLoop.push(currentPoint)
        }

        WSM.APIConnectPoint3ds(historyId, previousPoint, currentPoint)
      }

      if (bSplitOnly === false) {
        const newDelta = WSM.APIGetIdOfActiveDeltaReadOnly(historyId)
        if (newDelta !== previousDelta) {
          const data = WSM.APIGetCreatedChangedAndDeletedInDeltaRangeReadOnly(historyId, previousDelta, newDelta, [
            WSM.nFaceType,
          ])

          if (data.created.length > 0) {
            if (isInteriorLoop) {
              WSM.APIDeleteObjects(historyId, data.created)
            } else {
              if (data.created.length > 1) {
                // Delete any face that does not contain all the loop points.
                // Note edges could split, so we can't rely on the number of
                // vertices. We could be more efficient here maybe by checking
                // the face bounding box first and the minimum number of
                // vertices, but this case is probably unlikely and fast enough
                // that optimizing here is not worth it. Note there is one face
                // to keep so if not found before, it must be the last one.
                let faceIndexToKeep = -1
                for (let index = 0; index < data.created.length - 1; index++) {
                  let foundFaceToKeep = true
                  for (let index1 = 0; index1 < pointsOnExteriorLoop.length; index1++) {
                    if (
                      WSM.APIFaceContainsPointReadOnly(historyId, data.created[index], pointsOnExteriorLoop[index1]) ===
                      false
                    ) {
                      foundFaceToKeep = false
                      break
                    }
                  }

                  if (foundFaceToKeep === true) {
                    faceIndexToKeep = index
                    break
                  }
                }

                if (faceIndexToKeep === -1) {
                  const faceIdOrUndefined = data.created.pop()
                  if (faceIdOrUndefined) {
                    faceId = faceIdOrUndefined
                  }
                } else {
                  faceId = data.created.splice(faceIndexToKeep, 1)[0]
                }
                WSM.APIDeleteObjects(historyId, data.created)
              } else {
                faceId = data.created[0]
              }
            }
          }
        }
      }
    }
  })

  return faceId
}

// Function converts gfa units into wsm faces in the given history. Unit information
// is carried on string attributes attached to the faces. Note we expect the gfa units
// to match the wsm geometry underneath the top instance so no transform is required.
function createWSMFacesFromGFAUnits(historyId: number, gfaUnits: GFAUnit[], gfaMatrix?: Matrix4): void {
  const transf3d = transposeTransform(gfaMatrix ? gfaMatrix.toArray() : undefined)

  // Make wsm faces labeled with string attributes for each area inside each unit.
  gfaUnits.forEach((gfaUnit) => {
    gfaUnit.areas.forEach((grossFloorArea) => {
      const faceId = createWSMFaceFromMultiRingPolygon(
        historyId,
        grossFloorArea.coordinates as MultiRingPolygon,
        transf3d,
        false /*bSplitOnly*/,
      )

      if (faceId != WSM.INVALID_ID) {
        if (gfaUnit.areaType) {
          // Create the area string.
          WSM.APICreateStringAttribute(historyId, "areaType", gfaUnit.areaType, [faceId])
        }
        if (gfaUnit.functionId) {
          // Create the area string.
          WSM.APICreateStringAttribute(historyId, "functionId", gfaUnit.functionId, [faceId])
        }
      }
    })
  })
}

// Split the gfa faces in history gfaHistoryId at the outline and throw out pieces outside.
function splitAndTrimGFAFacesWithOutline(
  gfaHistoryId: number,
  floorOutline: MultiRingPolygon[],
  snapGFAUnits: boolean,
) {
  // Split the gfa faces with the outline. And make new faces to test against for the outline.
  const tempHistoryId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
  const transf3d = WSM.Geom.Transf3d()

  // Create the outline in the temp history.
  floorOutline.forEach((multiRingPolygon) => {
    createWSMFaceFromMultiRingPolygon(tempHistoryId, multiRingPolygon, transf3d, false /*bSplitOnly*/)
  })

  if (snapGFAUnits) {
    // Snap gfa units to the outline.
    snapGFAUnitFacesToOutline(gfaHistoryId, tempHistoryId)
  }

  // Now split the gfa faces with the outline.
  floorOutline.forEach((multiRingPolygon) => {
    createWSMFaceFromMultiRingPolygon(gfaHistoryId, multiRingPolygon, transf3d, true /*bSplitOnly*/)
  })

  // Now check each face in gfaHistoryId to see whether or not it should be deleted. Do this with ray fire
  // on the faces in tempHistoryId.
  const faceIdsToDelete: number[] = []
  const faceIds = WSM.APIGetAllObjectsByTypeReadOnly(gfaHistoryId, WSM.nObjectType.nFaceType)
  faceIds.forEach((faceId) => {
    // Find an interior point on the face.
    const triangles = WSM.APIGetFaceFacetsReadOnly(gfaHistoryId, faceId)
    if (triangles.length >= 3) {
      const pt0 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, triangles[0])
      const pt1 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, triangles[1])
      const pt2 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, triangles[2])

      // Make pt0 a point in the interior of the face but below it.
      pt0.x = (pt0.x + pt1.x + pt2.x) / 3
      pt0.y = (pt0.y + pt1.y + pt2.y) / 3
      pt0.z = -1
      const line3dPickRay = WSM.Geom.Line3d(pt0, WSM.Vector3d.ZDirection())
      const hits = WSM.APIRayFireReadOnly(tempHistoryId, line3dPickRay, 1.0e-6, false, false, true)
      if (hits.length === 0) {
        faceIdsToDelete.push(faceId)
      }
    } else {
      faceIdsToDelete.push(faceId)
    }
  })

  // We are done with the history for the outline.
  WSM.APIDeleteHistory(tempHistoryId)

  if (faceIdsToDelete.length > 0) {
    // Get rid of faces not inside the outline.
    WSM.APIDeleteObjects(gfaHistoryId, faceIdsToDelete)

    // Get rid of nonowned edges so that do not go into the graph
    let nonOwnedEdgeIds = WSM.APIGetAllNonOwnedReadOnly(gfaHistoryId).filter((nonOwnedId) => {
      return WSM.APIGetObjectTypeReadOnly(gfaHistoryId, nonOwnedId) === WSM.nObjectType.nEdgeType
    })
    if (nonOwnedEdgeIds.length > 0) {
      WSM.APIDeleteObjects(gfaHistoryId, nonOwnedEdgeIds)
    }
  }
}

// Imprints the rectangle base of the box around the faces in the given history.
// Note the faces are in meters and the box is in feet so adjustments are made
// for that.
function imprintEnlargedBoxAroundFaces(facesInMetersHistoryId: number, boxInFeet: WSM.Interval3dInterface) {
  const pt0 = WSM.Point3d.Point3d(boxInFeet.lower.x * FEET_TO_METER - 0.1, boxInFeet.lower.y * FEET_TO_METER - 0.1, 0)
  const pt1 = WSM.Point3d.Point3d(boxInFeet.upper.x * FEET_TO_METER + 0.1, boxInFeet.lower.y * FEET_TO_METER - 0.1, 0)
  const pt2 = WSM.Point3d.Point3d(boxInFeet.upper.x * FEET_TO_METER + 0.1, boxInFeet.upper.y * FEET_TO_METER + 0.1, 0)
  WSM.APICreateRectangle(facesInMetersHistoryId, pt0, pt1, pt2)
}

// Function to intersect extruded faces from gfa units with floor volumes so the volumes
// match the gfa unit areas.
function intersectFloorVolumesWithExtrudedGFAFaces(
  gfaHistoryId: number,
  floorIndex: number,
  floorVolumeHistId: number,
): BuildingPieceMesh[] {
  const bmps: BuildingPieceMesh[] = []
  const floorVolumeBox = WSM.APIGetBoxReadOnly(floorVolumeHistId)

  const scaleTransform = WSM.Geom.MakeScalingTransform(
    WSM.Point3d.Point3d(0, 0, 0),
    WSM.Vector3d.Vector3d(FEET_TO_METER, FEET_TO_METER, FEET_TO_METER),
  )

  const floorVolumeTransf3d = WSM.Geom.Transf3d()

  const tempFloorSliceHistId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
  const allBodyIds = WSM.APIGetAllObjectsByTypeReadOnly(floorVolumeHistId, WSM.nObjectType.nBodyType)

  // Copy bodies to the new temporary history to be sliced. Note transform to match the synced data.
  let allTempBodyIds = WSM.APICopyOrSketchAndTransformObjects(
    floorVolumeHistId,
    tempFloorSliceHistId,
    allBodyIds,
    floorVolumeTransf3d,
    1,
  )

  // Separate the bodies into single lump bodies so the bounding boxes are tigher.
  let allNewTempBodyIds: number[] = []
  allTempBodyIds.forEach((bodyId) => {
    const newTempBodyIds = WSM.APISeparate(tempFloorSliceHistId, bodyId)
    allNewTempBodyIds = allNewTempBodyIds.concat(newTempBodyIds)
  })

  allTempBodyIds = allTempBodyIds.concat(allNewTempBodyIds)

  // Copy all the gfa faces to a new history. We extend the faces in this history.
  const enlargedGfaHistoryId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
  const faceIds = WSM.APIGetAllObjectsByTypeReadOnly(gfaHistoryId, WSM.nObjectType.nFaceType)
  WSM.APICopyOrSketchAndTransformObjects(gfaHistoryId, enlargedGfaHistoryId, faceIds, floorVolumeTransf3d, 1)
  labelExteriorEdgesAndExistingFaces(enlargedGfaHistoryId, "Outline", true)

  // Note the faces in enlargedGfaHistoryId are in meters while the floorVolumeBox is in feet. The function
  // adjusts for this.
  allTempBodyIds.forEach((bodyId) => {
    const bodyBox = WSM.APIGetBoxReadOnly(tempFloorSliceHistId, bodyId)
    imprintEnlargedBoxAroundFaces(enlargedGfaHistoryId, bodyBox)
  })

  extendAndMergeInteriorEdges(enlargedGfaHistoryId)

  const unusedBodiesIdSet = new Set(allTempBodyIds)

  faceIds.forEach((faceId) => {
    // Id of the body we will intersect with. Only set if found.
    let bodyToIntersectId = WSM.INVALID_ID
    let extendedFaceToUseId = WSM.INVALID_ID
    let areaGFAFace = 0

    // Find an interior point on the face.
    const triangles = WSM.APIGetFaceFacetsReadOnly(gfaHistoryId, faceId)
    if (triangles.length >= 3) {
      const pt0 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, triangles[0])
      const pt1 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, triangles[1])
      const pt2 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, triangles[2])

      // Make pt0 a point in the interior of the face but below it.
      pt0.x = (METER_TO_FEET * (pt0.x + pt1.x + pt2.x)) / 3
      pt0.y = (METER_TO_FEET * (pt0.y + pt1.y + pt2.y)) / 3
      pt0.z = floorVolumeBox.lower.z - 1
      const line3dPickRay = WSM.Geom.Line3d(pt0, WSM.Vector3d.ZDirection())
      const hits = WSM.APIRayFireReadOnly(tempFloorSliceHistId, line3dPickRay, 1.0e-6, false, false, true)
      if (hits.length > 0) {
        for (let ii = 0; ii < hits.length; ii++) {
          const hitPlane = WSM.APIGetFacePlaneReadOnly(tempFloorSliceHistId, hits[ii])
          if (
            Math.abs(hitPlane.normal.x) < WSM_MACHINE_TOL &&
            Math.abs(hitPlane.normal.y) < WSM_MACHINE_TOL &&
            Math.abs(hitPlane.normal.z + 1) < WSM_MACHINE_TOL
          ) {
            // We only intersect if lowest face on the volume is bigger than the gfa area.
            // This means it needs to be split.
            const faceHitBox = WSM.APIGetBoxReadOnly(tempFloorSliceHistId, hits[ii])

            // Note we allow a 2 ft difference on the 0th floor.
            if (Math.abs(faceHitBox.lower.z - floorVolumeBox.lower.z) < (floorIndex === 0 ? 2.0 : 1e-6)) {
              areaGFAFace = WSM.APIComputeAreaReadOnly(gfaHistoryId, faceId)
              const areaVolumeFace = WSM.APIComputeAreaReadOnly(tempFloorSliceHistId, hits[ii])
              // Note we use a tolerance of .001 here since splitting for
              // less than this amount won't be noticable.
              if (areaVolumeFace > 0.999 * areaGFAFace * METER_TO_FEET * METER_TO_FEET) {
                const topLevelOwnerIds = WSM.APIGetTopLevelOwnersReadOnly(tempFloorSliceHistId, hits[ii])
                if (
                  topLevelOwnerIds.length === 1 &&
                  WSM.APIGetObjectTypeReadOnly(tempFloorSliceHistId, topLevelOwnerIds[0]) === WSM.nObjectType.nBodyType
                ) {
                  // Pick the corresponding enlarged faces based on the original
                  line3dPickRay.point.x *= FEET_TO_METER
                  line3dPickRay.point.y *= FEET_TO_METER
                  line3dPickRay.point.z = -1
                  const enlargedHits = WSM.APIRayFireReadOnly(
                    enlargedGfaHistoryId,
                    line3dPickRay,
                    1.0e-6,
                    false,
                    false,
                    true,
                  )
                  if (enlargedHits.length === 1) {
                    bodyToIntersectId = topLevelOwnerIds[0]
                    extendedFaceToUseId = enlargedHits[0]
                    unusedBodiesIdSet.delete(bodyToIntersectId)
                  }
                }
              }
              break
            }
          }
        }
      }
    }

    if (bodyToIntersectId !== WSM.INVALID_ID) {
      // Extrude the gfa face into a solid and intersect with the body.
      const transf3d = WSM.Geom.Transf3d()
      transf3d.data[0] = METER_TO_FEET
      transf3d.data[5] = METER_TO_FEET
      transf3d.data[10] = METER_TO_FEET
      transf3d.data[11] = floorVolumeBox.lower.z - 1

      const newFaceIdArray = WSM.APICopyOrSketchAndTransformObjects(
        enlargedGfaHistoryId,
        tempFloorSliceHistId,
        [extendedFaceToUseId],
        transf3d,
        1,
      )

      const areaType = getAreaType(tempFloorSliceHistId, newFaceIdArray[0])
      const functionId = getFunctionId(tempFloorSliceHistId, newFaceIdArray[0])

      const previousDelta = WSM.APIGetIdOfActiveDeltaReadOnly(tempFloorSliceHistId)
      WSM.APIDragFace(tempFloorSliceHistId, newFaceIdArray[0], floorVolumeBox.upper.z - floorVolumeBox.lower.z + 2)
      const newDelta = WSM.APIGetIdOfActiveDeltaReadOnly(tempFloorSliceHistId)

      if (newDelta !== previousDelta) {
        const data = WSM.APIGetCreatedChangedAndDeletedInDeltaRangeReadOnly(
          tempFloorSliceHistId,
          previousDelta,
          newDelta,
          [WSM.nBodyType],
        )

        if (data.created.length > 0) {
          WSM.APIIntersectNonDestructive(
            WSM.GroupInstancePath([WSM.ObjectHistoryID(tempFloorSliceHistId, data.created[0])]),
            WSM.GroupInstancePath([WSM.ObjectHistoryID(tempFloorSliceHistId, bodyToIntersectId)]),
          )

          if (WSM.APIIsObjectLiveReadOnly(tempFloorSliceHistId, data.created[0])) {
            // Make the building mesh piece.
            const floorVolumeMeshes = WSM.Utils.GetAllGeometryInformation(tempFloorSliceHistId, data.created[0])
            const floorVolumes = reducedMeshesArrayToWSMGeometryData(floorVolumeMeshes, scaleTransform)
            bmps.push({ info: { areaType, functionId, area: areaGFAFace }, geo: floorVolumes })
          }
        }
      }
    }
  })

  // Finially use the bodies that did not particiate in an intersection.
  unusedBodiesIdSet.forEach((bodyId) => {
    if (WSM.APIIsObjectLiveReadOnly(tempFloorSliceHistId, bodyId)) {
      // Make the building mesh piece.
      const floorVolumeMeshes = WSM.Utils.GetAllGeometryInformation(tempFloorSliceHistId, bodyId)
      const floorVolumes = reducedMeshesArrayToWSMGeometryData(floorVolumeMeshes, scaleTransform)
      bmps.push({ info: {}, geo: floorVolumes })
    }
  })

  WSM.APIDeleteHistory(tempFloorSliceHistId)
  WSM.APIDeleteHistory(enlargedGfaHistoryId)

  if (bmps.length === 0) {
    console.error("We did not compute a floor volume!")
    // Use the floor bodies directly.
    allBodyIds.forEach((bodyId) => {
      const scaledFloorVolumeTransf3d = WSM.Transf3d.Multiply(scaleTransform, floorVolumeTransf3d)
      const floorVolumeMeshes = WSM.Utils.GetAllGeometryInformation(floorVolumeHistId, bodyId)
      const floorVolumes = reducedMeshesArrayToWSMGeometryData(floorVolumeMeshes, scaledFloorVolumeTransf3d)
      bmps.push({ info: {}, geo: floorVolumes })
    })
  }

  return bmps
}

// Helper function that gets the direction along an edge starting at the given vertex.
function getEdgeVectorFromVertex(historyId: number, edgeId: number, vertexId: number): WSM.Vector3dInterface {
  const vertexIds = WSM.APIGetObjectsByTypeReadOnly(historyId, edgeId, WSM.nObjectType.nVertexType)
  const pt0 = WSM.APIGetVertexPoint3dReadOnly(historyId, vertexIds[0])
  const pt1 = WSM.APIGetVertexPoint3dReadOnly(historyId, vertexIds[1])
  if (vertexId === vertexIds[0]) {
    return WSM.Geom.Vector3d(pt1.x - pt0.x, pt1.y - pt0.y, pt1.z - pt0.z)
  }

  return WSM.Geom.Vector3d(pt0.x - pt1.x, pt0.y - pt1.y, pt0.z - pt1.z)
}

// Function to extend interior edges and merge exterior edges that have become interior.
function extendAndMergeInteriorEdges(historyId: number) {
  let allEdgeIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nEdgeType)
  const edgeIdsToExtend: number[] = []
  allEdgeIds.forEach((edgeId) => {
    if (WSM.APIIsEdgeManifoldReadOnly(historyId, edgeId)) {
      const stringAtts = WSM.APIGetStringAttributesByKeyReadOnly(historyId, edgeId, keyForExteriorEdgeAttribute)
      if (stringAtts.length === 0) {
        // This edge is a candidate to extend.
        edgeIdsToExtend.push(edgeId)
      }
    }
  })

  // Extend edges as required.
  let bEdgeExtended = false
  edgeIdsToExtend.forEach((edgeToExtendId) => {
    const vertexIds = WSM.APIGetObjectsByTypeReadOnly(historyId, edgeToExtendId, WSM.nObjectType.nVertexType)
    if (vertexIds.length === 2) {
      vertexIds.forEach((vertexId) => {
        const connectedEdgeIds = WSM.APIGetObjectsByTypeReadOnly(
          historyId,
          vertexId,
          WSM.nObjectType.nEdgeType,
          true /*bUpStream*/,
        )
        if (connectedEdgeIds.length > 2) {
          const edgesToMerge: number[] = []
          connectedEdgeIds.forEach((connectedEdgeId) => {
            if (connectedEdgeId !== edgeToExtendId) {
              if (WSM.APIIsEdgeManifoldReadOnly(historyId, connectedEdgeId)) {
                const stringAtts = WSM.APIGetStringAttributesByKeyReadOnly(
                  historyId,
                  connectedEdgeId,
                  keyForExteriorEdgeAttribute,
                )
                if (stringAtts.length > 0) {
                  edgesToMerge.push(connectedEdgeId)
                }
              }
            }
          })

          if (edgesToMerge.length === 2) {
            // First check if the edge to extend lies between the edges to merge. Don't extend if not.
            const dir0 = getEdgeVectorFromVertex(historyId, edgesToMerge[0], vertexId)
            const dir1 = getEdgeVectorFromVertex(historyId, edgesToMerge[1], vertexId)

            // We need to extend the edge at this vertex. Extend to the first hit point.
            const pt0 = WSM.APIGetVertexPoint3dReadOnly(historyId, vertexIds[0])
            const pt1 = WSM.APIGetVertexPoint3dReadOnly(historyId, vertexIds[1])
            let line3d = WSM.Line3d.Line3d()
            if (vertexId === vertexIds[0]) {
              const negativeEdgeDir = WSM.Geom.Vector3d(pt0.x - pt1.x, pt0.y - pt1.y, pt0.z - pt1.z)
              line3d = WSM.Geom.Line3d(pt0, negativeEdgeDir)
            } else {
              const edgeDir = WSM.Geom.Vector3d(pt1.x - pt0.x, pt1.y - pt0.y, pt1.z - pt0.z)
              line3d = WSM.Geom.Line3d(pt1, edgeDir)
            }

            // Note we are assuming that the edges all have z === 0.
            if (Math.abs(line3d.vector.z) > WSM_MACHINE_TOL) {
              console.error("Expect all the z values to be 0")
            }
            const perpVector3d = WSM.Vector3d.Vector3d(-line3d.vector.y, line3d.vector.x, 0)
            const dot0 = WSM.Vector3d.DotProduct(dir0, perpVector3d)
            const dot1 = WSM.Vector3d.DotProduct(dir1, perpVector3d)
            if (
              (dot0 > WSM_DISTANCE_TOL && dot1 < -WSM_DISTANCE_TOL) ||
              (dot0 < -WSM_DISTANCE_TOL && dot1 > WSM_DISTANCE_TOL)
            ) {
              // The edge to extend is between the edges to merge.

              const hitData = WSM.APIRayFireSortedReadOnly(
                historyId,
                line3d,
                WSM_MACHINE_TOL,
                true,
                true,
                false,
                1.0e30,
                true,
              )
              let firstHitParam = 0.0
              if (isSearchInGroupsResult(hitData)) {
                if (hitData.sortedParameters && hitData.sortedParameters.length > 1) {
                  for (let index = 1; index < hitData.sortedParameters.length; index++) {
                    if (hitData.sortedParameters[index] > WSM_DISTANCE_TOL) {
                      firstHitParam = hitData.sortedParameters[index]
                      break
                    }
                  }
                }
              }
              if (firstHitParam > 0.0) {
                bEdgeExtended = true
                const intersectionPt = WSM.Line3d.GetPointFromParameter(line3d, firstHitParam)
                WSM.APIConnectPoint3ds(historyId, line3d.point, intersectionPt)
              }
            }
          }
        }
      })
    }
  })

  // Merge edges once all the extensions are done.
  if (bEdgeExtended) {
    // Get the edges since new edges could have been created from the extensions.
    allEdgeIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nEdgeType)
  }

  // Only merge an existing face with faces that are new. Once a new face is merged to an
  // existing face it is considered an existing face. This is controled with attribute
  // migration.
  let bEdgeMerged = false
  allEdgeIds.forEach((mergeEdgeId) => {
    if (WSM.APIIsObjectLiveReadOnly(historyId, mergeEdgeId) && WSM.APIIsEdgeMergeableReadOnly(historyId, mergeEdgeId)) {
      const stringAtts = WSM.APIGetStringAttributesByKeyReadOnly(historyId, mergeEdgeId, keyForExteriorEdgeAttribute)
      if (stringAtts.length > 0) {
        const faceIdsOnEdge = WSM.APIGetObjectsByTypeReadOnly(
          historyId,
          mergeEdgeId,
          WSM.nObjectType.nFaceType,
          true /*bUpstream*/,
        )

        let bDeleteEdge = true
        if (faceIdsOnEdge.length === 2) {
          const existFaceAtts0 = WSM.APIGetStringAttributesByKeyReadOnly(
            historyId,
            faceIdsOnEdge[0],
            keyForExistingFaceAttribute,
          )
          if (existFaceAtts0.length > 0) {
            const existFaceAtts1 = WSM.APIGetStringAttributesByKeyReadOnly(
              historyId,
              faceIdsOnEdge[1],
              keyForExistingFaceAttribute,
            )
            if (existFaceAtts1.length > 0) {
              bDeleteEdge = false
            }
          }
        }
        if (bDeleteEdge) {
          bEdgeMerged = true
          WSM.APIDeleteObjects(historyId, [mergeEdgeId])
        }
      }
    }
  })

  if (bEdgeMerged) {
    // Last clean up is to get rid of free edges.
    const edgesToDelete: number[] = []
    allEdgeIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nEdgeType)
    allEdgeIds.forEach((edgeId) => {
      if (
        WSM.APIGetObjectsByTypeReadOnly(historyId, edgeId, WSM.nObjectType.nFaceType, true /*bUpstream*/).length ===
          1 &&
        WSM.APIIsEdgeMergeableReadOnly(historyId, edgeId)
      ) {
        edgesToDelete.push(edgeId)
      }
    })

    if (edgesToDelete.length > 0) {
      WSM.APIDeleteObjects(historyId, edgesToDelete)
    }
  }
}

// Function labels exterior edges on faces so that they can be merged after extension. Also labels existing
// faces which whould not be merged to other existing faces.
function labelExteriorEdgesAndExistingFaces(historyId: number, valueString: string, checkForAtts: boolean) {
  const allEdgeIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nEdgeType)
  const exteriorEdgeIds: number[] = []
  allEdgeIds.forEach((edgeId) => {
    const coedgesOnEdge = WSM.APIGetObjectsByTypeReadOnly(
      historyId,
      edgeId,
      WSM.nObjectType.nCoedgeType,
      true /*bUpstream*/,
    )
    if (coedgesOnEdge.length === 1) {
      let addStringAttribute = true
      if (checkForAtts) {
        const stringAtts = WSM.APIGetStringAttributesByKeyReadOnly(historyId, edgeId, keyForExteriorEdgeAttribute)
        if (stringAtts.length > 0) {
          addStringAttribute = false
        }
      }

      // This is an exterior edge with no string attributes.
      if (addStringAttribute) {
        exteriorEdgeIds.push(edgeId)
      }
    }
  })

  if (exteriorEdgeIds.length > 0) {
    // Label the exterior edges
    WSM.APICreateStringAttribute(historyId, keyForExteriorEdgeAttribute, valueString, exteriorEdgeIds)
  }

  // Now label existing faces.
  const allFaceIds = WSM.APIGetAllObjectsByTypeReadOnly(historyId, WSM.nObjectType.nFaceType)
  const faceIdsForAtts: number[] = checkForAtts === false ? allFaceIds : []
  if (checkForAtts) {
    allFaceIds.forEach((faceId) => {
      const stringAtts = WSM.APIGetStringAttributesByKeyReadOnly(historyId, faceId, keyForExistingFaceAttribute)
      if (stringAtts.length === 0) {
        faceIdsForAtts.push(faceId)
      }
    })
  }

  if (faceIdsForAtts.length > 0) {
    // Label the existing faces
    WSM.APICreateStringAttribute(historyId, keyForExistingFaceAttribute, valueString, faceIdsForAtts)
  }
}

// Function to snap the vertices of gfaUnit faces to edges and vertices of the outline.
// Note this is required in cases where the gfaUnits are passed as doubles but the
// synced geometry comes in as a mesh and hence is stored in floats. For example, the
// gfaUnits on a dynamo element have this noise which needs to be corrected. The other
// case that comes to mind is basic buildings converted to 3d sketch buildings but here
// there is no noise since the footprints on each floor are in doubles.
function snapGFAUnitFacesToOutline(gfaHistoryId: number, outlineHistoryId: number) {
  const verticesToMove: number[] = []
  const newVertexPositions: Array<WSM.Point3dInterface> = []
  const vertexIds = WSM.APIGetAllObjectsByTypeReadOnly(gfaHistoryId, WSM.nObjectType.nVertexType)
  vertexIds.forEach((vertexId) => {
    const pt0 = WSM.APIGetVertexPoint3dReadOnly(gfaHistoryId, vertexId)
    pt0.z -= 0.1
    const line3dPickRay = WSM.Geom.Line3d(pt0, WSM.Vector3d.ZDirection())
    const tol = 1.0e-6 * Math.max(1.0, Math.sqrt(pt0.x * pt0.x + pt0.y * pt0.y))
    const hits = WSM.APIRayFireReadOnly(outlineHistoryId, line3dPickRay, tol, true, true, false)
    if (hits.length > 0) {
      if (hits.length > 1) {
        console.error("We expect one hit at most")
      }

      const nType = WSM.APIGetObjectTypeReadOnly(outlineHistoryId, hits[0])
      let pt1 = WSM.Point3d.Point3d(pt0.x, pt0.y, pt0.z)
      if (nType === WSM.nObjectType.nVertexType) {
        pt1 = WSM.APIGetVertexPoint3dReadOnly(outlineHistoryId, hits[0])
      } else if (nType === WSM.nObjectType.nEdgeType) {
        const { start, end } = WSM.APIGetEdgePointsReadOnly(outlineHistoryId, hits[0])
        const lineFromEdge = WSM.Line3d.Line3d(start, end)
        pt1 = WSM.Line3d.Project(lineFromEdge, pt0)
      }

      pt0.z = pt1.z
      if (WSM.Point3d.DistanceSquaredBetweenPoints(pt0, pt1) > WSM_MACHINE_TOL * WSM_MACHINE_TOL) {
        verticesToMove.push(vertexId)
        newVertexPositions.push(pt1)
      }
    }
  })

  if (verticesToMove.length > 0) {
    WSM.APIMoveVertices(gfaHistoryId, verticesToMove, newVertexPositions)
  }
}

// Function makes building piece meshes for a default floor plan. Returns true
// if a default floor plan was made.
function makeBuildingPieceMeshesForDefaultFloorPlan(
  floorIndex: number,
  gfaUnits: GFAUnit[] | undefined,
  indexToRefHistoryIdArray: number[] | undefined,
  floor3d: EmptyFloor3d | undefined,
  bmps: BuildingPieceMesh[],
) {
  // Check if we can use a default floor plan without doing any slicing.
  let makeDefaultFloorPlan: boolean = true
  if (gfaUnits !== undefined && gfaUnits.length !== 0 && (gfaUnits.length !== 1 || gfaUnits[0].areas.length !== 1)) {
    // If the number of outline polygons does not equal the number of gfa units, do not make
    // a default floor plan.
    if (floor3d === undefined || floor3d.floorOutline.length !== gfaUnits.length) {
      makeDefaultFloorPlan = false
    } else {
      for (let i = 0; i < gfaUnits.length; i++) {
        // Do not allow mutliple areas per unit.
        if (gfaUnits[i].areas.length > 1) {
          makeDefaultFloorPlan = false
          break
        }
      }

      if (makeDefaultFloorPlan) {
        // The area type and function ids must all be the same.
        for (let i = 1; i < gfaUnits.length; i++) {
          if (gfaUnits[i].functionId !== gfaUnits[0].functionId || gfaUnits[i].areaType !== gfaUnits[0].areaType) {
            makeDefaultFloorPlan = false
            break
          }
        }
      }
    }
  }

  if (makeDefaultFloorPlan) {
    console.log("Using default floor plan " + floorIndex)
    // The best we can do is one unit per floor based on the outline.
    const functionId = gfaUnits && gfaUnits.length > 0 ? gfaUnits[0].functionId : undefined

    let areaType: "CORE" | "CORRIDOR" | "LIVING_UNIT" | "PARKING" | undefined = undefined
    if (gfaUnits && gfaUnits.length > 0) {
      const areaTypeFromGFA = gfaUnits[0].areaType
      if (
        areaTypeFromGFA === "CORE" ||
        areaTypeFromGFA === "CORRIDOR" ||
        areaTypeFromGFA === "LIVING_UNIT" ||
        areaTypeFromGFA === "PARKING"
      ) {
        areaType = areaTypeFromGFA
      }
    }

    if (indexToRefHistoryIdArray !== undefined && indexToRefHistoryIdArray[floorIndex] !== undefined) {
      const scaleTransf3d = WSM.Geom.Transf3d()
      scaleTransf3d.data[0] = FEET_TO_METER
      scaleTransf3d.data[5] = FEET_TO_METER
      scaleTransf3d.data[10] = FEET_TO_METER

      const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(
        indexToRefHistoryIdArray[floorIndex],
        WSM.nObjectType.nBodyType,
      )
      bodyIds.forEach((bodyId) => {
        const floorVolumeMeshes = WSM.Utils.GetAllGeometryInformation(indexToRefHistoryIdArray[floorIndex], bodyId)
        const floorVolumes = reducedMeshesArrayToWSMGeometryData(floorVolumeMeshes, scaleTransf3d)

        // TODO: Compute the area from the lowest face on the body.
        bmps.push({ info: { areaType, functionId }, geo: floorVolumes })
      })
    }

    return { usingDefault: true, functionId, areaType }
  }

  return { usingDefault: false, functionId: undefined, areaType: undefined }
}

// Traverse MultiRingPolygon array to pull out spaces, graphs and units per building
// floor as well as save the function type to the unit if the value exists
export function getGraphSpacesUpdateUnits(
  snapshot: ElementSnapshot,
  floorOutline: MultiRingPolygon[],
  floorIndex: number,
  floorId: string,
  units: Unit[],
  floorPath?: InternalPath,
  indexToRefHistoryIdArray?: number[],
  floor3d?: EmptyFloor3d,
  gfaUnitsFromBuildingPerFloor?: GFAUnit[],
  gfaMatrix?: Matrix4,
): {
  unitsGraph: {
    spaces: Spaces
    graph: Graph
  }
  bmps: BuildingPieceMesh[]
} {
  let bmps: BuildingPieceMesh[] = []
  const floorNode = floorPath ? snapshot.getNode(floorPath) : undefined
  const floorElement = floorNode?.elementContainer.element

  let gfaUnits = floorElement?.representations?.gfaUnits
    ? getRepresentationJsonUnsafe(floorElement.representations.gfaUnits)
    : undefined

  let snapGFAUnits = false
  if (gfaUnits === undefined && gfaUnitsFromBuildingPerFloor !== undefined && gfaUnitsFromBuildingPerFloor.length > 0) {
    // Use the gfa units that were on the parent, for example from dynamo elements.
    gfaUnits = gfaUnitsFromBuildingPerFloor

    // The building is likely a mesh in floats and the gfaUnits are doubles as stored in the element.
    // There could be noise due to this. Snap to fix it.
    snapGFAUnits = true
  }

  const usingDefaultData = makeBuildingPieceMeshesForDefaultFloorPlan(
    floorIndex,
    gfaUnits,
    indexToRefHistoryIdArray,
    floor3d,
    bmps,
  )
  // Note we do not need to check if gfaUnits is undefined but do so to avoid a lint warning.
  if (gfaUnits === undefined || usingDefaultData.usingDefault === true) {
    return {
      unitsGraph: getGraphSpacesUpdateUnitsNoInterior(
        floorOutline,
        floorId,
        units,
        usingDefaultData.functionId,
        usingDefaultData.areaType,
      ),
      bmps,
    }
  }

  // First create wsm faces for the gfa units.
  const tempHistoryId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)

  createWSMFacesFromGFAUnits(tempHistoryId, gfaUnits, gfaMatrix)

  // Label so when we enclose in the outline, we can tell what needs to be merged.
  labelExteriorEdgesAndExistingFaces(tempHistoryId, "GFAUnits", false)

  // Next split the gfa faces at the outline and throw out pieces outside.
  splitAndTrimGFAFacesWithOutline(tempHistoryId, floorOutline, snapGFAUnits)

  // Make sure we fix the floor plans by extending edges and merging.
  extendAndMergeInteriorEdges(tempHistoryId)

  if (indexToRefHistoryIdArray !== undefined && indexToRefHistoryIdArray[floorIndex] !== undefined) {
    bmps = intersectFloorVolumesWithExtrudedGFAFaces(tempHistoryId, floorIndex, indexToRefHistoryIdArray[floorIndex])
  }

  // Finally make areas from the remaining faces which are also labeled as before.
  const unitsGraph = getGraphSpacesUpdateUnitsFromWSMFaces(tempHistoryId, floorId, units)
  WSM.APIDeleteHistory(tempHistoryId)
  return { unitsGraph, bmps }
}

// Used when saving from the floor plan sketcher to compute the new building piece meshes
// from the given gfa units.
export function getBuildingPieceMeshesFromGFAUnits(
  floorIndex: number,
  gfaUnits: GFAUnit[],
  indexToRefHistoryIdArray: number[],
  floor3d: EmptyFloor3d,
): BuildingPieceMesh[] {
  let bmps: BuildingPieceMesh[] = []

  if (indexToRefHistoryIdArray.length === 0 || indexToRefHistoryIdArray[floorIndex] === undefined) {
    return bmps
  }

  const usingDefaultData = makeBuildingPieceMeshesForDefaultFloorPlan(
    floorIndex,
    gfaUnits,
    indexToRefHistoryIdArray,
    floor3d,
    bmps,
  )

  if (usingDefaultData.usingDefault === true) {
    return bmps
  }

  // First create wsm faces for the gfa units.
  const tempHistoryId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
  createWSMFacesFromGFAUnits(tempHistoryId, gfaUnits)
  bmps = intersectFloorVolumesWithExtrudedGFAFaces(tempHistoryId, floorIndex, indexToRefHistoryIdArray[floorIndex])
  WSM.APIDeleteHistory(tempHistoryId)

  return bmps
}
