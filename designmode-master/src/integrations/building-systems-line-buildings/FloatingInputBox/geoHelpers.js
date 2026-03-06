export function getAngle(p0, p1, p2) {
  const [x0, y0] = p0
  const [x1, y1] = p1
  const [x2, y2] = p2
  const t = (x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)
  const s = (x1 - x0) * (x2 - x1) + (y1 - y0) * (y2 - y1)
  return Math.atan2(t, s)
}

export function getAngleXY(p0, p1, p2) {
  const { x: x0, y: y0 } = p0
  const { x: x1, y: y1 } = p1
  const { x: x2, y: y2 } = p2
  return getAngle([x0, y0], [x1, y1], [x2, y2])
}
