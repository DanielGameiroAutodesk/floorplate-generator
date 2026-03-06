import type { InternalPath } from "src/lib/element/path"
import type { WSMDetailsForElementPath } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import { wsmSideEffectAdapter } from "src/integrations/wsm-tools/wsm-integration/wsm-side-effect-adapter"
import { WSM_MACHINE_TOL, type ReducedMeshesAndTransformsData, type WSMGeometryData } from "./types"
import { FEET_TO_METER } from "@spacemakerai/forma-units"
import { Matrix3 } from "three"
import type { NormalBufferAttributes, Color } from "three"
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from "three"
import { generateColorArray } from "src/lib/three/geometryUtils"
import {
  addWSMLevelDataToWSMInstance,
  createFloorsFromInstance,
  deleteFloorCollection,
} from "src/integrations/wsm-tools/building/buildingFloorUtils"
import { isIterable } from "src/integrations/wsm-tools/wsr/utils"
import type { Buffer, Node } from "@gltf-transform/core"
import { Document, NodeIO, VertexLayout, Accessor } from "@gltf-transform/core"
import type {
  GraphBuilding,
  GraphBuildingUnit,
  GraphBuildingLevel,
  GraphBuildingCoSurface,
  Transform,
  Urn,
} from "forma-elements"
import type { FilledBuilding3d } from "src/integrations/building-systems-floor-plans-in-3d-sketch-buildings/3dSketchBuildingTypes"
import { v4 as uuidv4 } from "uuid"
import { checkIfInCache } from "src/integrations/element-state-side-effects-adapter/syncPath"
import { getFirstObjectAndHistoryIdFromGIP } from "src/integrations/wsm-tools/wsr/integrated/utils"

/**
 * Represents mesh data as a flat list of numbers. [x1,y1,z1,x2,y2,z2...]
 */
interface RawJSMeshData {
  meshPositions: number[]
  meshNormals: number[]
}

export function lookupWSMObject(path: InternalPath): WSMDetailsForElementPath | undefined {
  // Note for ground polygons, we cannot sync until terrain is fully loaded so there could
  // be some time before the path is actually added to the map.
  return wsmSideEffectAdapter.mapping.get(path)
}

// Returns true if the internal path has been synced to wsm and the wsm model is ready
// to be used.
export function isPathSyncUpToDate(path: InternalPath, urn: Urn, transform: Transform): boolean {
  const cacheStatus = checkIfInCache(wsmSideEffectAdapter.cache, path, urn, transform)
  if (cacheStatus === "up-to-date") {
    return true
  }

  return false
}

export function setWSMObjectInMap(path: InternalPath, wsmDetails: WSMDetailsForElementPath) {
  wsmSideEffectAdapter.mapping.set(path, wsmDetails)
}

function getDataFromInstancePath(groupInstancePath: WSM.GroupInstancePathInterface) {
  const finalObjectHistoryId = WSM.Utils.GetGroupInstancePathFinalObjectHistoryID(groupInstancePath)
  const refHistoryId = WSM.APIGetGroupReferencedHistoryReadOnly(
    finalObjectHistoryId.History,
    finalObjectHistoryId.Object,
  )
  if (refHistoryId === WSM.INVALID_ID) {
    throw new Error("invalid history")
  }

  const groupId = WSM.APIGetTopLevelOwnersReadOnly(finalObjectHistoryId.History, finalObjectHistoryId.Object)[0]

  return {
    finalObjectHistoryId,
    groupId,
    refHistoryId,
  }
}

// Function saves a WSM object to an axm string that is used during save of the Forma element.
// Note this is saved as if there is no transform on the instance.
export function wsmObjectToAXMStringForSave(groupInstancePath: WSM.GroupInstancePathInterface) {
  const { groupId, finalObjectHistoryId, refHistoryId } = getDataFromInstancePath(groupInstancePath)

  // Before saving, remove the element's world transform. We don't want to persist that.
  const instanceTransform = WSM.GroupInstancePath.GetObjectTransform(groupInstancePath)
  if (WSM.Transf3d.IsIdentity(instanceTransform)) {
    // Just save when the transform is the identity.
    return WSM.APISaveToAXMStringReadOnly(finalObjectHistoryId.History, [groupId])
  }

  // Create a new temp history
  const tempHistoryId = WSM.APICreateHistory(WSM.INVALID_ID, false /*bNonTemporary*/)
  // Create new group
  const newGroupId = WSM.APICreateGroup(tempHistoryId, [], [], refHistoryId)
  // Get the id of the group instance
  const { historyId, objectId: instanceId } = getFirstObjectAndHistoryIdFromGIP(groupInstancePath)
  // Get the level ids
  const levelIds = WSM.APIGetObjectLevelsReadOnly(historyId, instanceId)
  // If levels exist
  if (levelIds.length > 0) {
    // Get level data
    const levelData = levelIds
      .map((levelId) => {
        // Convert it
        const level = WSM.APIGetLevelDataReadOnly(historyId, levelId, false /*bGlobalElevation*/)
        return { first: level.sLevelName, second: level.dElevation }
      })
      // Sort by elevation
      .sort((a, b) => {
        return a.second - b.second
      })

    if (levelData.length) {
      // Get the instance ids of the new group
      const newGroupInstanceIds = WSM.APIGetObjectsByTypeReadOnly(
        tempHistoryId,
        newGroupId,
        WSM.nObjectType.nInstanceType,
      )
      // Add the levels
      if (newGroupInstanceIds.length) addWSMLevelDataToWSMInstance(tempHistoryId, newGroupInstanceIds[0], levelData)
    }
  }

  //Save the group, which at this time just has 1 instance
  //May need to change this in the future if assumptions here are wrong.
  const axmRepresentation = WSM.APISaveToAXMStringReadOnly(tempHistoryId, [newGroupId])

  // Delete the temp history
  WSM.APIDeleteHistory(tempHistoryId)
  return axmRepresentation
}

