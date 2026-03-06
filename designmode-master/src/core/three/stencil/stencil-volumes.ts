import { BufferGeometry, BufferAttribute, Color } from "three"
import { generateColorArray } from "src/lib/three/geometryUtils"
import type { MultiRingPolygon } from "forma-elements"
import earcut, { flatten } from "earcut"

export type StencilVolume = {
  position: Float32Array
  color: string
  opacity?: number
}

export type TerrainExtents = {
  lowestElevation: number
  highestElevation: number
}

export function getStencilVolumeForPolygon(
  polygon: MultiRingPolygon,
  terrainExtents: TerrainExtents,
  color: string,
  opacity?: number,
): StencilVolume {
  const position = buildVolume(polygon, terrainExtents)
  return { position, color, opacity }
}

export function mergeStencilVolumesByColorAndOpacity(stencilVolumes: StencilVolume[]): StencilVolume[] {
  const groups: Record<string, StencilVolume[]> = {}
  stencilVolumes.forEach((stencilVolume) => {
    const key = `${stencilVolume.color}-${stencilVolume.opacity}`
    if (!groups[key]) groups[key] = []
    groups[key].push(stencilVolume)
  })
  return Object.values(groups).map((stencilVolumesInGroup) => {
    const position = mergeFloat32Arrays(stencilVolumesInGroup.map((sv) => sv.position))
    const color = stencilVolumesInGroup[0].color
    const opacity = stencilVolumesInGroup[0].opacity
    return { position, color, opacity }
  })
}

export function getGeometryForStencilVolume(stencilVolume: StencilVolume): BufferGeometry {
  const { position, color, opacity } = stencilVolume
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(position, 3))
  const colors = generateColorArray(new Color(color), position.length / 3, opacity)
  geometry.setAttribute("color", new BufferAttribute(colors, opacity === undefined ? 3 : 4, true))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function mergeFloat32Arrays(arrays: Float32Array[]): Float32Array {
  const len = arrays.reduce((acc, arr) => {
    acc += arr.length
    return acc
  }, 0)
  const result = new Float32Array(len)
  let currentIndex = 0
  arrays.forEach((arr) => {
    result.set(arr, currentIndex)
    currentIndex += arr.length
  })
  return result
}

function buildVolume(polygon: MultiRingPolygon, terrainExtents: TerrainExtents): Float32Array {
  const zLow = terrainExtents.lowestElevation - 10
  const zHigh = terrainExtents.highestElevation + 10

  const points = polygon.flat()
  const earcutData = flatten(polygon)
  const indices = earcut(earcutData.vertices, earcutData.holes, earcutData.dimensions)

  let nof = 0
  nof += indices.length * 2
  for (let i = 0; i < polygon.length; i++) {
    nof += polygon[i].length * 6
  }

  const pos = new Float32Array(nof * 3)
  let idx = 0

  // Roof
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    const point = points[index]
    pos[idx] = point[0]
    pos[idx + 1] = point[1]
    pos[idx + 2] = zHigh
    idx += 3
  }

  // Floor
  for (let i = indices.length - 1; i >= 0; i--) {
    const index = indices[i]
    pos[idx] = points[index][0]
    pos[idx + 1] = points[index][1]
    pos[idx + 2] = zLow
    idx += 3
  }

  // Walls
  for (let j = 0; j < polygon.length; j++) {
    const ring = polygon[j]
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i]
      const p2 = ring[(i + 1) % ring.length]
      pos[idx] = p1[0] // bottom left
      pos[idx + 1] = p1[1]
      pos[idx + 2] = zLow
      pos[idx + 3] = p2[0] // bottom right
      pos[idx + 4] = p2[1]
      pos[idx + 5] = zLow
      pos[idx + 6] = p2[0] // top right
      pos[idx + 7] = p2[1]
      pos[idx + 8] = zHigh
      pos[idx + 9] = p1[0] // bottom left
      pos[idx + 10] = p1[1]
      pos[idx + 11] = zLow
      pos[idx + 12] = p2[0] // top right
      pos[idx + 13] = p2[1]
      pos[idx + 14] = zHigh
      pos[idx + 15] = p1[0] // top left
      pos[idx + 16] = p1[1]
      pos[idx + 17] = zHigh

      idx += 18
    }
  }

  return pos
}
