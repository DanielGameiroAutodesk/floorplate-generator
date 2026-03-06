import { showTerrainSignal, terrainMaterialSignal } from "src/core/terrain/terrain-state"
import { useEffect, useMemo } from "preact/compat"
import sceneManager from "src/core/three/sceneManager"
import type { Box3, BufferGeometry } from "three"
import { Texture } from "three"
import {
  BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RawShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
} from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { colors } from "src/lib/colors"
import { contourShader } from "src/core/terrain/countour-shader"
import { PROJECT_ID, projectGeoLocationSignal } from "src/core/project/project"
import { useSignal, useSignalEffect } from "@preact/signals"
import { useReadonlySignal } from "src/lib/signal"
import type { Terrain as TerrainType } from "src/core/elements/Terrain"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { request } from "src/lib/request"
import { acceleratedRaycast } from "three-mesh-bvh"
import { setupAndComputeBoundsTree } from "src/lib/three/boundsTree"
import { getTranslator } from "src/i18n"

function getTerrainTextureBlobUrl(srid: number, bbox: [number, number][], type: "satellite" | "map") {
  const bb = encodeURIComponent(JSON.stringify(bbox))
  const endpoint = type === "satellite" ? "satellite.jpeg" : "map.webp"
  return `/terraintexture/${endpoint}?srid=${srid}&bbox=${bb}&size=4096&authcontext=${PROJECT_ID}`
}

async function downloadTerrainTexture(url: string) {
  try {
    const mapTextureData: { link?: string } = await request(url).then((r) => r.json())
    if (mapTextureData.link) {
      const link = mapTextureData.link
      const terrainTexture = await new Promise<Texture>((resolve, reject) =>
        new TextureLoader().load(link, resolve, reject),
      )
      terrainTexture.flipY = false
      terrainTexture.name = "TerrainMapTexture"
      terrainTexture.colorSpace = SRGBColorSpace
      terrainTexture.anisotropy = sceneManager.renderer.capabilities.getMaxAnisotropy()
      return terrainTexture
    }
  } catch (e) {
    console.warn("Loading terrain texture failed", e)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.terrain.errors.loadTextureFailed),
      status: "warning",
    })
  }
}

function useTerrainTexture(type: "satellite" | "map", srid?: number, bbox?: [number, number][]) {
  const terrainTextureSignal = useSignal<Texture>(new Texture())
  const urlSignal = useSignal<string>()

  const sridSignal = useReadonlySignal(srid)
  const bboxSignal = useReadonlySignal(bbox)
  const typeSignal = useReadonlySignal(type)

  useSignalEffect(() => {
    if (!sridSignal.value || !bboxSignal.value) return

    const url = getTerrainTextureBlobUrl(sridSignal.value, bboxSignal.value, typeSignal.value)
    if (urlSignal.value == url) return

    urlSignal.value = url

    void downloadTerrainTexture(url).then((texture) => {
      if (url === urlSignal.value) {
        terrainTextureSignal.value = texture ?? new Texture()
      }
    })
  })

  return terrainTextureSignal.value
}

function prepOverlayForTerrainVisibility(showTerrain: boolean) {
  sceneManager.overlay.material.transparent = !showTerrain
  const overlayBackground = sceneManager.overlay.scene.getObjectByName("__background__")
  if (overlayBackground) overlayBackground.visible = showTerrain
  sceneManager.overlay.material.uniforms.onlyOverlay.value = !showTerrain
}

function applyClippingToTerrainMesh(mesh: TerrainType["mesh"]) {
  if (Array.isArray(mesh.material)) {
    for (const material of mesh.material) {
      material.clippingPlanes = sceneManager.sectionBoxClipping.clippingPlanes
    }
  } else if (mesh.material instanceof RawShaderMaterial) {
    mesh.material.clippingPlanes = sceneManager.sectionBoxClipping.clippingPlanes
    mesh.material.uniforms.numClippingPlanes.value = sceneManager.sectionBoxClipping.clippingPlanes.length
  } else {
    mesh.material.clippingPlanes = sceneManager.sectionBoxClipping.clippingPlanes
  }
}

