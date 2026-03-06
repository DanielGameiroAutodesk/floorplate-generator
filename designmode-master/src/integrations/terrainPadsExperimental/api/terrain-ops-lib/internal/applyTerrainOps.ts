import type { TerrainOperation, TerrainElement } from "src/core/terrain/terrain-types"
import { Raycaster, type BufferGeometry, Mesh, type Vector3 } from "three"
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh"
import { type MeshedPad, operationsToMeshedPads, filterOverlappingPadSegments } from "./createMeshesFromOperations"
import { createUpdatedGeometry } from "./terrainWorkerV2"

const raycaster = new Raycaster()

function preprocessGeometry(geometry: BufferGeometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox()
  if (!geometry.boundsTree) {
    geometry.computeBoundsTree = computeBoundsTree
    geometry.disposeBoundsTree = disposeBoundsTree
    geometry.computeBoundsTree()
  }
}

function computeTerrainData(geometry: BufferGeometry) {
  setTimeout(() => {
    geometry.computeBoundsTree = computeBoundsTree
    geometry.disposeBoundsTree = disposeBoundsTree
    geometry.computeBoundsTree()
  })
}

type XY = { x: number; y: number }
type PolygonXY = XY[]

function uniqueCoordHashes(coords: PolygonXY): Set<string> {
  const coordHash = (coord: XY) => `${coord.x.toFixed(3)},${coord.y.toFixed(3)}`
  return new Set(coords.map(coordHash))
}

function equalElevationAndCoords(op1: TerrainOperation, op2: TerrainOperation): boolean {
  if (op1.elevation != op2.elevation) return false

  const op1UniqueCoords = uniqueCoordHashes(op1.coordinates)
  const op2UniqueCoords = uniqueCoordHashes(op2.coordinates)

  if (op1UniqueCoords.size !== op2UniqueCoords.size) return false
  return [...op1UniqueCoords].every((coord) => op2UniqueCoords.has(coord))
}

function filterDuplicates(terrainOperations: TerrainOperation[]): TerrainOperation[] {
  return terrainOperations.filter(
    (op, index, self) => self.findIndex((otherOp) => equalElevationAndCoords(op, otherOp)) === index,
  )
}

function applyPads(
  initTerrainGeometry: BufferGeometry,
  meshedPads: MeshedPad[],
  polygonsWithElevations: { x: number; y: number; z: number }[][],
  mesh: Mesh,
  terrainElementProps: TerrainElement["properties"],
) {
  const terrainBbox = initTerrainGeometry.boundingBox!
  const bvh = initTerrainGeometry.boundsTree!

  const baseGeoPositions = initTerrainGeometry.getAttribute("position").array as Float32Array
  const baseGeoNormals = initTerrainGeometry.getAttribute("normal").array as Float32Array
  const baseGeoIndicies = initTerrainGeometry.index!.array as Uint32Array
  const outerCoords = meshedPads.map((op) => op.coordinates[0])

  const initRaycastMesh = new Mesh(initTerrainGeometry)
  initRaycastMesh.raycast = acceleratedRaycast
  const intersectInitGeometry = (origin: Vector3, direction: Vector3) => {
    raycaster.set(origin, direction)
    const intersects = raycaster.intersectObject(initRaycastMesh, true)
    return intersects
  }

  const newGeometry = createUpdatedGeometry(
    baseGeoIndicies,
    baseGeoPositions,
    baseGeoNormals,
    outerCoords,
    terrainBbox,
    bvh,
    polygonsWithElevations,
    terrainElementProps,
    intersectInitGeometry,
  )
  const newMesh = mesh.clone()
  newMesh.geometry = newGeometry
  return newMesh
}

export function applyTerrainPads(
  terrainOperations: TerrainOperation[],
  initTerrainGeometry: BufferGeometry,
  mesh: Mesh,
  terrainElementProps: TerrainElement["properties"],
) {
  preprocessGeometry(initTerrainGeometry)

  const uniqueTerrainOperations = filterDuplicates(terrainOperations)
  const terrainOperationsReversed = [...uniqueTerrainOperations].reverse()
  const meshedPads = operationsToMeshedPads(terrainOperationsReversed, initTerrainGeometry)
  const polygonsWithElevations = filterOverlappingPadSegments(meshedPads)

  const newMesh = applyPads(initTerrainGeometry, meshedPads, polygonsWithElevations, mesh, terrainElementProps)

  computeTerrainData(newMesh.geometry)

  return { mesh: newMesh }
}