function isSaveableGeometry(t: WSM.nObjectType): boolean {
  if (t === WSM.nBodyType || t === WSM.nFaceType || t === WSM.nMeshType || t === WSM.nGroupType) {
    return true
  }
  return false
}

// Note this function only works with an instance in the main/top history. This is because buildings
// are expected to come from instances in the top history with levels applied. The geometry we
// return from this function is for drawing in designmode, so in the case of buildings we make floor
// polygons which do not exist in WSM. Also scale to meters. Note the instance transform matches the
// element transform after the save.
export function wsmTopInstanceToGeometryData(groupInstancePath: WSM.GroupInstancePathInterface): WSMGeometryData {
  if (groupInstancePath.ids.length !== 1) {
    console.warn("The group instance path is not a top level instance!")
    return {
      position: new Float32Array(),
      normal: new Float32Array(),
    }
  }

  const { refHistoryId } = getDataFromInstancePath(groupInstancePath)
  const nonOwned = WSM.APIGetAllNonOwnedReadOnly(refHistoryId)
  const { types } = WSM.Utils.GetObjectTypes(refHistoryId, nonOwned)
  const toplevelObjects = nonOwned.filter((_obj, idx) => isSaveableGeometry(types[idx]))
  if (toplevelObjects.length === 0) {
    console.warn("No objects to save! Was the GIP an instance?")
    return {
      position: new Float32Array(),
      normal: new Float32Array(),
    }
  }

  // Should I get the normals and triangles directly from the body??? If so return
  // a different floorVolumeMeshes but still one per floor.
  let floorGrossPolygons = createFloorsFromInstance(groupInstancePath.ids[0].History, groupInstancePath.ids[0].Object)

  // Verify that we have all the expected floor areas. If any are missing, the building does not make sense.
  if (floorGrossPolygons.length > 0) {
    let areFloorsGood: boolean = true
    for (let i = 0; i < floorGrossPolygons.length; i++) {
      if (floorGrossPolygons[i] === undefined || floorGrossPolygons[i].length === 0) {
        areFloorsGood = false
        break
      }
    }

    if (!areFloorsGood) {
      console.error("Floors are bad", floorGrossPolygons)
      floorGrossPolygons = []
      deleteFloorCollection(groupInstancePath)
    }
  }

  if (floorGrossPolygons.length > 0) {
    floorGrossPolygons.forEach((floorGrossPolygonsAtElevation) => {
      floorGrossPolygonsAtElevation.forEach((floorGrossAreaPolygon) => {
        // This if is a guess at a fix for a sentry error.
        if (floorGrossAreaPolygon.elevation) {
          floorGrossAreaPolygon.elevation *= FEET_TO_METER
        }
        for (let i = 0; i < floorGrossAreaPolygon.grossFloorPolygon.length; i++) {
          for (let j = 0; j < floorGrossAreaPolygon.grossFloorPolygon[i].length; j++) {
            for (let k = 0; k < floorGrossAreaPolygon.grossFloorPolygon[i][j].length; k++) {
              floorGrossAreaPolygon.grossFloorPolygon[i][j][k] *= FEET_TO_METER
            }
          }
        }
      })
    })
  }

  const geometryInformation = WSM.Utils.GetAllGeometryInformation(refHistoryId)
  if (geometryInformation.length === 0) {
    return {
      position: new Float32Array(),
      normal: new Float32Array(),
    }
  }

  const scaleTransform = WSM.Geom.MakeScalingTransform(
    WSM.Point3d.Point3d(0, 0, 0),
    WSM.Vector3d.Vector3d(FEET_TO_METER, FEET_TO_METER, FEET_TO_METER),
  )

  const shellGeometry = reducedMeshesArrayToWSMGeometryData(geometryInformation, scaleTransform)
  const shellAndFloorGeometry = { ...shellGeometry, floorPolygons: floorGrossPolygons }
  return shellAndFloorGeometry
}

