import { Octant } from "sparse-octree"
import type { Vector3 } from "three"
import { Box3 } from "three"
import { BBoxData } from "./BBoxData"

const tempBbox = new Box3()
export class BBoxOctant<T> extends Octant<BBoxData<T>> {
  constructor(min: Vector3, max: Vector3) {
    super(min, max)
  }

  contains(bbox: Box3): boolean {
    tempBbox.set(this.min, this.max)
    return tempBbox.containsBox(bbox) || tempBbox.intersectsBox(bbox)
  }

  redistribute(): void {
    const children: BBoxOctant<T>[] | null = this.children as BBoxOctant<T>[]
    const bboxData: BBoxData<T> = (this.data as BBoxData<T>) || null

    if (children !== null && bboxData !== null) {
      const bboxes = bboxData.bboxes
      const data = bboxData.data

      for (let i = 0, il = bboxes.length; i < il; ++i) {
        const bbox = bboxes[i]
        const entry = data[i]
        for (let j = 0, jl = children.length; j < jl; ++j) {
          const child = children[j]

          if (child.contains(bbox)) {
            if (child.data === null) {
              child.data = new BBoxData<T>()
            }

            const childData: BBoxData<T> = child.data
            childData.bboxes.push(bbox)
            childData.data.push(entry)
          }
        }
      }

      this.data = null
    }
  }
}
