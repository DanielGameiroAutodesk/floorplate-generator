import { showTerrainSignal, terrainMaterialSignal } from "src/core/terrain/terrain-state"
import { useEffect, useMemo } from "preact/compat"
import sceneManager from "src/core/three/sceneManager"
import type { Texture } from "three"
import { Mesh, MeshBasicMaterial, MeshLambertMaterial, RawShaderMaterial, SRGBColorSpace, TextureLoader } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { colors } from "src/lib/colors"
import { contourShader } from "src/core/terrain/countour-shader"
import {
  downloadTerrainSatelliteTextureBlob,
  getTerrainSatelliteTextureBlobUrl,
} from "src/core/terrain/terrain-download"
import { PROJECT_ID } from "src/core/project/project"
import type { TerrainElement } from "src/core/terrain/terrain-types"
import { useSignal, useSignalEffect } from "@preact/signals"
import { useReadonlySignal } from "src/lib/signal"
import { elementState } from "src/core/elements/ElementState"
import type { Terrain as TerrainType } from "src/core/elements/Terrain"
import { getTranslator } from "src/i18n"

async function downloadSatelliteImage(url: string) {
  try {
    const mapTextureData = await downloadTerrainSatelliteTextureBlob(url)
    if (mapTextureData.link) {
      const link = mapTextureData.link
      const terrainTexture = await new Promise<Texture>((resolve, reject) =>
        new TextureLoader().load(link, resolve, reject),
      )
      terrainTexture.flipY = false
      terrainTexture.name = "TerrainMapTexture"
      terrainTexture.colorSpace = SRGBColorSpace
      return terrainTexture
    }
  } catch (e) {
    console.warn("Loading satellite texture failed", e)
    const t = getTranslator()
    window.forma_toasts.push({
      content: t(($) => $.terrain.errors.loadSatelliteTextureFailed),
      status: "warning",
    })
  }
}

function useSatelliteTexture(terrainElement: TerrainElement | undefined, shouldFetch: boolean) {
  const terrainTextureSignal = useSignal<Texture>()
  const urlSignal = useSignal<string>()

  const terrainElementSignal = useReadonlySignal(terrainElement)
  const shouldFetchSignal = useReadonlySignal(shouldFetch)
  useSignalEffect(() => {
    if (!terrainElementSignal.value || !shouldFetchSignal.value) return

    const url = getTerrainSatelliteTextureBlobUrl(PROJECT_ID, terrainElementSignal.value)
    if (urlSignal.value == url) return

    urlSignal.value = url
    terrainTextureSignal.value = undefined

    void downloadSatelliteImage(url).then((texture) => {
      if (url === urlSignal.value) {
        terrainTextureSignal.value = texture
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

export default function Terrain() {
  const terrain = elementState.currentTerrainSignal.value
  if (!terrain) {
    throw new Error("No terrain element in proposal")
  }
  const showTerrain = showTerrainSignal.value
  const terrainMaterial = terrainMaterialSignal.value
  const satelliteTerrainTexture = useSatelliteTexture(terrain.element, terrainMaterial === "satellite")

  useEffect(() => {
    const terrainbbox = terrain.element.properties.bbox
    const refpoint = terrain.element.properties.geoReference.refPoint
    const updatedTerrainBboxForSceneManager: [number, number][] = [
      [terrainbbox[0][0] - refpoint[0], terrainbbox[0][1] - refpoint[1]],
      [terrainbbox[1][0] - refpoint[0], terrainbbox[1][1] - refpoint[1]],
    ]
    sceneManager.updateTerrainBbox(updatedTerrainBboxForSceneManager)
  }, [terrain.element])

  useEffect(() => {
    if (!terrain.mesh || !terrain.element) return
    prepOverlayForTerrainVisibility(showTerrain)
    if (!showTerrain) {
      terrain.mesh.material = sceneManager.overlay.material
    } else if (terrainMaterial === "contour") {
      terrain.mesh.material = contourShader
    } else if (terrainMaterial === "transparent") {
      terrain.mesh.material = new MeshLambertMaterial({ color: 0x5b6671, opacity: 0.25, transparent: true })
    } else if (terrainMaterial === "satellite") {
      terrain.mesh.material = sceneManager.overlay.material
      if (satelliteTerrainTexture) {
        sceneManager.overlay.material.uniforms.backgroundMap.value = satelliteTerrainTexture
      }
    } else {
      const updateDefaultTexture = () => {
        if (!terrain.texture) return
        terrain.mesh.material = sceneManager.overlay.material
        sceneManager.overlay.material.uniforms.backgroundMap.value = terrain.texture.terrainTexture
        sceneManager.render(false, true)
      }
      updateDefaultTexture()
    }
    applyClippingToTerrainMesh(terrain.mesh)
    sceneManager.render(false, true)
  }, [terrain.mesh, terrainMaterial, showTerrain, satelliteTerrainTexture, terrain])

  const wireframeMesh = useMemo(() => {
    if (!terrain.mesh || terrainMaterial !== "transparent") return undefined
    const wireframeMaterial = new MeshBasicMaterial({
      color: colors.gray50,
      opacity: 0.2,
      transparent: true,
      wireframe: true,
      clippingPlanes: sceneManager.sectionBoxClipping.clippingPlanes,
    })
    return new Mesh(terrain.mesh.geometry, wireframeMaterial)
  }, [terrainMaterial, terrain.mesh])

  useObjectLifecycle(wireframeMesh, !!wireframeMesh && showTerrain)
  useObjectLifecycle(terrain.mesh)

  return null
}
