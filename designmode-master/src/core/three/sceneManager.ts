import type { BufferGeometry, Material, Object3D, Plane } from "three"
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three"
import { buildCamerasAndControls, updateAspectRatio } from "./controls"
import { createTerrainMaterial, getPaddedBbox } from "src/core/terrain/terrain-texture"
import { graphicsSettings } from "src/lib/three/graphics-settings"
import { PROJECT_ID } from "src/core/project/project"
import { activateKeyboardControls } from "./keyboardnavigation"
import Stats from "three/addons/libs/stats.module.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js"
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { DesignModeEvents } from "src/core/events/events"

export const screenResolutionVector = new Vector2(window.innerWidth, window.innerHeight) // Auto updated for use in materials
export const SCENE_BACKGROUND_COLOR = new Color(0xf4f4f4)
export const lightIntensities = { ambient: 0.45 * Math.PI, headlamp: 0.2 * Math.PI, sun: 0.44 * Math.PI }

const DEBUG_CAMERA_TARGET = new URLSearchParams(window.location.search).has("camera-target")
const DEBUG_GPU_PERFORMANCE_MONITORING = new URLSearchParams(window.location.search).has("gpu-perfmon")
const ENABLE_SSAO = new URLSearchParams(window.location.search).has("ssao")

if (DEBUG_GPU_PERFORMANCE_MONITORING) {
  // use dynamic import since webgl-memory - when imported - modifies stuff
  await import("webgl-memory")
}

let debounceHandle: any
let stats: any
let trianglesPanel: any
let renderCallsPanel: any
let composer: any

type Vec3 = {
  x: number
  y: number
  z: number
}

type CamType =
  | {
      cameraType: "perspective"
    }
  | {
      cameraType: "orthographic"
      zoom: number
      theta: number
    }
type CameraPosition = {
  scope: string
  position: Vec3
  target: Vec3
}

export function storeCameraPos() {
  clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => {
    const { controls, camera } = sceneManager
    const camType: CamType =
      camera instanceof OrthographicCamera
        ? {
            cameraType: "orthographic",
            zoom: camera.zoom,
            theta: camera.rotation.z,
          }
        : { cameraType: "perspective" }
    const camPos: CameraPosition = { scope: PROJECT_ID, target: controls.target, position: camera.position }
    const data = JSON.stringify({
      ...camPos,
      ...camType,
    })
    sessionStorage.setItem("THREE-camera-position", data)
  }, 500)
}

function buildLights() {
  const ambient = new AmbientLight(0xffffff, lightIntensities.ambient)
  ambient.name = "light-ambient"
  const headlamp = new DirectionalLight(0xffffff, lightIntensities.headlamp)
  headlamp.name = "light-headlamp"

  return { ambient, headlamp }
}

function createOverlayScene(maxSize: number) {
  const size = Math.min(8192, maxSize)
  const bufferCamera = new OrthographicCamera(0, 0, 0, 0, -10000, 10000)

  const renderTarget = new WebGLRenderTarget(size, size)
  const bufferScene = new Scene()
  bufferScene.name = "Overlay Scene"

  // TODO: Use actual bg image for better blending?
  const bgmaterial = new MeshBasicMaterial({
    color: "#cccccc",
    opacity: 0,
    transparent: true,
    blending: NoBlending,
    userData: { preventClipping: true },
  })
  bgmaterial.name = "Overlay Background"
  const background = new Mesh(new PlaneGeometry(10000, 10000), bgmaterial)
  background.renderOrder = -10 // Render before the 2D materials in renderable.ts
  background.name = "__background__"
  bufferScene.add(background)

  return {
    scene: bufferScene,
    camera: bufferCamera,
    material: createTerrainMaterial(renderTarget.texture),
    renderTarget,
    terrainBbox: [
      [0, 0],
      [1, 1],
    ],
  }
}

class NoRaycastMesh extends Mesh {
  constructor(geometry?: BufferGeometry, material?: Material) {
    super(geometry, material)
  }

  raycast() {
    return
  }
}

function getMeshes(o: Object3D): Mesh[] {
  if (o instanceof Mesh) return [o]
  return o.children.flatMap(getMeshes)
}

function renderBgTexture() {
  const bbox = getPaddedBbox(getMeshes(sceneManager.overlay.scene))
  const { material, terrainBbox } = sceneManager.overlay
  material.uniforms.scale.value[0] = (terrainBbox[1][0] - terrainBbox[0][0]) / (bbox[1][0] - bbox[0][0])
  material.uniforms.scale.value[1] = (terrainBbox[1][1] - terrainBbox[0][1]) / (bbox[1][1] - bbox[0][1])
  material.uniforms.offset.value[0] = (terrainBbox[0][0] - bbox[0][0]) / (bbox[1][0] - bbox[0][0])
  material.uniforms.offset.value[1] = (terrainBbox[0][1] - bbox[0][1]) / (bbox[1][1] - bbox[0][1])
  sceneManager.overlay.camera.left = bbox[0][0]
  sceneManager.overlay.camera.right = bbox[1][0]
  sceneManager.overlay.camera.top = bbox[1][1]
  sceneManager.overlay.camera.bottom = bbox[0][1]
  sceneManager.overlay.camera.updateProjectionMatrix()
  sceneManager.renderer.setRenderTarget(sceneManager.overlay.renderTarget)
  sceneManager.renderer.render(sceneManager.overlay.scene, sceneManager.overlay.camera)
  sceneManager.renderer.setRenderTarget(null)
}

