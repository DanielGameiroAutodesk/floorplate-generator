import type { Box3, Color } from "three"
import { BufferAttribute, BufferGeometry, EdgesGeometry, Matrix4, Vector2, Vector3 } from "three"
import type { Transform as Trans } from "@spacemakerai/element-types"

export function samePoint(v1: Vector3, v2: Vector3, epsilon = 0.01) {
  return v1.distanceTo(v2) < epsilon
}

export namespace GeometryConstants {
  export const UP = Object.freeze(new Vector3(0, 0, 1))
  export const IDENTITY = Object.freeze(new Matrix4())
  export const IDENTITY_TRANSFORM: Trans = Object.freeze(IDENTITY.toArray()) as Trans
}

const p1 = new Vector2()
const p2 = new Vector2()
const p3 = new Vector2()

export function getAngleInRadians(pivotVec: Vector3, startVec: Vector3, endVec: Vector3) {
  p1.set(pivotVec.x, pivotVec.y)
  p2.set(startVec.x, startVec.y)
  p3.set(endVec.x, endVec.y)
  const v1 = p2.clone().sub(p1).normalize()
  const v2 = p3.clone().sub(p1).normalize()
  const a = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))))
  const sign = Math.sign(v2.dot(new Vector2(v1.y, -v1.x)))

  return a * sign
}

export function generateColorArray(color: Color, vertexCount: number, alpha?: number) {
  const array = new Uint8Array(
    alpha === undefined
      ? [color.r * 255, color.g * 255, color.b * 255]
      : [color.r * 255, color.g * 255, color.b * 255, alpha * 255],
  )
  const size = alpha === undefined ? 3 : 4
  const colors = new Uint8Array(vertexCount * size)
  for (let i = 0; i < vertexCount; i++) {
    colors.set(array, i * size)
  }
  return colors
}

/**
 * Sets the vertex color of all vertices of a geometry
 * @param color
 * @param geo
 * @param alpha
 */
export function setGeometryColor(color: Color, geo: BufferGeometry, alpha?: number) {
  const position = geo.getAttribute("position")
  const colors = generateColorArray(color, position.count, alpha)
  geo.setAttribute("color", new BufferAttribute(colors, alpha === undefined ? 3 : 4, true))
  return geo
}

export function edgesPositionFromBox3(bbox: Box3 | null) {
  if (!bbox) return new Float32Array([])

  const square = [
    [bbox.min.x, bbox.min.y],
    [bbox.max.x, bbox.min.y],
    [bbox.max.x, bbox.max.y],
    [bbox.min.x, bbox.max.y],
  ]

  let idx = 0
  const n = 4 * 6 * 3
  const positions = new Float32Array(n)

  square.forEach((p, i, l) => {
    const pNext = l[(i + 1) % l.length]

    // vertical
    positions[idx++] = p[0]
    positions[idx++] = p[1]
    positions[idx++] = bbox.min.z
    positions[idx++] = p[0]
    positions[idx++] = p[1]
    positions[idx++] = bbox.max.z
    // floor
    positions[idx++] = p[0]
    positions[idx++] = p[1]
    positions[idx++] = bbox.min.z
    positions[idx++] = pNext[0]
    positions[idx++] = pNext[1]
    positions[idx++] = bbox.min.z
    // roof
    positions[idx++] = p[0]
    positions[idx++] = p[1]
    positions[idx++] = bbox.max.z
    positions[idx++] = pNext[0]
    positions[idx++] = pNext[1]
    positions[idx++] = bbox.max.z
  })

  return positions
}

// This is a WeakMap to allow BufferGeometry to be garbage collected (which will also GC the corresponding Float32Array)
const _edgeCache = new WeakMap<BufferGeometry, Float32Array>()
const IDENTITY = new Matrix4()

export const OUTLINES_MAX_THRESHOLD = 600_000

export function calculateEdgesGeometry(geometry: BufferGeometry, transform = IDENTITY): Float32Array | undefined {
  let edgeGeo: BufferGeometry
  const cached = _edgeCache.get(geometry)
  if (cached) {
    edgeGeo = new BufferGeometry()
    edgeGeo.setAttribute("position", new BufferAttribute(new Float32Array(cached), 3))
  } else {
    if (geometry.attributes.position.count > OUTLINES_MAX_THRESHOLD) return undefined

    edgeGeo = new EdgesGeometry(geometry)
    _edgeCache.set(geometry, new Float32Array(edgeGeo.attributes.position.array as Float32Array))
  }
  if (transform !== IDENTITY) edgeGeo.applyMatrix4(transform)
  return edgeGeo.attributes.position.array as Float32Array
}

export function applyTransform(globalParentMatrix: Matrix4, currentChildMatrix: Matrix4, transform: Matrix4): Matrix4 {
  const globalParentMatrixInverse = globalParentMatrix.clone().invert()
  return globalParentMatrixInverse.multiply(transform).multiply(globalParentMatrix).multiply(currentChildMatrix)
}
