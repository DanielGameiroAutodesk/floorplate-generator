import type { BufferGeometry } from "three"

/**
 * Addresses bug in rendering on MacOs + AMD
 * https://monorail-prod.appspot.com/p/chromium/issues/detail?id=1245448
 */

export function toPerformantNonIndexed(geometry: BufferGeometry): BufferGeometry {
  if (geometry.getIndex()) {
    geometry.toNonIndexed()
  }
  let nofVertices = geometry.getAttribute("position").count
  let index: number[] = new Array(nofVertices)
  for (let i = 0; i < nofVertices; i++) {
    index[i] = i
  }

  geometry.setIndex(index)
  return geometry
}