/**
 *
 * @param reducedMeshesArray Given an array of sets of reduced meshes, returns all the positions/normals
 * multiplied out into world space
 * @param transform A transform to move all these objects by, besides their own transforms.
 * @returns @see WSMGeometryData
 */
export function reducedMeshesArrayToWSMGeometryData(
  reducedMeshesArray: ReducedMeshesAndTransformsData[],
  transform: WSM.Transf3dInterface,
): WSMGeometryData {
  // Make sure our array is valid. Easier to check here than the multiple
  // places this is used.
  if (!isIterable(reducedMeshesArray)) {
    console.error("reducedMeshesArrayToWSMGeometryData received bad input")
    return {
      position: new Float32Array(),
      normal: new Float32Array(),
    }
  }

  let aggregateMeshPositions: number[] = []
  let aggregateMeshNormals: number[] = []

  for (const reducedMeshesAndTransforms of reducedMeshesArray) {
    const { meshPositions, meshNormals } = reducedMeshesToPositionAndNormalArray(reducedMeshesAndTransforms, transform)

    aggregateMeshPositions = aggregateMeshPositions.concat(meshPositions)
    aggregateMeshNormals = aggregateMeshNormals.concat(meshNormals)
  }

  return {
    position: new Float32Array(aggregateMeshPositions),
    normal: new Float32Array(aggregateMeshNormals),
  }
}

/**
 *
 * @param reducedMeshes Given a set of reduced meshes, returns all the positions/normals multiplied out into world space
 * @param transform A transform to move all these objects by, besides their own transforms.
 * @returns @see RawJSMeshData
 */
function reducedMeshesToPositionAndNormalArray(
  reducedMeshes: ReducedMeshesAndTransformsData,
  transform: WSM.Transf3dInterface,
): RawJSMeshData {
  let aggregateMeshPositions: number[] = []
  let aggregateMeshNormals: number[] = []
  for (const tf of reducedMeshes.transforms) {
    const finalTransform = WSM.Transf3d.Multiply(transform, tf)
    const { meshPositions, meshNormals } = outputMeshPositionAndNormals(reducedMeshes, finalTransform)
    aggregateMeshPositions = aggregateMeshPositions.concat(meshPositions)
    aggregateMeshNormals = aggregateMeshNormals.concat(meshNormals)
  }

  return {
    meshPositions: aggregateMeshPositions,
    meshNormals: aggregateMeshNormals,
  }
}

/**
 * Given reduced meshes and a transform, multiplies the reduced mesh position data by the transform
 * and returns the resulting position/normal array as a flat list (@see RawJSMeshData)
 *
 * @param reducedMeshes
 * @param transform
 * @returns
 */
function outputMeshPositionAndNormals(
  reducedMeshes: ReducedMeshesAndTransformsData,
  wsmTransform: WSM.Transf3dInterface,
): RawJSMeshData {
  const meshPositions: number[] = []
  const meshNormals: number[] = []

  const verticeTransform = new Matrix4().fromArray(wsmTransform.data).transpose()
  const normalTransform = new Matrix3().setFromMatrix4(verticeTransform)

  const reuseVec1 = new Vector3()
  for (let n = 0; n < reducedMeshes.meshes.length; n++) {
    const reducedMesh = reducedMeshes.meshes[n]
    const { vertices, normals, indices } = reducedMesh

    indices.forEach((index: number) => {
      reuseVec1.set(vertices[index * 3], vertices[index * 3 + 1], vertices[index * 3 + 2])
      const transformedVertex = reuseVec1.applyMatrix4(verticeTransform)
      meshPositions.push(...[transformedVertex.x, transformedVertex.y, transformedVertex.z])

      reuseVec1.set(normals[index * 3], normals[index * 3 + 1], normals[index * 3 + 2])
      const transformedNormal = reuseVec1.applyNormalMatrix(normalTransform)
      meshNormals.push(...[transformedNormal.x, transformedNormal.y, transformedNormal.z])
    })
  }

  return {
    meshPositions,
    meshNormals,
  }
}

function getBuffergeometryFromPositionNormal(position: Float32Array, normal: Float32Array, color: Color) {
  const bgeo = new BufferGeometry()
  bgeo.setAttribute("position", new BufferAttribute(position, 3))
  bgeo.setAttribute("normal", new BufferAttribute(normal, 3))
  bgeo.setAttribute("color", new BufferAttribute(generateColorArray(color, position.length / 3), 3))

  return bgeo
}

export function getBufferGeometriesFromWSMGeometryData(
  geoData: WSMGeometryData,
  color: Color,
): { shell?: BufferGeometry; floors?: BufferGeometry[] } {
  let shell: BufferGeometry | undefined = undefined
  let floors: BufferGeometry[] | undefined = undefined

  if (geoData.position.length > 0) {
    shell = getBuffergeometryFromPositionNormal(geoData.position, geoData.normal, color)
  }

  if (geoData.floorVolumes && geoData.floorVolumes.length > 0) {
    floors = []
    for (let i = 0; i < geoData.floorVolumes.length; i++) {
      floors.push(
        getBuffergeometryFromPositionNormal(geoData.floorVolumes[i].position, geoData.floorVolumes[i].normal, color),
      )
    }
  }

  return { shell, floors }
}

