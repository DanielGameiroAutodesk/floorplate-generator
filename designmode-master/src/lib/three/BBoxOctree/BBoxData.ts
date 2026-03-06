import type { Box3 } from "three"

export class BBoxData<T> {
  public bboxes: Box3[] = []

  public data: T[] = []
}
