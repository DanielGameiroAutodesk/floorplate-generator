export type BBox = [[number, number], [number, number]]

export function isPointInBBox(x: number, y: number, [[xmin, ymin], [xmax, ymax]]: BBox) {
  return x >= xmin && x <= xmax && y >= ymin && y <= ymax
}

type Vec2 = [number, number]

// adapted from https://stackoverflow.com/questions/3746274/line-intersection-with-aabb-rectangle
export function doesSegmentIntersectBBox(segment_a: Vec2, segment_b: Vec2, [[xmin, ymin], [xmax, ymax]]: BBox) {
  const ab = [segment_b[0] - segment_a[0], segment_b[1] - segment_a[1]]
  const bb = [xmax - xmin, ymax - ymin]
  const abDotBbPerp = ab[0] * bb[1] - ab[1] * bb[0]

  // if ab dot bb == 0, it means the lines are parallel so have infinite intersection points
  if (abDotBbPerp === 0) return false

  const cb = [xmin - segment_a[0], ymin - segment_a[1]]
  const t = (cb[0] * bb[1] - cb[1] * bb[0]) / abDotBbPerp
  if (t < 0 || t > 1) return false

  const u = (cb[0] * ab[1] - cb[1] * ab[0]) / abDotBbPerp
  if (u < 0 || u > 1) return false

  return true
}