type GlbNodeConfig = { geometry: BufferGeometry<NormalBufferAttributes>; extras?: Record<string, any> }
type GlbSceneConfig = { [name: string]: GlbNodeConfig | GlbSceneConfig }

export async function generateGlb(glbSceneConfig: GlbSceneConfig): Promise<Uint8Array> {
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene()

  function assembleSceneNodes(sceneConfig: GlbSceneConfig): Node[] {
    const createdNodes: Node[] = []
    for (const [name, configOrSubScene] of Object.entries(sceneConfig)) {
      let config: GlbNodeConfig | null = null
      let subScene: GlbSceneConfig | null = null
      if (configOrSubScene.geometry && (configOrSubScene.geometry as BufferGeometry)?.attributes) {
        config = configOrSubScene as GlbNodeConfig
      } else {
        subScene = configOrSubScene as GlbSceneConfig
      }

      if (config) {
        const node = buildGlbNode(doc, buffer, config.geometry, name, config.extras)
        createdNodes.push(node)
      } else if (subScene) {
        const parentNode = doc.createNode(name)
        const childNodes = assembleSceneNodes(subScene)
        childNodes.forEach((node) => parentNode.addChild(node))
        createdNodes.push(parentNode)
      }
    }
    return createdNodes
  }

  const assembledNodes = assembleSceneNodes(glbSceneConfig)
  assembledNodes.forEach((node) => scene.addChild(node))

  return await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).writeBinary(doc)
}
function buildGlbNode(
  doc: Document,
  buffer: Buffer,
  geometry: BufferGeometry,
  name: string,
  extras?: Record<string, any>,
): Node {
  const positions = new Float32Array(geometry.attributes.position.array)
  const normals = new Float32Array(geometry.attributes.normal.array)
  const colors = geometry.attributes.color ? new Float32Array(geometry.attributes.color.array) : undefined

  const position = doc.createAccessor().setArray(positions).setType(Accessor.Type.VEC3).setBuffer(buffer)
  const normal = doc.createAccessor().setArray(normals).setType(Accessor.Type.VEC3).setBuffer(buffer)
  const material = doc.createMaterial()
  const primitive = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute("POSITION", position)
    .setAttribute("NORMAL", normal)

  if (colors) {
    colors.forEach((value, index, array) => {
      array[index] = value / 255
    })
    primitive.setAttribute(
      "COLOR_0",
      doc.createAccessor().setArray(colors).setType(Accessor.Type.VEC3).setBuffer(buffer),
    )
  }

  const mesh = doc.createMesh(name).addPrimitive(primitive)

  const node = doc.createNode(name)
  node.setMesh(mesh)
  node.setMatrix([1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1])

  if (extras) {
    node.setExtras(extras)
  }

  return node
}

enum SemanticMeshTag {
  Roof = "roof",
  Wall = "wall",
}

// takes WSMGeometryData and returns a glb with semantic tagging of roofs and walls
export async function generateSemanticMeshGlb(wsmGeo: WSMGeometryData): Promise<ArrayBuffer> {
  const shellSemanticPieces = normalBasedShellSemanticPartition(wsmGeo.position, wsmGeo.normal)

  const geometryNodes: Record<string, GlbNodeConfig> = {}
  if (shellSemanticPieces.roofs) {
    const roofBufferGeometry = new BufferGeometry()
    roofBufferGeometry.setAttribute("position", new BufferAttribute(shellSemanticPieces.roofs.positions, 3))
    roofBufferGeometry.setAttribute("normal", new BufferAttribute(shellSemanticPieces.roofs.normals, 3))
    geometryNodes["roofs"] = { geometry: roofBufferGeometry, extras: { geometryType: SemanticMeshTag.Roof } }
  }

  if (wsmGeo.floorVolumes && wsmGeo.floorVolumes.length > 1) {
    wsmGeo.floorVolumes.forEach((floorVolume, level) => {
      const floorVolumeSemanticPieces = normalBasedShellSemanticPartition(floorVolume.position, floorVolume.normal)
      if (floorVolumeSemanticPieces.exteriorWalls) {
        const directionalGroupedWalls = groupByHorizontalNormalsSimilarity(
          floorVolumeSemanticPieces.exteriorWalls.positions,
          floorVolumeSemanticPieces.exteriorWalls.normals,
        )
        directionalGroupedWalls.forEach((triangles, index) => {
          const wallBufferGeometry = new BufferGeometry()
          wallBufferGeometry.setAttribute("position", new BufferAttribute(triangles.positions, 3))
          wallBufferGeometry.setAttribute("normal", new BufferAttribute(triangles.normals, 3))
          geometryNodes[`wall-${level}-${index}`] = {
            geometry: wallBufferGeometry,
            extras: { geometryType: SemanticMeshTag.Wall },
          }
        })
      }
    })
  } else if (shellSemanticPieces.exteriorWalls) {
    const directionalGroupedWalls = groupByHorizontalNormalsSimilarity(
      shellSemanticPieces.exteriorWalls.positions,
      shellSemanticPieces.exteriorWalls.normals,
    )
    directionalGroupedWalls.forEach((triangles, index) => {
      const wallBufferGeometry = new BufferGeometry()
      wallBufferGeometry.setAttribute("position", new BufferAttribute(triangles.positions, 3))
      wallBufferGeometry.setAttribute("normal", new BufferAttribute(triangles.normals, 3))
      geometryNodes[`wall-${index}`] = { geometry: wallBufferGeometry, extras: { geometryType: SemanticMeshTag.Wall } }
    })
  }

  // semanticMesh requires a single parent node
  return await generateGlb({ building: geometryNodes })
}

