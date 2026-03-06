import type { BufferGeometry, Side } from "three"
import { FrontSide, Mesh, MeshLambertMaterial } from "three"
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js"
import { Geometry25D } from "src/lib/three/Geometry25D"

export type Box25D = {
  coordinates: number[][][]
  height: number
  elevation: number
}

function mergeGeometries(geometries: BufferGeometry[]): BufferGeometry | null {
  if (geometries.length === 0) return null
  const newMerged = BufferGeometryUtils.mergeGeometries(geometries)
  return BufferGeometryUtils.mergeVertices(newMerged)
}

export class Box25DVisual extends Mesh {
  constructor(boxes: Box25D[], color: string, opacity = 1, side: Side = FrontSide) {
    super()
    const geometries = boxes.map((box) => {
      return new Geometry25D(box)
    })

    const merged = mergeGeometries(geometries)

    if (!merged) return

    const buildingMaterial = new MeshLambertMaterial({ color, opacity, transparent: opacity !== 1, side })

    const mesh = new Mesh(merged, buildingMaterial)
    mesh.userData.occludesSnapping = true
    return mesh
  }
}
