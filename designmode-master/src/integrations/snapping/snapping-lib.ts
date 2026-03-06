import { Vector3 } from "three"

const dir = new Vector3()

export function samplePointsAlongLineXY(
  p1: Vector3,
  p2: Vector3,
  resolution: number,
  sampleMaxDistance: number,
): Vector3[] {
  // Don't sample lines longer than 4km
  if (p1.distanceTo(p2) > sampleMaxDistance) return [p1, p2]

  dir.subVectors(p2, p1).setZ(0)
  const length = dir.length()
  if (length < 2 * resolution) return [p1, p2]

  const numPoints = Math.floor(length / resolution) + 1
  const numPointsRoundedUp = Math.ceil(length / resolution) + 1

  const result = Array(Math.max(0, numPoints))
    .fill(0)
    .map((_, i) => {
      if (i === 0) return p1
      const toAdd = dir.setLength(i * resolution)
      return p1.clone().add(toAdd)
    })

  // Make sure both p1 and p2 is actually included.
  if (numPoints !== numPointsRoundedUp) {
    result.push(p2)
  }

  return result
}

function isEqualVectorXY(a: Vector3, b: Vector3) {
  return a.x === b.x && a.y === b.y
}

export function derivePointsAlongExterior(input: {
  lines: { v1: Vector3; v2: Vector3 }[]
  points: Vector3[]
  sampleMaxDistance: number
}) {
  const linesPoints =
    input.lines.length > 1000
      ? input.lines.flatMap((line) => [line.v1, line.v2])
      : input.lines.flatMap((line) => samplePointsAlongLineXY(line.v1, line.v2, 1, input.sampleMaxDistance))

  return linesPoints.concat(input.points).filter((value, i, array) => {
    return !(i > 0 && isEqualVectorXY(value, array[i - 1]))
  })
}

export function getBottomLinesAndPoints(input: {
  lines: {
    onTerrain?: boolean
    v1: Vector3
    v2: Vector3
  }[]
}) {
  function isApproximatelyEqual(a: number, b: number) {
    return Math.abs(a - b) < 0.000000001
  }

  const minZ = input.lines.reduce((prev, cur) => Math.min(prev, cur.v1.z, cur.v2.z), Infinity)

  let bottomLines = input.lines.filter(
    (line) => line.onTerrain || (isApproximatelyEqual(line.v1.z, minZ) && isApproximatelyEqual(line.v2.z, minZ)),
  )
  let bottomPoints = input.lines.flatMap((line) => [line.v1, line.v2]).filter((v) => isApproximatelyEqual(v.z, minZ))

  return {
    bottomLines,
    bottomPoints,
  }
}

export function getLowestTerrainElevationForPoints(
  points: Vector3[],
  getElevation: (x: number, y: number) => number | undefined,
) {
  const elevations: number[] = []
  for (const point of points) {
    const elevation = getElevation(point.x, point.y)
    if (elevation != null) {
      elevations.push(elevation)
    }
  }
  if (!elevations.length) return
  return elevations.reduce((a, b) => Math.min(a, b), Infinity)
}
