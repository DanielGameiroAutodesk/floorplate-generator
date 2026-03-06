export type PrepassData = {
  triangles: Float32Array[]
  dim: number
  dimX: number
  dimY: number
  bbox: BBox
}

export type BBox = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }

export function prepass(index: Uint32Array, position: Float32Array, bbox: BBox): PrepassData {
  const w = bbox.max.x - bbox.min.x + 1
  const h = bbox.max.y - bbox.min.y + 1
  const dim = 100
  const dimX = w / dim
  const dimY = h / dim

  const buckets: number[][] = new Array(dim * dim).fill(0).map(() => [])
  for (let tri = 0; tri < index.length / 3; tri++) {
    let minBucketX = Infinity
    let maxBucketX = -Infinity
    let minBucketY = Infinity
    let maxBucketY = -Infinity

    // find bbox of buckets containing point A B C in the triangle
    for (let i = 0; i < 3; i++) {
      const idx = index[tri * 3 + i]
      const bucketX = Math.floor((position[idx * 3] - bbox.min.x) / dimX)
      const bucketY = Math.floor((position[idx * 3 + 1] - bbox.min.y) / dimY)
      minBucketX = Math.min(minBucketX, bucketX)
      minBucketY = Math.min(minBucketY, bucketY)
      maxBucketX = Math.max(maxBucketX, bucketX)
      maxBucketY = Math.max(maxBucketY, bucketY)
    }

    // Add triangle to all relevant buckets
    for (let bx = minBucketX; bx <= maxBucketX; bx++) {
      for (let by = minBucketY; by <= maxBucketY; by++) {
        buckets[dim * by + bx].push(tri)
      }
    }
  }

  // For each bucket, generate pre-computed data per triangle
  const triangles: Float32Array[] = []
  for (const triangleIndices of buckets) {
    const triangledata = new Float32Array(triangleIndices.length * 9)
    for (let i = 0; i < triangleIndices.length; i++) {
      const tri = triangleIndices[i]
      const iA = index[tri * 3]
      const iB = index[tri * 3 + 1]
      const iC = index[tri * 3 + 2]

      const aX = position[iA * 3]
      const aY = position[iA * 3 + 1]
      const aZ = position[iA * 3 + 2]

      const bX = position[iB * 3]
      const bY = position[iB * 3 + 1]
      const bZ = position[iB * 3 + 2]

      const cX = position[iC * 3]
      const cY = position[iC * 3 + 1]
      const cZ = position[iC * 3 + 2]

      // Transform matrix [ a b c d ] from uv to triangle space
      const a = bX - aX
      const b = bY - aY
      const c = cX - aX
      const d = cY - aY

      // Build inverse matrix to get UV=>X and UV=>Y vectors to dot against
      const invDet = 1 / (a * d - b * c)

      triangledata[i * 9] = aX //              x0  base vertex
      triangledata[i * 9 + 1] = aY //          y0  base vertex
      triangledata[i * 9 + 2] = invDet * d //  ux  XY=>U
      triangledata[i * 9 + 3] = -invDet * c // uy  XY=>U
      triangledata[i * 9 + 4] = -invDet * b // vx  XY=>V
      triangledata[i * 9 + 5] = invDet * a //  vy  XY=>V
      triangledata[i * 9 + 6] = aZ //          z0  base vertex
      triangledata[i * 9 + 7] = bZ - aZ //     uz  UV=>Z
      triangledata[i * 9 + 8] = cZ - aZ //     vz  UV=>Z
    }
    triangles.push(triangledata)
  }

  return { triangles, dim, dimX, dimY, bbox }
}

export function raycast(x: number, y: number, prepassData: PrepassData): number {
  const result = raycastOrUndefined(x, y, prepassData)
  if (result == null) {
    return prepassData.bbox.min.z
  }
  return result
}

const epsilon = 1e-6
const onePlusEpsilon = 1 + epsilon
export function raycastOrUndefined(x: number, y: number, prepassData: PrepassData): number | undefined {
  const { dim, dimX, dimY, bbox, triangles } = prepassData
  const bucketX = Math.floor((x - bbox.min.x) / dimX)
  const bucketY = Math.floor((y - bbox.min.y) / dimY)
  const bucket = dim * bucketY + bucketX
  const data = triangles[bucket]
  if (!data) {
    return undefined
  }
  for (let i = 0; i < data.length; i += 9) {
    // base vertex position
    const x0 = data[i]
    const y0 = data[i + 1]
    // triangle -> uv space transform
    const ux = data[i + 2]
    const uy = data[i + 3]
    const vx = data[i + 4]
    const vy = data[i + 5]

    const relX = x - x0
    const relY = y - y0
    const u = relX * ux + relY * uy
    const v = relX * vx + relY * vy
    const inside = u >= -epsilon && v >= -epsilon && u + v <= onePlusEpsilon

    if (inside) {
      const z0 = data[i + 6]
      const uz = data[i + 7]
      const vz = data[i + 8]
      return z0 + uz * u + vz * v
    }
  }
  return undefined
}