type SemanticPartitionedTriangles = {
  roofs?: { positions: Float32Array; normals: Float32Array }
  exteriorWalls?: { positions: Float32Array; normals: Float32Array }
  others?: { positions: Float32Array; normals: Float32Array }
}
const ROOF_NORMAL_TOLERANCE = 0.4 // ~23 degrees from horizontal
const FLOOR_NORMAL_TOLERANCE = 0.95
function normalBasedShellSemanticPartition(
  positions: Float32Array,
  normals: Float32Array,
): SemanticPartitionedTriangles {
  const semanticPartitionedTriangleStartIndexes: {
    [key in NonNullable<keyof SemanticPartitionedTriangles>]: number[]
  } = {
    roofs: [],
    exteriorWalls: [],
    others: [],
  }
  for (let i = 0; i + 8 < positions.length; i += 9) {
    // if z components of normals are all up then triangle is pointing up
    if (
      normals[i + 2] > ROOF_NORMAL_TOLERANCE &&
      normals[i + 5] > ROOF_NORMAL_TOLERANCE &&
      normals[i + 8] > ROOF_NORMAL_TOLERANCE
    ) {
      semanticPartitionedTriangleStartIndexes.roofs.push(i)
    }
    // if z components of normals are all down then triangle is pointing down
    else if (
      normals[i + 2] < -FLOOR_NORMAL_TOLERANCE &&
      normals[i + 5] < -FLOOR_NORMAL_TOLERANCE &&
      normals[i + 8] < -FLOOR_NORMAL_TOLERANCE
    ) {
      semanticPartitionedTriangleStartIndexes.others.push(i)
    } else {
      semanticPartitionedTriangleStartIndexes.exteriorWalls.push(i)
    }
  }

  const semanticPartitionedTriangles: SemanticPartitionedTriangles = {}

  for (const semanticCategory of Object.keys(semanticPartitionedTriangleStartIndexes)) {
    const safeSemanticCategory = semanticCategory as keyof SemanticPartitionedTriangles
    if (semanticPartitionedTriangleStartIndexes[safeSemanticCategory].length > 0) {
      const semanticPositions = getFloat32ArrayTriangleIndexedSubset(
        positions,
        semanticPartitionedTriangleStartIndexes[safeSemanticCategory],
      )
      const semanticNormals = getFloat32ArrayTriangleIndexedSubset(
        normals,
        semanticPartitionedTriangleStartIndexes[safeSemanticCategory],
      )

      semanticPartitionedTriangles[safeSemanticCategory] = {
        positions: semanticPositions,
        normals: semanticNormals,
      }
    }
  }

  return semanticPartitionedTriangles
}

function groupByHorizontalNormalsSimilarity(
  positions: Float32Array,
  normals: Float32Array,
): { positions: Float32Array; normals: Float32Array }[] {
  const xyGroupedTriangleStartIndexes: Record<string, number[]> = {}
  for (let i = 0; i + 8 < normals.length; i += 9) {
    // If plane of triangle is similar to another group then add it else create a new group
    const triangleXNormalAverage = (normals[i] + normals[i + 3] + normals[i + 6]) / 3
    const triangleYNormalAverage = (normals[i + 1] + normals[i + 4] + normals[i + 7]) / 3
    const triangleZNormalAverage = (normals[i + 2] + normals[i + 5] + normals[i + 8]) / 3
    const triangleRoughPlaneConstant = -(
      triangleXNormalAverage * positions[i] +
      triangleYNormalAverage * positions[i + 1] +
      triangleZNormalAverage * positions[i + 2]
    )
    const roughPlaneKey = `${triangleXNormalAverage.toFixed(1)}-${triangleYNormalAverage.toFixed(1)}-${triangleRoughPlaneConstant.toFixed(1)}`
    if (xyGroupedTriangleStartIndexes[roughPlaneKey]) {
      xyGroupedTriangleStartIndexes[roughPlaneKey].push(i)
    } else {
      xyGroupedTriangleStartIndexes[roughPlaneKey] = [i]
    }
  }

  const groups: { positions: Float32Array; normals: Float32Array }[] = []
  for (const triangleStartIndexes of Object.values(xyGroupedTriangleStartIndexes)) {
    const groupedPositions = getFloat32ArrayTriangleIndexedSubset(positions, triangleStartIndexes)
    const groupedNormals = getFloat32ArrayTriangleIndexedSubset(normals, triangleStartIndexes)
    groups.push({ positions: groupedPositions, normals: groupedNormals })
  }

  return groups
}