function recalculateUVs(position: Float32Array, bboxLocal: Box3) {
  const width = bboxLocal.max.x - bboxLocal.min.x
  const height = bboxLocal.max.y - bboxLocal.min.y

  const newUvs = new Array((2 * position.length) / 3)
  for (let i = 0; i < position.length / 3; i++) {
    newUvs[2 * i] = (position[3 * i] - bboxLocal.min.x) / width
    newUvs[2 * i + 1] = 1 - (position[3 * i + 1] - bboxLocal.min.y) / height
  }
  return new Float32Array(newUvs)
}

function RenderTerrainMesh({
  geometry,
  projectSrid,
  projectRefPoint,
}: {
  geometry: BufferGeometry
  projectSrid?: number
  projectRefPoint?: [number, number]
}) {
  const bboxLocal: Box3 = useMemo(() => {
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    return geometry.boundingBox!
  }, [geometry])

  const bboxGlobalForTexture: [number, number][] | undefined = useMemo(() => {
    if (!projectRefPoint) return undefined
    return [
      [bboxLocal.min.x + projectRefPoint[0], bboxLocal.min.y + projectRefPoint[1]],
      [bboxLocal.max.x + projectRefPoint[0], bboxLocal.max.y + projectRefPoint[1]],
    ]
  }, [bboxLocal, projectRefPoint])

  const geometryWithUV = useMemo(() => {
    const clonedGeometry = geometry.clone()
    const uvs = recalculateUVs(clonedGeometry.attributes.position.array as Float32Array, bboxLocal)
    clonedGeometry.setAttribute("uv", new BufferAttribute(uvs, 2))
    return clonedGeometry
  }, [geometry, bboxLocal])

  const mesh = useMemo(() => {
    const mesh = new Mesh(geometryWithUV)
    mesh.raycast = acceleratedRaycast
    setupAndComputeBoundsTree(mesh.geometry)
    mesh.receiveShadow = true
    mesh.castShadow = true
    mesh.name = "Terrain"
    return mesh
  }, [geometryWithUV])

  const showTerrain = showTerrainSignal.value
  const terrainMaterial = terrainMaterialSignal.value
  const terrainTexture = useTerrainTexture(
    terrainMaterial === "satellite" ? "satellite" : "map",
    projectSrid,
    bboxGlobalForTexture,
  )

  useEffect(() => {
    const terrainBboxForOverlayScene: [number, number][] = [
      [bboxLocal.min.x, bboxLocal.min.y],
      [bboxLocal.max.x, bboxLocal.max.y],
    ]
    sceneManager.updateTerrainBbox(terrainBboxForOverlayScene)
  }, [bboxLocal])

  useEffect(() => {
    prepOverlayForTerrainVisibility(showTerrain)
    if (!showTerrain) {
      mesh.material = sceneManager.overlay.material
    } else if (terrainMaterial === "contour") {
      mesh.material = contourShader
    } else if (terrainMaterial === "transparent") {
      mesh.material = new MeshLambertMaterial({ color: 0x5b6671, opacity: 0.25, transparent: true })
    } else {
      mesh.material = sceneManager.overlay.material
      sceneManager.overlay.material.uniforms.backgroundMap.value = terrainTexture
    }
    applyClippingToTerrainMesh(mesh)
    sceneManager.render(false, true)
  }, [mesh, terrainMaterial, showTerrain, terrainTexture])

  const wireframeMesh = useMemo(() => {
    if (!geometryWithUV || terrainMaterial !== "transparent") return undefined
    const wireframeMaterial = new MeshBasicMaterial({
      color: colors.gray50,
      opacity: 0.2,
      transparent: true,
      wireframe: true,
      clippingPlanes: sceneManager.sectionBoxClipping.clippingPlanes,
    })
    return new Mesh(geometryWithUV, wireframeMaterial)
  }, [terrainMaterial, geometryWithUV])

  useObjectLifecycle(wireframeMesh, !!wireframeMesh && showTerrain)
  useObjectLifecycle(mesh)

  return null
}

export function NewTerrain() {
  const projectGeoLocation = projectGeoLocationSignal.value
  const terrain = terrainSignal.value

  return (
    <RenderTerrainMesh
      geometry={terrain.mesh.geometry}
      projectSrid={projectGeoLocation?.srid}
      projectRefPoint={projectGeoLocation?.point}
    />
  )
}
