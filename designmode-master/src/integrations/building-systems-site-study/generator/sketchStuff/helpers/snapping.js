function _dot(v1, v2) {
  return v1[0] * v2[0] + v1[1] * v2[1]
}

export function pointsOnLine(p0, p1, all_points, snapDistance = 0.05) {
  const xmin = Math.min(p0[0], p1[0]) - snapDistance,
    xmax = Math.max(p0[0], p1[0]) + snapDistance,
    ymin = Math.min(p0[1], p1[1]) - snapDistance,
    ymax = Math.max(p0[1], p1[1]) + snapDistance

  const s_vec = [p1[0] - p0[0], p1[1] - p0[1]],
    t_vec = [s_vec[1], -s_vec[0]]
  const t_base = _dot(t_vec, p0),
    s_min = _dot(s_vec, p0),
    s_max = _dot(s_vec, p1),
    t_length = Math.pow(Math.pow(t_vec[0], 2) + Math.pow(t_vec[1], 2), 0.5),
    t_max = snapDistance * t_length

  const sorted_points_on_line = []
  all_points.forEach((point) => {
    if (xmin <= point[0] && point[0] <= xmax && ymin <= point[1] && point[1] <= ymax) {
      const s_val = _dot(point, s_vec),
        t_val = _dot(point, t_vec) - t_base
      if (Math.abs(t_val) < t_max && s_min < s_val && s_val < s_max) {
        let insertIndex = 0
        for (let i = 0; i < sorted_points_on_line.length; i++) {
          if (s_val > _dot(sorted_points_on_line[i], s_vec)) insertIndex++
          else break
        }
        sorted_points_on_line.splice(insertIndex, 0, point)
      }
    }
  })

  return sorted_points_on_line
}

export function snapPointsMutable(points, snappingDistance) {
  const nPoints = points.length
  points.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]))
  let k = 1
  for (let i = 0; i < nPoints - 1; i++) {
    const p1 = points[i]
    for (let j = k; j < nPoints - 1; j++) {
      const p2 = points[j]
      if (p2[0] > p1[0] + snappingDistance) {
        break
      }
      if (p2[0] < p1[0] - snappingDistance) {
        k = j
        continue
      }
      if ((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2 < snappingDistance ** 2) {
        p1[0] = p2[0]
        p1[1] = p2[1]
      }
    }
  }
}

export function clipLoops(_poly) {
  let poly = JSON.parse(JSON.stringify(_poly))
  const loops = []
  while (
    poly.map(JSON.stringify).some((p, i, l) => {
      const firstOccurrenceIndex = l.indexOf(p)
      if (firstOccurrenceIndex !== i) {
        loops.push(poly.splice(firstOccurrenceIndex, i - firstOccurrenceIndex))
        return true
      }
      return false
    })
    // eslint-disable-next-line
  ) {}
  if (poly.length > 2) loops.push(poly)
  return loops
}