// Given a Float32Array of triangles and an array of start indexes return a new Float32Array of only the triangles indexed.
function getFloat32ArrayTriangleIndexedSubset(original: Float32Array, triangleStartIndexes: number[]): Float32Array {
  const newLength = triangleStartIndexes.length * 9
  const newArray = new Float32Array(newLength)
  for (let i = 0; i < triangleStartIndexes.length; i++) {
    const triangleToAdd = original.subarray(triangleStartIndexes[i], triangleStartIndexes[i] + 9)
    newArray.set(triangleToAdd, i * 9)
  }

  return newArray
}

export type GraphBuildingProperties = {
  approximations: {
    isSlantedRoofs: boolean
    isSlantedWalls: boolean
    isSlantedBases: boolean
  }
}

/**
 *
 * @param buildind3dRep
 * @param buildingRoofPeakElevation for getting height of top floor
 * @returns
 */
export function generateGraphBuildingFrom3dsBuilding(
  buildind3dRep: FilledBuilding3d,
  buildingRoofPeakElevation: number,
): GraphBuilding {
  const graphBuildingUnits: GraphBuildingUnit[] = buildind3dRep.units.map((unit3ds) => ({
    id: unit3ds.id,
    spaceIds: unit3ds.spaces.map((s) => s.spaceId),
    properties: {
      function: unit3ds.function, // TODO: or should we use unit3ds.functionId ?
      program: unit3ds.program,
    },
  }))

  const graphBuildingLevels: GraphBuildingLevel[] = buildind3dRep.floors3d.map((floor3ds, index) => {
    // 3DS building rep has elevation and graphBuilding has height
    let graphBuildingHeight: number
    if (index + 1 === buildind3dRep.floors3d.length) {
      graphBuildingHeight = buildingRoofPeakElevation - floor3ds.elevation
    } else {
      graphBuildingHeight = buildind3dRep.floors3d[index + 1].elevation - floor3ds.elevation
    }

    const graphBuildingPoints = Object.entries(floor3ds.graph.vertices).reduce(
      (points, [id, vertice]) => ({
        ...points,
        [id]: [vertice.x, vertice.y],
      }),
      {},
    )

    const graphBuildingSurfaces = Object.values(floor3ds.graph.edges).map((edge) => ({
      id: edge.id,
      pointA: edge.start,
      pointB: edge.end,
    }))

    // 3ds building rep describes a space by a point loop and GraphBuilding describes a space
    // by a surface loop with specification of direction a->b or b->a. These maps allow us to
    // recover that information.
    const pointsABSurfaceMap: Map<string, string> = new Map()
    const pointsBASurfaceMap: Map<string, string> = new Map()
    graphBuildingSurfaces.forEach((surface) => {
      pointsABSurfaceMap.set(`${surface.pointA}_${surface.pointB}`, surface.id)
      pointsBASurfaceMap.set(`${surface.pointB}_${surface.pointA}`, surface.id)
    })

    // GraphBuilding spaces are defined by "CoSurfaces" which allow different space-specific
    // surfaces to reference the same underlying surface. This map allows us to keep track of
    // the underlying surfaces that are assigned to a CoSurface, that way we can populate the
    // CoSurface partnerId field which is what explicitly defines that they share an underlying
    // surface, besides the fact that they implicitly share a surface by having the same surfaceId.
    // The value of the map is the CoSurface reference so we can edit it directly. yay refs.
    const surfaceCoSurfaceMap: Map<string, GraphBuildingCoSurface> = new Map()

    const graphBuildingSpaces = Object.values(floor3ds.spaces).map((space3ds) => {
      const graphBuildingSpaceOuterLoop = space3ds.polygon.flatMap((verticeId, i) => {
        let verticeStepKey: string
        if (i === space3ds.polygon.length - 1) {
          // sometimes space3ds.polygon has a closed loop and sometimes it doesn't
          if (verticeId === space3ds.polygon[0]) {
            return []
          }
          verticeStepKey = `${verticeId}_${space3ds.polygon[0]}`
        } else {
          verticeStepKey = `${verticeId}_${space3ds.polygon[i + 1]}`
        }

        let surfaceId: string
        let directionAToB: boolean
        if (pointsABSurfaceMap.has(verticeStepKey)) {
          surfaceId = pointsABSurfaceMap.get(verticeStepKey)!
          directionAToB = true
        } else if (pointsBASurfaceMap.has(verticeStepKey)) {
          surfaceId = pointsBASurfaceMap.get(verticeStepKey)!
          directionAToB = false
        } else {
          throw new Error(
            "Error generating graphBuilding for 3DS building. No surface found for points in space outer loop",
          )
        }

        const coSurfaceId = uuidv4()
        const coSurface: GraphBuildingCoSurface = {
          id: coSurfaceId,
          surfaceId: surfaceId,
          directionAToB: directionAToB,
          partnerId: null,
        }

        if (surfaceCoSurfaceMap.has(surfaceId)) {
          const partnerCoSurface = surfaceCoSurfaceMap.get(surfaceId)!
          partnerCoSurface.partnerId = coSurfaceId
          coSurface.partnerId = partnerCoSurface.id
        } else {
          surfaceCoSurfaceMap.set(surfaceId, coSurface)
        }

        return [coSurface]
      })

      const graphBuildingSpaceInnerLoops = space3ds.holes.map((hole) =>
        hole.flatMap((verticeId, i) => {
          if (i === hole.length - 1) {
            return []
          }
          const verticeStepKey = `${verticeId}_${hole[i + 1]}`

          let surfaceId: string
          let directionAToB: boolean
          if (pointsABSurfaceMap.has(verticeStepKey)) {
            surfaceId = pointsABSurfaceMap.get(verticeStepKey)!
            directionAToB = true
          } else if (pointsBASurfaceMap.has(verticeStepKey)) {
            surfaceId = pointsBASurfaceMap.get(verticeStepKey)!
            directionAToB = false
          } else {
            throw new Error(
              "Error generating graphBuilding for 3DS building. No surface found for points in space inner loop",
            )
          }

          const coSurfaceId = uuidv4()
          const coSurface: GraphBuildingCoSurface = {
            id: coSurfaceId,
            surfaceId: surfaceId,
            directionAToB: directionAToB,
            partnerId: null,
          }

          if (surfaceCoSurfaceMap.has(surfaceId)) {
            const partnerCoSurface = surfaceCoSurfaceMap.get(surfaceId)!
            partnerCoSurface.partnerId = coSurfaceId
            coSurface.partnerId = partnerCoSurface.id
          } else {
            surfaceCoSurfaceMap.set(surfaceId, coSurface)
          }

          return [coSurface]
        }),
      )

      return {
        id: space3ds.id,
        outerLoop: graphBuildingSpaceOuterLoop,
        innerLoops: graphBuildingSpaceInnerLoops,
      }
    })

    return {
      height: graphBuildingHeight,
      points: graphBuildingPoints,
      surfaces: graphBuildingSurfaces,
      spaces: graphBuildingSpaces,
    }
  })

  const graphBuilding = {
    units: graphBuildingUnits,
    levels: graphBuildingLevels,
  }

  return graphBuilding
}

