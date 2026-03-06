export type Vec3 = { x: number; y: number; z: number }

export function calculateTriangleCentroid2d(a: number[], b: number[], c: number[]): [number, number] {
  return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3]
}

function calculateDistance(a: Vec3, b: Vec3) {
  return Math.sqrt(Math.abs(b.x - a.x) + Math.abs(b.y - a.y))
}

function vec3Rounded1DecToString(p: Vec3) {
  return Math.round(p.x * 10) / 10 + "_" + Math.round(p.y * 10) / 10 + "_" + Math.round(p.z * 10) / 10
}

function vec3Floored1DecToString(p: Vec3) {
  return Math.floor(p.x * 10) / 10 + "_" + Math.floor(p.y * 10) / 10 + "_" + Math.floor(p.z * 10) / 10
}

export function getUniquePointsForPolygons(polygons: Vec3[][]): { polygons: number[][]; points: Vec3[] } {
  const uniquePoints: Vec3[] = []
  let newPolygons: number[][] = []

  const roundedPtsMap = new Map<string, number[]>()
  const flooredPtsMap = new Map<string, number[]>()

  for (let poly of polygons) {
    let polygonIndices: number[] = []
    for (let point of poly) {
      const ptRoundedStr = vec3Rounded1DecToString(point)
      const ptFlooredStr = vec3Floored1DecToString(point)
      const nearbyPoints = (roundedPtsMap.get(ptRoundedStr) ?? []).concat(flooredPtsMap.get(ptFlooredStr) ?? [])
      const existing = nearbyPoints.find((i) => calculateDistance(point, uniquePoints[i]) < 1e-2)
      if (existing) {
        polygonIndices.push(existing)
      } else {
        const newIndex = uniquePoints.push(point) - 1
        roundedPtsMap.set(ptRoundedStr, [...(roundedPtsMap.get(ptRoundedStr) ?? []), newIndex])
        flooredPtsMap.set(ptFlooredStr, [...(flooredPtsMap.get(ptFlooredStr) ?? []), newIndex])
        polygonIndices.push(newIndex)
      }
    }
    newPolygons.push(polygonIndices)
  }
  return { points: uniquePoints, polygons: newPolygons }
}

export function duplicateRepeatedPoints(indices: number[], points: [number, number, number][]) {
  const duplicatedPoints: [number, number, number][] = []
  const duplicatedIndices: number[] = []
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]
    duplicatedPoints.push(points[idx])
    duplicatedIndices.push(i)
    // TODO: only duplicate pad vertecies, not exterior boundary vertecies
  }
  return { duplicatedPoints, duplicatedIndices }
}
