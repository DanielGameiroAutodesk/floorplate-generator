// Copied from https://github.com/rowanwins/smallest-enclosing-circle on commit 90b932b310c3113fff7808c5611cbdb26fca2016
// Licence MIT

function getMassCentreCircle(points: Point[]) {
  const [avgX, avgY] = points.reduce(
    (acc, { x, y }, i, l) => {
      acc[0] += x / l.length
      acc[1] += y / l.length
      return acc
    },
    [0, 0],
  )
  const radius = points.reduce((acc, { x, y }) => {
    const r = Math.sqrt(Math.pow(x - avgX, 2) + Math.pow(y - avgY, 2))
    return Math.max(acc, r)
  }, 0)
  return { r: radius, x: avgX, y: avgY }
}

function convexHull(points: Point[]) {
  points.sort(function (a, b) {
    return a.x != b.x ? a.x - b.x : a.y - b.y
  })

  const n = points.length
  const hull: Point[] = []

  for (let i = 0; i < 2 * n; i++) {
    const j = i < n ? i : 2 * n - 1 - i
    while (hull.length >= 2 && removeMiddle(hull[hull.length - 2], hull[hull.length - 1], points[j])) hull.pop()
    hull.push(points[j])
  }

  hull.pop()
  return hull
}

function removeMiddle(a: Point, b: Point, c: Point) {
  const cross = (a.x - b.x) * (c.y - b.y) - (a.y - b.y) * (c.x - b.x)
  const dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)
  return cross < 0 || (cross == 0 && dot <= 0)
}

type Point = { x: number; y: number }

export default function wetzls(points: Point[]): {
  x: number
  y: number
  r: number
} {
  const unique = Object.values(
    points.reduce(
      (acc, p) => {
        acc[`${p.x.toFixed(3)},${p.y.toFixed(3)}`] = p
        return acc
      },
      {} as { [k: string]: Point },
    ),
  )
  const hull = convexHull(unique)
  try {
    return mec(hull, hull.length, [], 0)
  } catch (error) {
    console.warn("Error in wetzls: ", error)
    return getMassCentreCircle(hull)
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function shuffle(a: any[]) {
  let j, x, i
  for (i = a.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1))
    x = a[i]
    a[i] = a[j]
    a[j] = x
  }
  return a
}

function mec(points: any, n: any, boundary: any, b: any): any {
  let localCircle = null

  if (b === 3) localCircle = calcCircle3(boundary[0], boundary[1], boundary[2])
  else if (n === 1 && b === 0) localCircle = { x: points[0].x, y: points[0].y, r: 0 }
  else if (n === 0 && b === 2) localCircle = calcCircle2(boundary[0], boundary[1])
  else if (n === 1 && b === 1) localCircle = calcCircle2(boundary[0], points[0])
  else {
    localCircle = mec(points, n - 1, boundary, b)
    if (!isInCircle(points[n - 1], localCircle)) {
      boundary[b++] = points[n - 1]
      localCircle = mec(points, n - 1, boundary, b)
    }
  }

  return localCircle
}

function calcCircle3(p1: any, p2: any, p3: any) {
  const p1x = p1.x,
    p1y = p1.y,
    p2x = p2.x,
    p2y = p2.y,
    p3x = p3.x,
    p3y = p3.y,
    a = p2x - p1x,
    b = p2y - p1y,
    c = p3x - p1x,
    d = p3y - p1y,
    e = a * (p2x + p1x) * 0.5 + b * (p2y + p1y) * 0.5,
    f = c * (p3x + p1x) * 0.5 + d * (p3y + p1y) * 0.5,
    det = a * d - b * c,
    cx = (d * e - b * f) / det,
    cy = (-c * e + a * f) / det

  return { x: cx, y: cy, r: Math.sqrt((p1x - cx) * (p1x - cx) + (p1y - cy) * (p1y - cy)) }
}

function calcCircle2(p1: any, p2: any) {
  const p1x = p1.x,
    p1y = p1.y,
    p2x = p2.x,
    p2y = p2.y,
    cx = 0.5 * (p1x + p2x),
    cy = 0.5 * (p1y + p2y)

  return { x: cx, y: cy, r: Math.sqrt((p1x - cx) * (p1x - cx) + (p1y - cy) * (p1y - cy)) }
}

function isInCircle(p: any, c: any) {
  return (c.x - p.x) * (c.x - p.x) + (c.y - p.y) * (c.y - p.y) <= c.r * c.r
}