const SLANTED_ROOF_TEST_TOLERANCE = 0.01
const SLANTED_WALL_TEST_TOLERANCE = 0.01
const SLANTED_BASE_TEST_TOLERANCE = 0.01

// Returns true if a body is a manifold and is a 2D extrusion of its
// bottom face. Note this only works when we have already checked
// that all the floors and ceiling faces are z down and up and all
// wall faces have z 0.
// THIS IS NOT A GENERAL TEST FOR 2D EXTRUSIONS.
function is2DExtrusionFacesPreviouslyVerified(
  nHistID: number,
  nBodyId: number,
  extrudeMinZ: number,
  extrudeMaxZ: number,
): boolean {
  if (WSM.APIGetObjectTypeReadOnly(nHistID, nBodyId) !== WSM.nBodyType) {
    return false
  }

  if (!WSM.APIIsObjectManifoldReadOnly(nHistID, nBodyId)) {
    return false
  }

  const bodyBox = WSM.APIGetBoxReadOnly(nHistID, nBodyId)
  if (bodyBox.lower.z > extrudeMinZ + WSM_MACHINE_TOL || bodyBox.upper.z < extrudeMaxZ - WSM_MACHINE_TOL) {
    return false
  }

  const bodyVolume = WSM.APIComputeVolumeReadOnly(nHistID, nBodyId)
  if (bodyVolume <= WSM_MACHINE_TOL) {
    return false
  }

  const faceIds = WSM.APIGetObjectsByTypeReadOnly(nHistID, nBodyId, WSM.nObjectType.nFaceType)

  let nTotalBottomFaceArea = 0
  for (let index = 0; index < faceIds.length; index++) {
    const faceBox = WSM.APIGetBoxReadOnly(nHistID, faceIds[index])
    if (faceBox.lower.z < bodyBox.lower.z + WSM_MACHINE_TOL && faceBox.upper.z < bodyBox.lower.z + WSM_MACHINE_TOL) {
      const testPlane = WSM.APIGetFacePlaneReadOnly(nHistID, faceIds[index])
      if (
        Math.abs(testPlane.normal.x) < SLANTED_BASE_TEST_TOLERANCE &&
        Math.abs(testPlane.normal.y) < SLANTED_BASE_TEST_TOLERANCE &&
        Math.abs(testPlane.normal.z + 1) < SLANTED_BASE_TEST_TOLERANCE
      ) {
        nTotalBottomFaceArea += WSM.APIComputeAreaReadOnly(nHistID, faceIds[index])
      }
    }
  }

  const volumeAsExtrude = nTotalBottomFaceArea * (bodyBox.upper.z - bodyBox.lower.z)
  if (Math.abs(bodyVolume - volumeAsExtrude) > 0.001 * bodyVolume) {
    return false
  }

  return true
}

