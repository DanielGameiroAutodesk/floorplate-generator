import { Box3, BufferAttribute, BufferGeometry, Sphere, Vector3 } from "three"
import { MeshBVH } from "three-mesh-bvh"
import { captureException } from "@sentry/browser"

type SerializedTerrainCache = {
  lastModified: number
  key: string
  version: string
  boundingSphere: TerrainGeometryData["boundingSphere"]
  boundingBox: TerrainGeometryData["boundingBox"]
}

const ignoreTerrainCache = new URLSearchParams(window.location.search).has("ignore-terrain-cache")

function handleError(reason: any) {
  // Fail silently, for instance for Private Windows in FireFox the API is disabled.
  // Everything will still work just be a bit slower
  console.warn(reason)
}

let cache: Cache
caches
  .open("terrain-cache")
  .then((res) => (cache = res))
  .catch(handleError)

async function cache_put(name: string, buffer: ArrayBuffer) {
  return cache && cache.put(new Request(name), new Response(buffer)).catch(handleError)
}

async function cache_get(name: string) {
  return (
    cache &&
    cache
      .match(new Request(name))
      .then((r) => (r ? r.arrayBuffer() : undefined))
      .catch((err) => {
        handleError(err)
        return undefined
      })
  )
}

// We depend on version of three-mesh-bvh to avoid compatibility issues across versions
// for the boundsTreeRoot data.
const VERSION_ID = `bvh:${__THREE_MESH_BVH_VERSION__}-4` // Used as a cachebuster

export async function loadTerrainCache(cacheKey: string) {
  const cacheInfo = localStorage.getItem("terrain_cache")
  if (ignoreTerrainCache || !cacheInfo) return
  try {
    const { key, boundingSphere, boundingBox, lastModified, version } = JSON.parse(cacheInfo) as SerializedTerrainCache
    if (key !== cacheKey || lastModified < Date.now() - 24 * 60 * 60 * 1000 || VERSION_ID !== version) return
    const timeout = setTimeout(() => {
      console.warn("spend more than 5s waiting for terraincache")
      captureException(new Error("Slow loading terrain cache"))
    }, 5000)
    const buffers = await Promise.all([
      cache_get("/terrain_position"),
      cache_get("/terrain_uv"),
      cache_get("/terrain_normal"),
      cache_get("/terrain_index"),
      cache_get("/terrain_boundsTree_root"),
    ])
    clearTimeout(timeout)
    if (buffers.some((_) => !_)) throw new Error("Missing some of the buffers")

    const [pos, uv, normal, index, boundsTreeRoot] = buffers

    const geometry = new BufferGeometry()
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos!), 3))
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normal!), 3))
    geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uv!), 2))
    geometry.setIndex(new BufferAttribute(new Uint32Array(index!), 1))
    const serializedBVH = { index: new Uint32Array(index!), roots: [boundsTreeRoot!] }
    geometry.boundsTree = MeshBVH.deserialize(serializedBVH, geometry)
    const [x, y, z, r] = boundingSphere
    geometry.boundingSphere = new Sphere(new Vector3(x, y, z), r)
    if (boundingBox) {
      geometry.boundingBox = new Box3(
        new Vector3().fromArray(boundingBox.min),
        new Vector3().fromArray(boundingBox.max),
      )
    } else {
      geometry.computeBoundingBox()
    }
    return geometry
  } catch (e) {
    console.error("Failed to load terrain-cache", e)
    localStorage.removeItem("terrain_cache")
    return
  }
}

type SerializedCacheInfoShape = {
  lastModified: number
  key: string
  attributionTag: string
}

export async function loadTerrainBackgroundCache(
  cacheKey: string,
): Promise<{ arraybuffer: ArrayBuffer; attributionTag: string } | undefined> {
  const cacheInfo = localStorage.getItem("terrain_bg_cache")
  if (ignoreTerrainCache || !cacheInfo) return undefined
  try {
    const { key, lastModified, attributionTag } = JSON.parse(cacheInfo) as SerializedCacheInfoShape
    if (key !== cacheKey || lastModified < Date.now() - 24 * 60 * 60 * 1000) return
    const arraybuffer = await cache_get("/terrain_bgtexture")
    if (!arraybuffer) throw new Error("Missing some of the buffers")
    return { arraybuffer, attributionTag }
  } catch (e) {
    console.error("Failed to load terrain-bg-cache", e)
    localStorage.removeItem("terrain_bg_cache")
    return undefined
  }
}

export async function writeTerrainBackgroundCache(cacheKey: string, data: Blob, attributionTag: string) {
  const cacheInfo = localStorage.getItem("terrain_bg_cache")
  const existing = cacheInfo ? (JSON.parse(cacheInfo) as SerializedCacheInfoShape) : null
  if (existing?.key === cacheKey && existing.lastModified >= Date.now() - 24 * 60 * 60 * 1000) {
    return
  }
  await cache_put("/terrain_bgtexture", await data.arrayBuffer())
  const cacheData = JSON.stringify({
    lastModified: Date.now(),
    key: cacheKey,
    attributionTag,
  } satisfies SerializedCacheInfoShape)
  localStorage.setItem("terrain_bg_cache", cacheData)
}

export type TerrainGeometryData = {
  attributes: {
    position: Float32Array
    normal: Float32Array
    uv: Float32Array
    index: Uint32Array
  }
  boundsTreeRoot: ArrayBuffer
  boundingSphere: [number, number, number, number]
  boundingBox: { min: [number, number, number]; max: [number, number, number] }
}

export function extractTerrainGeometryData(geometry: BufferGeometry): TerrainGeometryData {
  // Assume only 1 root, index is identical to geometry.index so no need to store both
  const boundsTreeRoot = MeshBVH.serialize(geometry.boundsTree!).roots[0]
  const position = geometry.attributes.position.array as Float32Array
  const normal = geometry.attributes.normal.array as Float32Array
  const index = geometry.index!.array as Uint32Array
  const uv = geometry.attributes.uv.array as Float32Array
  const { center, radius } = geometry.boundingSphere!
  const { min, max } = geometry.boundingBox!
  return {
    attributes: { position, normal, index, uv },
    boundsTreeRoot,
    boundingSphere: [center.x, center.y, center.z, radius],
    boundingBox: { min: min.toArray(), max: max.toArray() },
  }
}

export async function writeTerrainCache(geometry: BufferGeometry, cacheKey: string) {
  const item = localStorage.getItem("terrain_cache")
  if (!item) return
  const { version, key, lastModified } = JSON.parse(item) as SerializedTerrainCache
  if (version === VERSION_ID && key === cacheKey && lastModified >= Date.now() - 24 * 60 * 60 * 1000) {
    return
  }

  const { attributes, boundsTreeRoot, boundingSphere, boundingBox } = extractTerrainGeometryData(geometry)

  await Promise.all([
    cache_put("/terrain_position", attributes.position.buffer),
    cache_put("/terrain_normal", attributes.normal.buffer),
    cache_put("/terrain_index", attributes.index.buffer),
    cache_put("/terrain_uv", attributes.uv.buffer),
    cache_put("/terrain_boundsTree_root", boundsTreeRoot),
  ])

  const cacheData = JSON.stringify({
    lastModified: Date.now(),
    key: cacheKey,
    version: VERSION_ID,
    boundingSphere,
    boundingBox,
  } satisfies SerializedTerrainCache)
  localStorage.setItem("terrain_cache", cacheData)
}
