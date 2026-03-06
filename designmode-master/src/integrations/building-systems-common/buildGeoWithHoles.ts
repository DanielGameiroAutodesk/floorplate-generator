import earcut from "earcut"
import type { Color } from "three"
import { BufferAttribute, BufferGeometry } from "three"

import { setGeometryColor } from "src/lib/three/geometryUtils"

export type Volume = {
  coordinates: [number, number][][]
  elevation: number
  height: number
}
function sumList(values: number[]) {
  return values.reduce((sum, value) => {
    return sum + value
  }, 0)
}
function Float32Concat(listOfArrays: Float32Array[]) {
  const lengths = listOfArrays.map((array) => array.length)
  const sumLength = sumList(lengths)
  const result = new Float32Array(sumLength)

  let shift = 0
  for (let i = 0; i < listOfArrays.length; i++) {
    const array = listOfArrays[i]
    result.set(array, shift)
    shift += lengths[i]
  }
  return result
}

export function buildGeometryForVolumes(volumes: Volume[]) {
  const positionList: Float32Array[] = []
  const normalList: Float32Array[] = []
  volumes.forEach((volume) => {
    const { position, normal } = buildGeometryForVolume(volume)
    positionList.push(position)
    normalList.push(normal)
  })
  const position = Float32Concat(positionList)
  const normal = Float32Concat(normalList)
  return { position, normal }
}

export function buildGeometryForVolume(volume: Volume) {
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
  nof += indices.length * 2
  for (let i = 0; i < volume.coordinates.length; i++) {
    nof += volume.coordinates[i].length * 6
  }

  const pos = new Float32Array(nof * 3)
  const normals = new Float32Array(nof * 3)

  const zLow = volume.elevation
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

  // Floor
  for (let i = indices.length - 1; i >= 0; i--) {
    const index = indices[i]
    pos[idx] = points[index][0]
    pos[idx + 1] = points[index][1]
    pos[idx + 2] = zLow
    normals[idx] = 0
    normals[idx + 1] = 0
    normals[idx + 2] = -1
    idx += 3
  }

  const height = volume.height
  const elevation = volume.elevation

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

export function buildRoofGeometryAttributesHoles(volume: Volume) {
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

  return { position: pos, normal: normals }
}

export function buildWallsGeometryAttributesHoles(volume: Volume) {
  let nof = 0
  for (let i = 0; i < volume.coordinates.length; i++) {
    nof += volume.coordinates[i].length * 18
  }

  const pos = new Float32Array(nof)
  const normals = new Float32Array(nof)

  let idx = 0

  const height = volume.height
  const elevation = volume.elevation

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

  return { position: pos, normal: normals }
}

export function buildGeoFromBlockWithHole(block: {
  elevation: number
  coordinates: [number, number][][]
  height: number
  color: Color
}) {
  const geometry = buildGeometryForVolume(block)
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(geometry.position, 3))
  geo.setAttribute("normal", new BufferAttribute(geometry.normal, 3, false))
  setGeometryColor(block.color, geo)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}
