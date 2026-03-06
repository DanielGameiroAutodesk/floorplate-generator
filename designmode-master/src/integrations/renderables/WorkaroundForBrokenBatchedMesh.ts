import { BufferAttribute, Group, LineSegments, Matrix3, Mesh, Sphere, Vector3, BufferGeometry } from "three"
import type { RenderingMode, RenderingSpec } from "./renderable"
import { RenderingSpecs } from "./renderable"
import type { GeometryUuid, UniqueGeometry } from "./BatchedMeshForRenderables"

type MergedAttributeSpec = {
  name: string
  size: number
  type: typeof Float32Array | typeof Uint8Array
  normalized?: boolean
}

/**
 * Hacked-together workaround for broken BatchedMesh in Chrome 139 on Mac,
 * see https://spacemakercore.slack.com/archives/CQ8JCGUN5/p1754922995813189
 */
export class WorkaroundForBrokenBatchedMesh extends Group {
  private renderingSpec: RenderingSpec
  private renderingMode: RenderingMode

  private mergedObject: Mesh | LineSegments | undefined

  // Change detection state
  private prevUuidsSorted: GeometryUuid[] = []
  private prevTransformsByUuid: Map<GeometryUuid, string[]> = new Map()

  constructor(name: string, renderingSpec: RenderingSpec, renderingMode: RenderingMode) {
    super()
    this.name = name
    this.renderingSpec = renderingSpec
    this.renderingMode = renderingMode
  }

  get vertexCount() {
    return this.mergedObject?.geometry.getAttribute("position")?.count ?? 0
  }

  dispose() {
    this._destructMergedObject()
  }

  private _destructMergedObject() {
    if (!this.mergedObject) return
    this.remove(this.mergedObject)
    // Intentionally only dispose geometry; materials are owned/shared via RenderingSpecs
    this.mergedObject.geometry.dispose()
    this.mergedObject = undefined
  }

  private _buildMergedGeometry(uniqueGeometries: Map<GeometryUuid, UniqueGeometry>) {
    const spec = RenderingSpecs[this.renderingSpec]

    let totalVertexCount = 0
    for (const { geometry, instances } of uniqueGeometries.values()) {
      const verticesPerInstance = geometry.getIndex()?.count ?? geometry.getAttribute("position").count
      totalVertexCount += verticesPerInstance * instances.size
    }

    const mergedGeometry = geometryFromSpecAndInstances(spec.buffers, uniqueGeometries, totalVertexCount)

    // Workaround for GL-bug on AMD + macOS; also helpful for consistent rendering
    const index: number[] = []
    for (let i = 0; i < totalVertexCount; i++) index.push(i)
    mergedGeometry.setIndex(index)
    mergedGeometry.setDrawRange(0, totalVertexCount)

    // Avoid accidental frustum culling; mirror approach used in RenderGroup.mergeRenderables
    mergedGeometry.boundingSphere = new Sphere(new Vector3(), Number.MAX_SAFE_INTEGER)

    const material = spec.material[this.renderingMode] ?? spec.material["normal"]
    const object3D =
      spec.drawMode === "LineSegments" ? new LineSegments(mergedGeometry, material) : new Mesh(mergedGeometry, material)
    object3D.name = `${this.name}/${this.renderingSpec}`
    object3D.castShadow = Boolean(spec.castShadow)
    object3D.receiveShadow = Boolean(spec.receiveShadow)
    object3D.renderOrder = spec.renderOrder ?? 0

    return object3D
  }

  update(uniqueGeometries: Map<GeometryUuid, UniqueGeometry>) {
    // Skip rebuild when the set of uuids and transforms are identical
    const currUuidsSorted = [...uniqueGeometries.keys()].sort()
    const currTransformsByUuid: Map<GeometryUuid, string[]> = new Map()
    for (const [uuid, ug] of uniqueGeometries) {
      const transformKeys: string[] = []
      for (const inst of ug.instances) transformKeys.push(matrixKey(inst.transform))
      transformKeys.sort()
      currTransformsByUuid.set(uuid, transformKeys)
    }

    const unchanged = signaturesEqual(
      this.prevUuidsSorted,
      this.prevTransformsByUuid,
      currUuidsSorted,
      currTransformsByUuid,
    )
    if (unchanged) return

    this._destructMergedObject()
    this.mergedObject = this._buildMergedGeometry(uniqueGeometries)
    this.add(this.mergedObject)

    // Store signature
    this.prevUuidsSorted = currUuidsSorted
    this.prevTransformsByUuid = currTransformsByUuid
  }
}

