import type { BufferGeometry, ShaderMaterial } from "three"
import { CanvasTexture, Mesh, SRGBColorSpace } from "three"
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh"
import type { GLTF } from "three/addons/loaders/GLTFLoader.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import {
  loadTerrainBackgroundCache,
  loadTerrainCache,
  writeTerrainBackgroundCache,
  writeTerrainCache,
} from "./terrain-cache"
import sceneManager from "src/core/three/sceneManager"
import { request } from "src/lib/request"
import { PROJECT_ID } from "src/core/project/project"
import { flipYUpToZUp, getElementsClient } from "src/core/elements-loading/loading"
import { needsRepair, repair } from "./terrain-repair"
import { GeometryConstants } from "src/lib/three/geometryUtils"
import type { Urn } from "@spacemakerai/element-types"
import type { TerrainElement } from "./terrain-types"
import { loadRepresentationBinary } from "@spacemakerai/elements-client"
import { getTranslator } from "src/i18n"

type TerraintextureMapResponse = {
  attributionTag: string
  link: string
}

export async function fetchTerrainTextureBlob(
  projectId: string,
  terrainElement: TerrainElement,
): Promise<{ blob: Blob; attributionTag: string }> {
  const srid = terrainElement.properties.geoReference.srid
  const bb = encodeURIComponent(JSON.stringify(terrainElement.properties.bbox))
  const url = `/terraintexture/map.webp?srid=${srid}&bbox=${bb}&size=4096&authcontext=${projectId}`

  const link = (await request(url).then((r) => r.json())) as TerraintextureMapResponse
  return request(link.link)
    .then((r) => r.blob())
    .then((blob) => ({ blob, attributionTag: link.attributionTag }))
}

export function getTerrainSatelliteTextureBlobUrl(projectId: string, terrainElement: TerrainElement) {
  const srid = terrainElement.properties.geoReference.srid
  const bb = encodeURIComponent(JSON.stringify(terrainElement.properties.bbox))
  return `/terraintexture/satellite.jpeg?srid=${srid}&bbox=${bb}&size=4096&authcontext=${projectId}`
}

export async function downloadTerrainSatelliteTextureBlob(url: string) {
  return await request(url).then(
    (r) =>
      r.json() as {
        link?: string
      },
  )
}

export async function fetchTerrainGeometry(terrainElement: TerrainElement): Promise<BufferGeometry> {
  const cached = await loadTerrainCache(terrainElement.urn)
  if (cached) return cached

  const volumeMeshRep = terrainElement.representations?.volumeMesh
  if (!volumeMeshRep) throw new Error("No terrain volumeMesh found")

  const arrayBuffer = await loadRepresentationBinary(terrainElement.urn, volumeMeshRep, getElementsClient())

  const gltf: GLTF = await new Promise((resolve, reject) => new GLTFLoader().parse(arrayBuffer, "", resolve, reject))

  const terrain = gltf.scene.getObjectByProperty("type", "Mesh") as Mesh
  const geometry = terrain.geometry

  if (needsRepair(terrainElement)) {
    // Terrain had lots of duplicates, and UV mapping was in some cases upside down before march 1 2023
    // When these elements are migrated we can remove this code
    repair(terrainElement, geometry)
  } else {
    terrain.updateMatrixWorld()
    if (!terrain.matrixWorld.equals(GeometryConstants.IDENTITY)) geometry.applyMatrix4(terrain.matrixWorld)
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals()
    flipYUpToZUp(geometry)
  }
  geometry.computeBoundsTree = computeBoundsTree
  geometry.disposeBoundsTree = disposeBoundsTree
  geometry.computeBoundsTree()
  geometry.computeBoundingBox()
  return geometry
}

export type TerrainBackgroundTextureData = {
  blob: Blob
  attributionTag?: string
}

export type RawTerrainData = {
  geometry: BufferGeometry
  texture: TerrainBackgroundTextureData
}

const terrainDataCache: { [urn: Urn]: RawTerrainData } = {}

function createGrey1PxBlob() {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext("2d")!
  ctx.putImageData(new ImageData(new Uint8ClampedArray([230, 230, 230, 255]), 1, 1), 0, 0)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob gave nullable blob"))), "image/png")
  })
}

export async function fetchRawTerrainData(
  element: TerrainElement,
  writeCache: boolean = true,
): Promise<RawTerrainData> {
  if (terrainDataCache[element.urn]) {
    return terrainDataCache[element.urn]
  }
  const geometry = await fetchTerrainGeometry(element)

  const textureCache = await loadTerrainBackgroundCache(element.urn)

  const texture: { blob: Blob; attributionTag: string } = textureCache
    ? {
        blob: new Blob([textureCache.arraybuffer]),
        attributionTag: textureCache.attributionTag,
      }
    : await fetchTerrainTextureBlob(PROJECT_ID, element).catch(async (e) => {
        const t = getTranslator()
        window.forma_toasts.push({
          status: "warning",
          content: t(($) => $.terrain.errors.loadMapImageFailed),
        })
        console.error(e)
        writeCache = false
        const blob = await createGrey1PxBlob()
        return { blob, attributionTag: "" }
      })

  if (writeCache) {
    setTimeout(() => {
      void writeTerrainCache(geometry, element.urn)
      void writeTerrainBackgroundCache(element.urn, texture.blob, texture.attributionTag)
    }, 500)
  }

  const result = { geometry, texture }

  terrainDataCache[element.urn] = result

  return result
}

export async function createTerrainMesh(
  terrainData: RawTerrainData,
  material: ShaderMaterial = sceneManager.overlay.material,
) {
  const mesh = new Mesh(terrainData.geometry, material)
  mesh.raycast = acceleratedRaycast
  mesh.receiveShadow = true
  mesh.castShadow = true
  mesh.name = "Terrain"

  const { blob } = terrainData.texture
  const mapTexture = new CanvasTexture(await createImageBitmap(blob))
  mapTexture.name = "Terrain bgmap texture"
  mapTexture.colorSpace = SRGBColorSpace
  mapTexture.anisotropy = sceneManager.renderer.capabilities.getMaxAnisotropy()
  // TODO: Should not mutate here?
  material.uniforms.backgroundMap.value = mapTexture
  return { mesh, mapTexture }
}

export async function getTerrainBackgroundTexture(
  projectId: string,
  terrainElement: TerrainElement,
): Promise<TerrainBackgroundTextureData> {
  const textureCache = await loadTerrainBackgroundCache(terrainElement.urn)
  if (textureCache) {
    return {
      blob: new Blob([textureCache.arraybuffer]),
      attributionTag: textureCache.attributionTag,
    }
  } else {
    return fetchTerrainTextureBlob(projectId, terrainElement).catch(async () => {
      return { blob: await createGrey1PxBlob() }
    })
  }
}
