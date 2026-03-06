import { Group, Mesh } from "three"
import type { Renderable } from "./renderable"
import { RenderingSpecs } from "./renderable"
import { toPerformantNonIndexed } from "./toPerformantNonIndexed"

export function groupFrom2dRenderables(batch: Renderable[]): Group {
  let z = 10 // some z above merged renderables
  const group = new Group()
  // assume first in list is newest, so traverse backwards to get the newest on top
  for (let i = batch.length - 1; i >= 0; i--) {
    const r = batch[i]
    const mesh = new Mesh(toPerformantNonIndexed(r.geometry.clone()), RenderingSpecs[r.spec].material.normal)
    mesh.position.setZ(z++)
    mesh.userData = { path: r.id, id: r.id }
    group.add(mesh)
  }
  return group
}
