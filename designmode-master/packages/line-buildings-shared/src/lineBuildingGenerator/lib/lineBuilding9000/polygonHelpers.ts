type PointXY = { x: number; y: number }
type PolygonXY = PointXY[]

export function isClockwise(poly: PolygonXY) {
  const sum = poly.reduce(
    (acc, p, i) => acc + (poly[(i + 1) % poly.length].x - p.x) * (poly[(i + 1) % poly.length].y + p.y),
    0,
  )
  return sum > 0
}

function reversePolygon(polygon: PolygonXY) {
  let reversedPolygon: PolygonXY = []
  for (let i = 0; i < polygon.length; i++) {
    reversedPolygon.push(polygon[polygon.length - i - 1])
  }
  return reversedPolygon
}

export function getCCWPolygon(polygon: PolygonXY) {
  if (isClockwise(polygon)) {
    return reversePolygon(polygon)
  } else {
    return polygon
  }
}

export function getCWPolygon(polygon: PolygonXY) {
  if (isClockwise(polygon)) {
    return polygon
  } else {
    return reversePolygon(polygon)
  }
}