export function getWSMGeo25DApproximations(
  wsmGeo: WSMGeometryData,
  indexToRefHistoryIdArray: number[],
): {
  isSlantedRoofs: boolean
  isSlantedWalls: boolean
  isSlantedBases: boolean
  is2DExtrusions: boolean
} {
  let isSlantedRoofs = false
  let isSlantedWalls = false
  let isSlantedBases = false

  const positions = wsmGeo.position
  const normals = wsmGeo.normal

  const areZNormalsSuggestingARoof = (triangleZNormals: [number, number, number]) =>
    triangleZNormals[0] > ROOF_NORMAL_TOLERANCE &&
    triangleZNormals[1] > ROOF_NORMAL_TOLERANCE &&
    triangleZNormals[2] > ROOF_NORMAL_TOLERANCE
  const areZNormalsSuggestingAFloor = (triangleZNormals: [number, number, number]) =>
    triangleZNormals[0] < -FLOOR_NORMAL_TOLERANCE &&
    triangleZNormals[1] < -FLOOR_NORMAL_TOLERANCE &&
    triangleZNormals[2] < -FLOOR_NORMAL_TOLERANCE

  let triangleZNormals: [number, number, number] = [0, 0, 0]
  for (let i = 0; i + 8 < positions.length; i += 9) {
    triangleZNormals = [normals[i + 2], normals[i + 5], normals[i + 8]]

    if (!isSlantedRoofs && areZNormalsSuggestingARoof(triangleZNormals)) {
      if (
        Math.abs(triangleZNormals[0] - 1) > SLANTED_ROOF_TEST_TOLERANCE ||
        Math.abs(triangleZNormals[1] - 1) > SLANTED_ROOF_TEST_TOLERANCE ||
        Math.abs(triangleZNormals[2] - 1) > SLANTED_ROOF_TEST_TOLERANCE
      ) {
        isSlantedRoofs = true
      }
    } else if (!isSlantedBases && areZNormalsSuggestingAFloor(triangleZNormals)) {
      if (
        Math.abs(triangleZNormals[0] + 1) > SLANTED_BASE_TEST_TOLERANCE ||
        Math.abs(triangleZNormals[1] + 1) > SLANTED_BASE_TEST_TOLERANCE ||
        Math.abs(triangleZNormals[2] + 1) > SLANTED_BASE_TEST_TOLERANCE
      ) {
        isSlantedBases = true
      }
    } else if (
      !isSlantedWalls &&
      !areZNormalsSuggestingARoof(triangleZNormals) &&
      !areZNormalsSuggestingAFloor(triangleZNormals)
    ) {
      if (
        Math.abs(triangleZNormals[0]) > SLANTED_WALL_TEST_TOLERANCE ||
        Math.abs(triangleZNormals[1]) > SLANTED_WALL_TEST_TOLERANCE ||
        Math.abs(triangleZNormals[2]) > SLANTED_WALL_TEST_TOLERANCE
      ) {
        isSlantedWalls = true
      }
    }

    if (isSlantedRoofs && isSlantedWalls && isSlantedBases) {
      break
    }
  }

  // Check that all floor volumes are 2D extrusions.
  let is2DExtrusions = false
  if (!isSlantedRoofs && !isSlantedWalls && !isSlantedBases) {
    is2DExtrusions = true
    for (let i = 0; i < indexToRefHistoryIdArray.length; i++) {
      const nHistID = indexToRefHistoryIdArray[i]
      if (nHistID === undefined) {
        is2DExtrusions = false
        break
      }

      const bodyIds = WSM.APIGetAllObjectsByTypeReadOnly(nHistID, WSM.nObjectType.nBodyType)
      if (bodyIds.length === 0) {
        is2DExtrusions = false
        break
      }

      const histBox = WSM.APIGetBoxReadOnly(nHistID)
      for (let j = 0; j < bodyIds.length; j++) {
        if (!is2DExtrusionFacesPreviouslyVerified(nHistID, bodyIds[j], histBox.lower.z, histBox.upper.z)) {
          is2DExtrusions = false
          break
        }
      }

      if (!is2DExtrusions) {
        break
      }
    }
  }

  return { isSlantedRoofs, isSlantedWalls, isSlantedBases, is2DExtrusions }
}
