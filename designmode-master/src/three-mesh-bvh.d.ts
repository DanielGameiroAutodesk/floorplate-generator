import type { computeBoundsTree, disposeBoundsTree, MeshBVH } from "three-mesh-bvh"

// Workaround for https://github.com/gkjohnson/three-mesh-bvh/issues/682
declare module "three" {
  export interface BufferGeometry {
    boundsTree?: MeshBVH
    computeBoundsTree: typeof computeBoundsTree
    disposeBoundsTree: typeof disposeBoundsTree
  }
}
