import type { Object3D } from "three"
import { Box3, Color, PerspectiveCamera, Scene, Sphere, Spherical, Vector3, WebGLRenderer } from "three"
import { graphicsSettings } from "./graphics-settings"
import { DARK_MODE } from "src/lib/darkmode"

let renderer: WebGLRenderer | undefined

export function renderCanvas(
  canvas: HTMLCanvasElement,
  objects: Object3D[],
  phi: number = 0,
  theta: number = 0,
  zoom: number = 1,
) {
  const renderer = setupRenderer(canvas)
  const camera = new PerspectiveCamera(30, canvas.clientWidth / canvas.clientHeight, 0.01, 200)

  camera.up.set(0, 0, 1)

  const scene = new Scene()
  scene.add(...objects)

  const box = new Box3().expandByObject(scene)
  const center = box.getCenter(new Vector3())
  const radius = box.getBoundingSphere(new Sphere()).radius
  const defaultDistance = radius / Math.sin((Math.PI * camera.fov) / 360)
  const zoomedDistance = defaultDistance / zoom

  const spherical = new Spherical(zoomedDistance, Math.PI / 2 - phi, Math.PI + theta).makeSafe()
  const pos = new Vector3().setFromSpherical(spherical)

  camera.position.set(pos.x, pos.z, pos.y).add(center)
  camera.lookAt(center)

  renderer.render(scene, camera)
  const context = canvas.getContext("2d")
  context?.drawImage(renderer.domElement, 0, 0, 800, 800)

  renderer.dispose()
}

export const RENDER_CANVAS_RESOLUTION = 800

const backgroundColor = DARK_MODE ? "#222933" : "#f5f5f5"

function setupRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  if (!renderer) {
    const c = document.createElement("canvas")
    c.height = RENDER_CANVAS_RESOLUTION
    c.width = RENDER_CANVAS_RESOLUTION
    renderer = new WebGLRenderer({
      canvas: c,
      antialias: graphicsSettings.antialias,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(graphicsSettings.pixelRatio)
    renderer.setClearColor(new Color(backgroundColor))
  }
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

  return renderer
}