function geometryFromSpecAndInstances(
  buffers: ReadonlyArray<{
    name: string
    size: number
    type: typeof Float32Array | typeof Uint8Array
    normalized?: boolean
  }>,
  uniqueGeometries: Map<GeometryUuid, UniqueGeometry>,
  totalVertexCount: number,
) {
  const attributeArrays: Record<string, Float32Array | Uint8Array> = {}
  const attributeSpecs: Record<string, MergedAttributeSpec> = {}

  for (const b of buffers) {
    const ctor = b.type
    attributeArrays[b.name] = new ctor(totalVertexCount * b.size) as any
    attributeSpecs[b.name] = { name: b.name, size: b.size, type: b.type, normalized: b.normalized }
  }

  const positionWrite = attributeArrays["position"] as Float32Array
  const normalWrite = (attributeArrays["normal"] as Float32Array) || undefined

  let writePtrByAttribute: Record<string, number> = {}
  for (const b of buffers) writePtrByAttribute[b.name] = 0

  const normalMatrix = new Matrix3()

  for (const { geometry, instances } of uniqueGeometries.values()) {
    const expanded = expandAttributesForGeometry(geometry, buffers)
    const positions = expanded.position as Float32Array
    const normals = (expanded.normal as Float32Array) || undefined

    const otherAttributes = buffers
      .filter((b) => b.name !== "position" && b.name !== "normal")
      .map((b) => ({ spec: b, read: expanded[b.name] as any }))

    for (const instance of instances) {
      const m = instance.transform.elements
      normalMatrix.getNormalMatrix(instance.transform)
      const nm = normalMatrix.elements

      // positions
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]
        const y = positions[i + 1]
        const z = positions[i + 2]
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12]
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13]
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14]

        const posPtr = writePtrByAttribute["position"]
        positionWrite[posPtr] = wx
        positionWrite[posPtr + 1] = wy
        positionWrite[posPtr + 2] = wz
        writePtrByAttribute["position"] = posPtr + 3
      }

      // normals (if present in spec)
      if (normalWrite && normals) {
        for (let i = 0; i < normals.length; i += 3) {
          const x = normals[i]
          const y = normals[i + 1]
          const z = normals[i + 2]
          const nx = nm[0] * x + nm[3] * y + nm[6] * z
          const ny = nm[1] * x + nm[4] * y + nm[7] * z
          const nz = nm[2] * x + nm[5] * y + nm[8] * z
          // normalize
          const len = Math.hypot(nx, ny, nz) || 1
          const inv = 1 / len
          const normPtr = writePtrByAttribute["normal"]
          normalWrite[normPtr] = nx * inv
          normalWrite[normPtr + 1] = ny * inv
          normalWrite[normPtr + 2] = nz * inv
          writePtrByAttribute["normal"] = normPtr + 3
        }
      }

      // other attributes copied verbatim
      for (const { spec, read } of otherAttributes) {
        const dst = attributeArrays[spec.name] as any
        dst.set(read, writePtrByAttribute[spec.name])
        writePtrByAttribute[spec.name] += read.length
      }
    }
  }

  const merged = new BufferGeometry()
  for (const b of buffers) {
    const array = attributeArrays[b.name]
    merged.setAttribute(b.name, new BufferAttribute(array as any, b.size, !!b.normalized))
  }
  merged.name = `Merged/${Date.now()}`
  return merged
}

function matrixKey(m: { elements: number[] }): string {
  const e = m.elements
  // Avoid Array#join allocations for subarrays in a loop; build directly
  // 16 elements Matrix4
  return (
    e[0] +
    "," +
    e[1] +
    "," +
    e[2] +
    "," +
    e[3] +
    "," +
    e[4] +
    "," +
    e[5] +
    "," +
    e[6] +
    "," +
    e[7] +
    "," +
    e[8] +
    "," +
    e[9] +
    "," +
    e[10] +
    "," +
    e[11] +
    "," +
    e[12] +
    "," +
    e[13] +
    "," +
    e[14] +
    "," +
    e[15]
  )
}

// Compare current and previous signatures cheaply
// Both uuid arrays must be sorted
function signaturesEqual(
  prevUuidsSorted: GeometryUuid[],
  prevTransformsByUuid: Map<GeometryUuid, string[]>,
  currUuidsSorted: GeometryUuid[],
  currTransformsByUuid: Map<GeometryUuid, string[]>,
) {
  if (prevUuidsSorted.length !== currUuidsSorted.length) return false
  for (let i = 0; i < currUuidsSorted.length; i++) if (prevUuidsSorted[i] !== currUuidsSorted[i]) return false
  for (const uuid of currUuidsSorted) {
    const a = prevTransformsByUuid.get(uuid) || []
    const b = currTransformsByUuid.get(uuid) || []
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  }
  return true
}

function expandAttributesForGeometry(
  geometry: BufferGeometry,
  buffers: ReadonlyArray<{
    name: string
    size: number
    type: typeof Float32Array | typeof Uint8Array
    normalized?: boolean
  }>,
) {
  const index = geometry.getIndex()?.array as Uint16Array | Uint32Array | undefined
  const count = (index?.length ?? geometry.getAttribute("position").count) * 1
  const out: Record<string, Float32Array | Uint8Array> = {}

  for (const b of buffers) {
    const srcAttr = geometry.getAttribute(b.name)
    const src = srcAttr.array as any
    const itemSize = b.size
    const ctor = b.type
    const dst = new ctor(count * itemSize) as any
    if (!index) {
      dst.set(src)
    } else {
      // Expand indexed geometry to unindexed (duplicate referenced vertices)
      for (let i = 0; i < index.length; i++) {
        const vi = index[i] * itemSize
        const wi = i * itemSize
        for (let k = 0; k < itemSize; k++) dst[wi + k] = src[vi + k]
      }
    }
    out[b.name] = dst
  }
  return out
}
