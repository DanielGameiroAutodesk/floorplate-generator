import type { BufferGeometry } from "three"
import { BufferAttribute } from "three"

import type { TerrainElement } from "./terrain-types"

function removeDuplicates(geometry: BufferGeometry) {
  const pos = geometry.attributes.position.array as Float32Array
  const uvs = geometry.attributes.uv.array as Float32Array
  const firstSeen: { [key: string]: number } = {}
  const newindex = new Uint32Array(pos.length / 3)
  const keep = new Uint8Array(pos.length / 3)
  let duplicateSoFar = 0

  for (let i = 0; i < pos.length / 3; i++) {
    const x = pos[i * 3]
    const y = pos[i * 3 + 1]
    const z = pos[i * 3 + 2]
    const key = `${Math.round(x * 100)}_${Math.round(y * 100)}_${Math.round(z * 100)}`
    const fs = firstSeen[key]
    if (fs !== undefined) {
      duplicateSoFar++
      newindex[i] = fs
      keep[i] = 0
    } else {
      firstSeen[key] = i - duplicateSoFar
      newindex[i] = i - duplicateSoFar
      keep[i] = 1
    }
  }

  if (duplicateSoFar > 0) {
    console.log(
      `Removing ${duplicateSoFar} (${Math.round(
        (duplicateSoFar / (pos.length / 3)) * 100,
      )}%) duplicate vertices from the terrain`,
    )
  }

  const newpositions = new Float32Array(pos.length - duplicateSoFar * 3)
  const newuvs = new Float32Array(uvs.length - duplicateSoFar * 2)
  for (let i = 0; i < pos.length / 3; i++) {
    if (!keep[i]) continue
    const ni = newindex[i]
    newpositions[ni * 3] = pos[i * 3]
    newpositions[ni * 3 + 1] = pos[i * 3 + 1]
    newpositions[ni * 3 + 2] = pos[i * 3 + 2]
    newuvs[ni * 2] = uvs[i * 2]
    newuvs[ni * 2 + 1] = uvs[i * 2 + 1]
  }
  geometry.setAttribute("position", new BufferAttribute(newpositions, 3))
  geometry.setAttribute("uv", new BufferAttribute(newuvs, 2))
  let index = geometry.index!.array as Uint32Array | Uint16Array
  if (index instanceof Uint16Array) {
    index = new Uint32Array(index)
  }

  for (let i = 0; i < index.length; i++) {
    index[i] = newindex[index[i]]
  }
  geometry.setIndex(new BufferAttribute(index, 1))
  geometry.computeVertexNormals()
}

function recalculateUVs(position: Float32Array, refPoint: [number, number], bboxLocal: [number, number][]) {
  const offset_x = refPoint[0] - bboxLocal[0][0]
  const offset_y = refPoint[1] - bboxLocal[0][1]
  const width = bboxLocal[1][0] - bboxLocal[0][0]
  const height = bboxLocal[1][1] - bboxLocal[0][1]

  const newUvs = new Array((2 * position.length) / 3)
  for (let i = 0; i < position.length / 3; i++) {
    newUvs[2 * i] = (position[3 * i] + offset_x) / width
    newUvs[2 * i + 1] = 1 - (position[3 * i + 1] + offset_y) / height
  }
  return new Float32Array(newUvs)
}

export function repair(element: TerrainElement, geometry: BufferGeometry) {
  removeDuplicates(geometry)
  geometry.rotateX(Math.PI / 2)
  const uvs = recalculateUVs(
    geometry.attributes.position.array as Float32Array,
    element.properties.geoReference.refPoint,
    element.properties.bbox,
  )
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
}

export function needsRepair(element: TerrainElement) {
  return (
    !element.metadata?.createdAt || new Date(element.metadata?.createdAt).getTime() < new Date("2023-03-01").getTime()
  )
}
