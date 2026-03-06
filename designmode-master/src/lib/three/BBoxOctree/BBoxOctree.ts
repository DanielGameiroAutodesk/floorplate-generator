import { Octree } from "sparse-octree"
import type { Raycaster } from "three"
import { Box3, Vector3 } from "three"
import { BBoxOctant } from "./BBoxOctant"
import { BBoxData } from "./BBoxData"

function set<T>(bbox: Box3, data: T, octree: BBoxOctree<T>, octant: BBoxOctant<T>, depth: number): boolean {
  let children = octant.children
  let exists = false
  let done = false

  if (!octant.contains(bbox)) return false

  if (children === null) {
    let index = 0

    if (octant.data === null) {
      octant.data = new BBoxData<T>()
    } else {
      for (let i = 0, l = octant.data.bboxes.length; !exists && i < l; ++i) {
        exists = octant.data.bboxes[i].equals(bbox)
        index = i
      }
    }

    if (exists) {
      octant.data.data[index] = data
      done = true
    } else if (octant.data.bboxes.length < octree.maxPoints || depth === octree.maxDepth) {
      octant.data.bboxes.push(bbox.clone())
      octant.data.data.push(data)
      done = true
    } else {
      octant.split()
      octant.redistribute()
      children = octant.children
    }
  }

  if (children !== null) {
    ++depth

    for (let i = 0, l = children.length; !done && i < l; ++i) {
      set(bbox, data, octree, children[i] as BBoxOctant<T>, depth)
    }
    done = true
  }

  return done
}

const hitResult = new Vector3()

export class BBoxOctree<T> extends Octree {
  // Override the inherited root type, consistent with super call.
  declare protected root: BBoxOctant<unknown>

  private readonly _maxBoxes: number
  private readonly _maxDepth: number

  constructor(
    min: Vector3 = new Vector3(-1000, -1000, -1000),
    max: Vector3 = new Vector3(1000, 1000, 5000),
    maxBoxes: number = 16,
    maxDepth: number = 6, //Setting this much deeper than 8 this will cause extremely long octree generation time
  ) {
    super(new BBoxOctant(min, max))
    this._maxBoxes = maxBoxes
    this._maxDepth = maxDepth
  }
  bbox = new Box3()
  paddedBBox = new Box3()
  set(bbox: Box3, data: T) {
    this.bbox.union(bbox)
    const padding = 10
    this.paddedBBox.set(
      new Vector3(this.bbox.min.x - padding, this.bbox.min.y - padding, this.bbox.min.z - padding),
      new Vector3(this.bbox.max.x + padding, this.bbox.max.y + padding, this.bbox.max.z + padding),
    )
    set(bbox, data, this, this.root, 0)
  }

  get maxDepth(): number {
    return this._maxDepth
  }
  get maxPoints(): number {
    return this._maxBoxes
  }
  getIntersectingNodes(raycaster: Raycaster): any[] {
    const hit = raycaster.ray.intersectBox(this.paddedBBox, hitResult)
    if (!hit) return []
    return super.getIntersectingNodes(raycaster)
  }
}
