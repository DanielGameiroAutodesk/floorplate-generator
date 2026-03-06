import earcut from "earcut"
import { BufferAttribute, BufferGeometry } from "three"
import type { Urn } from "@spacemakerai/element-types"
import type { BasicBuildingElement } from "./lib/types"
import { getFloorFootPrintsInBuilding } from "./lib/utils"

export type Volume = {
  coordinates: [number, number][][]
  elevation: number
  height: number
  color: string
}

export function buildRoofForVolume(volume: Volume) {
  const holeIndexes = []
  let index = 0
  for (let i = 0; i < volume.coordinates.length - 1; i++) {
    index += volume.coordinates[i].length
    holeIndexes.push(index)
  }

  const points = volume.coordinates.flat()
  const flatPoints: number[] = points.flat()
  const indices = earcut(flatPoints, holeIndexes)

  let nof = 0
  nof += indices.length

  const pos = new Float32Array(nof * 3)
  const normals = new Float32Array(nof * 3)

  const zHigh = volume.elevation + volume.height
  let idx = 0

  // Roof
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    const point = points[index]
    pos[idx] = point[0]
    pos[idx + 1] = point[1]
    pos[idx + 2] = zHigh
    normals[idx] = 0
    normals[idx + 1] = 0
    normals[idx + 2] = 1
    idx += 3
  }

  return { position: pos, normal: normals, volume }
}

function buildWallsGeometryForVolume(volume: Volume) {
  const holeIndexes = []
  let index = 0
  for (let i = 0; i < volume.coordinates.length - 1; i++) {
    index += volume.coordinates[i].length
    holeIndexes.push(index)
  }

  let nof = 0
  for (let i = 0; i < volume.coordinates.length; i++) {
    nof += volume.coordinates[i].length * 6
  }

  const pos = new Float32Array(nof * 3)
  const normals = new Float32Array(nof * 3)

  const height = volume.height
  const elevation = volume.elevation

  let idx = 0
  // Walls
  for (let j = 0; j < volume.coordinates.length; j++) {
    const polygon = volume.coordinates[j]
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i]
      const p2 = polygon[(i + 1) % polygon.length]
      pos[idx] = p1[0] // bottom left
      pos[idx + 1] = p1[1]
      pos[idx + 2] = elevation
      pos[idx + 3] = p2[0] // bottom right
      pos[idx + 4] = p2[1]
      pos[idx + 5] = elevation
      pos[idx + 6] = p2[0] // top right
      pos[idx + 7] = p2[1]
      pos[idx + 8] = elevation + height
      pos[idx + 9] = p1[0] // bottom left
      pos[idx + 10] = p1[1]
      pos[idx + 11] = elevation
      pos[idx + 12] = p2[0] // top right
      pos[idx + 13] = p2[1]
      pos[idx + 14] = elevation + height
      pos[idx + 15] = p1[0] // top left
      pos[idx + 16] = p1[1]
      pos[idx + 17] = elevation + height

      // Calc normals (cross product)
      const ax = p2[0] - p1[0],
        ay = p2[1] - p1[1],
        az = 0,
        bx = p2[0] - p1[0],
        by = p2[1] - p1[1],
        bz = height
      let nx = ay * bz - az * by,
        ny = az * bx - ax * bz,
        nz = ax * by - ay * bx
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx *= 1 / length
      ny *= 1 / length
      nz *= 1 / length

      // Repeat normals for all 6 vertices
      for (let j = 0; j < 6; j++) {
        normals[idx + j * 3] = nx
        normals[idx + j * 3 + 1] = ny
        normals[idx + j * 3 + 2] = nz
      }
      idx += 18
    }
  }

  return { position: pos, normal: normals, volume }
}

function parseColor(hexColor: string) {
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return new Uint8Array([r, g, b])
}

export function makeColorArray(position: Float32Array, color: string): Uint8Array {
  const colorsL = new Uint8Array(position.length)
  const count = position.length / 3
  let ptr = 0
  const array = parseColor(color)
  for (let i = 0; i < count; i++) {
    colorsL.set(array, ptr + i * 3)
  }
  return colorsL
}

type MeshAttributes = { position: Float32Array; normal: Float32Array }
function mergeMeshAttributes(meshAttributes: MeshAttributes[]): MeshAttributes {
  const size = meshAttributes.reduce((a, v) => a + v.position.length, 0)
  const position = new Float32Array(size)
  const normal = new Float32Array(size)
  let ptr = 0
  for (const roof of meshAttributes) {
    position.set(roof.position, ptr)
    normal.set(roof.normal, ptr)
    ptr += roof.position.length
  }
  return { position, normal }
}

export function makeBuildingHitboxes(element: BasicBuildingElement): Record<Urn, BufferGeometry[]> {
  const building = element.representations.__INTERNAL__.data
  const footprints = getFloorFootPrintsInBuilding(building)
  let cumelevation = 0
  const hitboxes: Record<Urn, BufferGeometry[]> = {}
  const roofs: { position: Float32Array; normal: Float32Array }[] = []
  footprints.forEach((footprint, i) => {
    const floor = building.floors[i]
    const wallsForFloor: { position: Float32Array; normal: Float32Array }[] = []
    footprint.forEach(({ polygon, holes }) => {
      const volume: Volume = {
        coordinates: [
          polygon.map(({ x, y }) => [x, y]),
          ...holes.map((hole) => hole.map(({ x, y }) => [x, y] as [number, number])),
        ],
        elevation: cumelevation,
        height: floor.height,
        color: "#ffffff",
      }
      wallsForFloor.push(buildWallsGeometryForVolume(volume))
      roofs.push(buildRoofForVolume(volume))
    })
    const mergedFloorWalls = mergeMeshAttributes(wallsForFloor)
    const wallsGeo = new BufferGeometry()
    wallsGeo.setAttribute("position", new BufferAttribute(mergedFloorWalls.position, 3))
    wallsGeo.setAttribute("normal", new BufferAttribute(mergedFloorWalls.normal, 3))
    hitboxes[element.children![i].urn] = [wallsGeo]
    cumelevation += floor.height
  })

  const mergedRoof = mergeMeshAttributes(roofs)
  const roofsgeo = new BufferGeometry()
  roofsgeo.setAttribute("position", new BufferAttribute(mergedRoof.position, 3))
  roofsgeo.setAttribute("normal", new BufferAttribute(mergedRoof.normal, 3))
  hitboxes[element.urn] = [roofsgeo]

  return hitboxes
}
