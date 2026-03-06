import type { BufferGeometry } from "three"
import { computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh"

export function setupAndComputeBoundsTree(geo: BufferGeometry) {
  if (!geo.computeBoundsTree) geo.computeBoundsTree = computeBoundsTree
  if (!geo.disposeBoundsTree) geo.disposeBoundsTree = disposeBoundsTree
  if (!geo.boundsTree) geo.computeBoundsTree()
}