function initialize() {
  const canvas = document.getElementById("design-mode-canvas") as HTMLCanvasElement
  const renderer = new WebGLRenderer({
    canvas,
    antialias: graphicsSettings.antialias,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
    stencil: true,
  })
  renderer.setPixelRatio(graphicsSettings.pixelRatio)
  renderer.shadowMap.enabled = graphicsSettings.shadowMapEnabled
  renderer.shadowMap.type = graphicsSettings.shadowMapping

  const scene = new Scene()
  scene.name = "Main 3D View"
  scene.background = SCENE_BACKGROUND_COLOR

  if (DEBUG_GPU_PERFORMANCE_MONITORING) {
    const gpuMemoryExtension = renderer.getContext().getExtension("GMAN_webgl_memory")
    if (gpuMemoryExtension) {
      setInterval(() => {
        const info = gpuMemoryExtension.getMemoryInfo()
        console.log("\nGPU memory:")
        for (const [k, v] of Object.entries<number>(info.memory)) {
          console.log(k, Math.round(v / (1024 * 1024)), "MB")
        }
      }, 10000)
    }

    stats = new Stats()
    document.body.appendChild(stats.dom)
    trianglesPanel = new Stats.Panel("tris", "#fff", "#000")
    renderCallsPanel = new Stats.Panel("calls", "#fff", "#000")
    stats.addPanel(trianglesPanel)
    stats.addPanel(renderCallsPanel)
    stats.showPanel(0)
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight)

    if (ENABLE_SSAO) {
      composer.setSize(window.innerWidth, window.innerHeight)
    }

    screenResolutionVector.set(window.innerWidth, window.innerHeight)
    updateAspectRatio(
      window.innerWidth / window.innerHeight,
      sceneManager.orthographicCamera,
      sceneManager.perspectiveCamera,
    )
    sceneManager.render()
  }

  function contextmenu(e: MouseEvent) {
    e.preventDefault()
  }

  renderer.localClippingEnabled = true
  const sectionBoxClipping = {
    // Contains the clipping planes that define the section box
    clippingPlanes: [] as Plane[],
    // Contains the meshes that have been forced to be double sided
    forcedDoubleSidedMeshes: new Set<Mesh>(),
    previousRenderPassMeshes: new WeakSet<Mesh>(),

    setClippingPlanes: (clippingPlanes: Plane[]) => {
      sectionBoxClipping.clippingPlanes = clippingPlanes
      sectionBoxClipping.previousRenderPassMeshes = new WeakSet<Mesh>()
      DesignModeEvents.dispatch("clipping.changed")
    },

    apply: () => {
      if (sectionBoxClipping.clippingPlanes.length === 0) return
      const newMeshes = new WeakSet<Mesh>()
      scene.traverse((o) => {
        const oMesh = o as Mesh
        if (sectionBoxClipping.previousRenderPassMeshes.has(oMesh)) {
          newMeshes.add(oMesh)
        } else {
          if (oMesh.material) {
            const mat = oMesh.material as Material
            if (mat.side === 0) {
              mat.side = 2
              sectionBoxClipping.forcedDoubleSidedMeshes.add(oMesh)
            }
            if (mat.userData.preventClipping) return
            mat.clippingPlanes = sectionBoxClipping.clippingPlanes
            if (mat instanceof RawShaderMaterial)
              mat.uniforms.numClippingPlanes.value = sectionBoxClipping.clippingPlanes.length
            newMeshes.add(oMesh)
          }
        }
      })
      sectionBoxClipping.previousRenderPassMeshes = newMeshes
      DesignModeEvents.dispatch("clipping.changed")
    },

    reset: () => {
      scene.traverse((o) => {
        if ((o as Mesh).material) {
          const mat = (o as Mesh).material as Material
          mat.clippingPlanes = []
          if (mat instanceof RawShaderMaterial) mat.uniforms.numClippingPlanes.value = 0
        }
      })
      sectionBoxClipping.clippingPlanes = []

      sectionBoxClipping.forcedDoubleSidedMeshes.forEach((mesh) => {
        const mat = mesh.material as Material
        mat.side = 0
      })
      sectionBoxClipping.forcedDoubleSidedMeshes = new Set<Mesh>()
      sectionBoxClipping.previousRenderPassMeshes = new WeakSet<Mesh>()
      DesignModeEvents.dispatch("clipping.changed")
    },
  }

  canvas.addEventListener("contextmenu", contextmenu)
  window.addEventListener("resize", resize)

  let renderQueued = false
  let updateBgTextureNextFrame = false
  let firstRender = true

  function render(updateShadowMap = false, updateBgTexture = false) {
    if (firstRender) {
      if (!scene.getObjectByName("Terrain")) return
      firstRender = false
      const img = document.getElementById("canvas-snapshot")
      img && img.parentElement!.removeChild(img)
      window.__SCENE_INITIALIZED__ = true
      setTimeout(() => {
        document.querySelector<HTMLElement>("forma-bootstrap")?.removeAttribute("halt-non-essentials")
      }, 500)
      resize()
    }
    if (updateShadowMap) renderer.shadowMap.needsUpdate = true
    if (updateBgTexture) updateBgTextureNextFrame = true
    if (window.__SUBMODE_WITH_OWN_SCENE_ACTIVE__) return
    if (renderQueued) return
    renderQueued = true
    window.requestAnimationFrame(() => {
      sectionBoxClipping.apply()
      if (updateBgTextureNextFrame) renderBgTexture()

      if (DEBUG_GPU_PERFORMANCE_MONITORING) {
        stats.update()
      }

      if (ENABLE_SSAO) {
        composer.render()
      } else {
        renderer.render(scene, sceneManager.camera)
      }

      if (DEBUG_GPU_PERFORMANCE_MONITORING) {
        trianglesPanel.update(renderer.info.render.triangles, 15_000_000)
        renderCallsPanel.update(renderer.info.render.calls, 200)
      }
      renderQueued = false
      updateBgTextureNextFrame = false
    })
  }

  const { perspectiveCamera, controls, orthographicCamera } = buildCamerasAndControls(canvas)

  if (ENABLE_SSAO) {
    composer = new EffectComposer(renderer)

    const renderPass = new RenderPass(scene, perspectiveCamera)
    composer.addPass(renderPass)

    const gtaoPass = new GTAOPass(
      scene,
      perspectiveCamera,
      window.innerWidth * graphicsSettings.pixelRatio,
      window.innerHeight * graphicsSettings.pixelRatio,
    )
    const aoParameters = {
      radius: 5,
      distanceExponent: 1,
      thickness: 10,
      scale: 1,
      samples: 8,
      distanceFallOff: 0.9,
      screenSpaceRadius: false,
    }
    gtaoPass.updateGtaoMaterial(aoParameters)
    composer.addPass(gtaoPass)

    const smaaPass = new SMAAPass(
      window.innerWidth * graphicsSettings.pixelRatio,
      window.innerHeight * graphicsSettings.pixelRatio,
    )
    composer.addPass(smaaPass)

    const outputPass = new OutputPass()
    composer.addPass(outputPass)
  }

  const { ambient, headlamp } = buildLights()
  scene.add(ambient, headlamp)

  const updateHeadlampIntensity = () => {
    const polar = controls.getPolarAngle()
    headlamp.intensity =
      polar > 0.5 ? lightIntensities.headlamp : 0.1 * polar * Math.PI + lightIntensities.headlamp - 0.05 * Math.PI
  }
  updateHeadlampIntensity()
  headlamp.position.subVectors(perspectiveCamera.position, controls.target)

  const obj = new NoRaycastMesh(
    new SphereGeometry(5),
    new MeshLambertMaterial({ color: "#ff00ff", depthTest: false, depthWrite: false }),
  )
  obj.renderOrder = 1
  DEBUG_CAMERA_TARGET && scene.add(obj)

  controls.addEventListener("change", () => {
    headlamp.position.subVectors(sceneManager.camera.position, sceneManager.controls.target)
    DEBUG_CAMERA_TARGET && obj.position.copy(sceneManager.controls.target)
    updateHeadlampIntensity()
    sceneManager.render()
  })
  controls.addEventListener("end", storeCameraPos)
  activateKeyboardControls()

  return {
    scene,
    container: undefined as HTMLDivElement | undefined,
    resize,
    renderer,
    canvas,
    camera: controls.object,
    controls,
    perspectiveCamera: perspectiveCamera,
    orthographicCamera: orthographicCamera,
    get is2D() {
      return this.camera === orthographicCamera
    },
    render,
    setCameraPosition: () => {
      console.warn("conceptual trying to update camera")
    },
    overlay: createOverlayScene(renderer.capabilities.maxTextureSize),
    updateTerrainBbox(terrainBbox: [number, number][]) {
      sceneManager.overlay.terrainBbox = terrainBbox
    },
    sectionBoxClipping,
  }
}

declare global {
  interface Window {
    __DEBUG__?: Record<string, any>
  }
}

const sceneManager = initialize()
window.__DEBUG__ = { ...window.__DEBUG__, sceneManager }
sceneManager.resize()
export default sceneManager

export type SceneManager = typeof sceneManager
