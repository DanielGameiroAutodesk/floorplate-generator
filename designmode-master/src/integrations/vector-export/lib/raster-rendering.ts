import type { SceneManager } from "src/core/three/sceneManager"
import {
  DoubleSide,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  ShadowMaterial,
  type WebGLRenderer,
  WebGLRenderTarget,
  type Camera,
  LineBasicMaterial,
  type Plane,
} from "three"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { LineMaterial, OutputPass } from "three/examples/jsm/Addons.js"
import sceneManager from "src/core/three/sceneManager"
import { SunApi } from "src/integrations/sun/api"
import { projectSignal } from "src/core/project/project"
import { terrainMaterialSignal } from "src/core/terrain/terrain-state"

const resetCanvasRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera) => {
  renderer.setRenderTarget(null)
  renderer.clear()
  renderer.render(scene, camera)
}

// front and back enums
export type Raster = {
  dataUrl: string
  opacity: number
  name: string
}

export type RasterLayers = {
  front: Raster[]
  back: Raster[]
}

export function renderRasterLayers(terrainMesh: Mesh): RasterLayers {
  const sunDate = SunApi.sunDateSignal.peek()
  const tz = projectSignal.peek()?.timezone
  const shadowRasterSuffix =
    tz && sunDate
      ? sunDate.toLocaleString("en-US", {
          timeZone: tz,
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : ""

  const terrainSuffix = terrainMaterialSignal.peek() || ""
  return {
    front: [
      {
        dataUrl: renderShadows(sceneManager),
        opacity: 0.2,
        // use sunDate to generate a unique name for the raster
        name: `shadows ${shadowRasterSuffix}`,
      },
    ],
    back: [
      {
        dataUrl: renderOpaqueGeometries(sceneManager, terrainMesh, true),
        opacity: 1,
        name: `terrain ${terrainSuffix}`,
      },
      {
        dataUrl: renderOpaqueGeometries(sceneManager, terrainMesh, false),
        opacity: 1,
        name: "opaque",
      },
      {
        dataUrl: renderTransparentGeometries(sceneManager),
        opacity: 1,
        name: "transparent",
      },
    ],
  }
}

const applyMaskShader = {
  uniforms: {
    mask: { value: null },
    render: { value: null },
  },
  vertexShader: `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`,
  fragmentShader: `
  uniform sampler2D mask;
  uniform sampler2D render;
  varying vec2 vUv;

  void main() {
    vec4 maskTexel = texture2D(mask, vUv);
    vec4 renderTexel = texture2D(render, vUv);
    if (maskTexel.r < 0.5) {
        gl_FragColor = renderTexel;
    } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
}
`,
}

const getClippedMaskingMaterial = (clippingPlanes: Plane[]) =>
  new MeshBasicMaterial({
    color: "white",
    clippingPlanes,
    side: DoubleSide,
  })

const getClippedMaskedMaterial = (clippingPlanes: Plane[]) =>
  new MeshBasicMaterial({
    color: "black",
    clippingPlanes,
    side: DoubleSide,
  })

const getClippedInvisibleMaterial = (clippingPlanes: Plane[]) =>
  new MeshBasicMaterial({
    color: "black",
    opacity: 0,
    clippingPlanes,
    transparent: true,
  })

const renderToTarget = (renderer: WebGLRenderer, target: WebGLRenderTarget, scene: Scene, camera: Camera) => {
  renderer.setRenderTarget(target)
  renderer.clear()
  renderer.render(scene, camera)
  renderer.setRenderTarget(null)
}

const maskComposerRender = (
  renderer: WebGLRenderer,
  maskRenderTarget: WebGLRenderTarget,
  sceneRenderTarget: WebGLRenderTarget,
) => {
  const composer = new EffectComposer(renderer)
  const maskingPass = new ShaderPass(applyMaskShader)
  composer.addPass(maskingPass)
  composer.addPass(new OutputPass())
  maskingPass.uniforms.mask.value = maskRenderTarget.texture
  maskingPass.uniforms.render.value = sceneRenderTarget.texture
  composer.render()
}

const resetMaterials = (scene: Scene) => {
  scene.traverse((child) => {
    if (child instanceof Mesh) {
      if (child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial
        delete child.userData.originalMaterial
      }
    }
  })
}

const isOpaque = (mesh: Mesh) => {
  const material = mesh.material as Material
  return material.transparent === false || material.opacity === 1
}
const isTransparent = (mesh: Mesh) => {
  return !isOpaque(mesh)
}
const hasLineMaterial = (mesh: Mesh) => {
  return mesh.material instanceof LineBasicMaterial || mesh.material instanceof LineMaterial
}

const applyOverride = (child: Mesh, override?: Material) => {
  if (override) {
    child.userData.originalMaterial = child.userData.originalMaterial || child.material
    child.material = override
  }
}

const overrideMaterials = (
  scene: Scene,
  opaqueOverride?: Material,
  transparentOverride?: Material,
  linesOverride?: Material,
) => {
  // overrides materials child per child, keeping track of the original material
  // needed for cases where we cannot just override the scene material globally
  scene.traverse((child) => {
    if (child instanceof Mesh) {
      if (hasLineMaterial(child)) {
        applyOverride(child, linesOverride)
      } else if (isOpaque(child)) {
        applyOverride(child, opaqueOverride)
      } else if (isTransparent(child)) {
        applyOverride(child, transparentOverride)
      }
    }
  })
}

export function renderShadows(sceneManager: SceneManager) {
  const { scene, renderer, camera } = sceneManager

  // store original background and alpha values
  const background = scene.background
  const alpha = renderer.getClearAlpha()

  // override renderer alpha and scene properties to allow for transparent background and shadows only
  renderer.setClearAlpha(0)
  scene.background = null

  // shadow material
  const shadowMaterial = new ShadowMaterial({
    opacity: 1.0,
    transparent: false,
    side: DoubleSide,
    clippingPlanes: sceneManager.sectionBoxClipping.clippingPlanes,
  })

  // we need to modify the shadow material shader to consider clipping planes
  shadowMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = `
      #include <clipping_planes_pars_vertex>
      ${shader.vertexShader}
    `.replace(
      "#include <project_vertex>",
      `
      #include <project_vertex>
      #include <clipping_planes_vertex>
      `,
    )
    shader.fragmentShader = `
      #include <clipping_planes_pars_fragment>
      ${shader.fragmentShader}
    `.replace(
      "void main() {",
      `
      void main() {
        #include <clipping_planes_fragment>
      `,
    )
  }
  const invisibleMaterial = getClippedInvisibleMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  overrideMaterials(scene, shadowMaterial, invisibleMaterial, invisibleMaterial)

  // render the scene
  renderer.render(scene, camera)
  const imageDataUrl = getImageDataUrl(renderer)

  // reset all
  scene.overrideMaterial = null
  scene.background = background
  renderer.setClearAlpha(alpha)
  resetMaterials(scene)
  resetCanvasRender(renderer, scene, camera)

  return imageDataUrl
}

function renderOpaqueGeometries(sceneManager: SceneManager, terrainMesh: Mesh, isTerrainRender: boolean) {
  const { scene, renderer, camera } = sceneManager
  const { width, height } = renderer.domElement

  // declare two render targets
  const maskRenderTarget = new WebGLRenderTarget(width, height) // where the mask will be rendered
  const sceneRenderTarget = new WebGLRenderTarget(width, height) // where the scene will be rendered

  // reset and override materials for masking pass
  // opaque > masked, transparent > invisible, lines > invisible, terrain > masking
  const maskingMaterial = getClippedMaskingMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  const maskedMaterial = getClippedMaskedMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  const invisibleMaterial = getClippedInvisibleMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  overrideMaterials(scene, isTerrainRender ? maskingMaterial : maskedMaterial, invisibleMaterial, invisibleMaterial)
  applyOverride(terrainMesh, isTerrainRender ? maskedMaterial : maskingMaterial)
  renderToTarget(renderer, maskRenderTarget, scene, camera)

  // reset and override materials for rendering pass
  resetMaterials(scene)
  overrideMaterials(scene, undefined, invisibleMaterial, invisibleMaterial)
  renderToTarget(renderer, sceneRenderTarget, scene, camera)
  maskComposerRender(renderer, maskRenderTarget, sceneRenderTarget)
  const imageDataUrl = getImageDataUrl(renderer)

  // reset all
  resetMaterials(scene)
  resetCanvasRender(renderer, scene, camera)

  return imageDataUrl
}

function renderTransparentGeometries(sceneManager: SceneManager) {
  const { scene, renderer, camera } = sceneManager
  const { width, height } = renderer.domElement

  // store original background and alpha values
  const background = scene.background
  const alpha = renderer.getClearAlpha()

  // override renderer alpha and scene properties to allow for transparent background and shadows only
  renderer.setClearAlpha(0)
  scene.background = null

  // declare two render targets
  const maskRenderTarget = new WebGLRenderTarget(width, height) // where the mask will be rendered
  const sceneRenderTarget = new WebGLRenderTarget(width, height) // where the scene will be rendered

  // override materials for masking pass
  // opaque > masking, transparent > masked, lines > invisible
  const maskingMaterial = getClippedMaskingMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  const maskedMaterial = getClippedMaskedMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  const invisibleMaterial = getClippedInvisibleMaterial(sceneManager.sectionBoxClipping.clippingPlanes)
  overrideMaterials(scene, maskingMaterial, maskedMaterial, invisibleMaterial)
  renderToTarget(renderer, maskRenderTarget, scene, camera)

  // reset and override materials for rendering pass
  resetMaterials(scene)
  // everything but transparent materials should be invisible
  overrideMaterials(scene, invisibleMaterial, undefined, invisibleMaterial)
  renderToTarget(renderer, sceneRenderTarget, scene, camera)

  maskComposerRender(renderer, maskRenderTarget, sceneRenderTarget)
  const imageDataUrl = getImageDataUrl(renderer)

  // reset all
  scene.overrideMaterial = null
  scene.background = background
  renderer.setClearAlpha(alpha)
  resetMaterials(scene)
  resetCanvasRender(renderer, scene, camera)

  return imageDataUrl
}

const getImageDataUrl = (renderer: WebGLRenderer) => {
  const canvas = renderer.domElement
  return canvas.toDataURL("image/png")
}
