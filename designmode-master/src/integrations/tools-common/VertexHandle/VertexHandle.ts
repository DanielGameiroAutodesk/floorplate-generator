import { Object3D, OrthographicCamera, Vector3 } from "three"
import { getScalingCoefficients } from "src/lib/three/scaling"
import { GenericNode } from "./GenericNode/GenericNode"
import sceneManager from "src/core/three/sceneManager"

export default class VertexHandle extends Object3D {
  private readonly node: GenericNode

  constructor(position: Vector3) {
    super()
    this.node = new GenericNode(new Vector3())
    this.position.copy(position)
    this.add(this.node)
    this.updateWorldMatrix(false, true) //Without this we cannot calculate distance to camera correctly, making the handle the wrong size in some cases.
    sceneManager.controls.addEventListener("change", this.cameraChanged)
    this.cameraChanged()
    this.name = "Vertex Handle"
  }

  public moveTo(pos: Vector3): void {
    this.position.copy(pos)
  }

  public hover(): void {
    this.node.hover()
  }

  public snapActive(): void {
    this.node.snapActive()
  }

  public snapPassive(): void {
    this.node.snapPassive()
  }

  public unHover(): void {
    this.node.reset()
  }

  dispose(): void {
    this.parent?.remove(this)
    this.node.dispose()
    sceneManager.controls.removeEventListener("change", this.cameraChanged)
  }

  private cameraChanged = () => {
    const { camera } = sceneManager
    const { perspective, orthographic } = getScalingCoefficients()

    if (camera instanceof OrthographicCamera) {
      const scale = orthographic / camera.zoom
      this.scale.set(scale, scale, 1)
    } else {
      this.scale.set(perspective, perspective, 1)
    }
    this.updateWorldMatrix(false, true) //Without this we cannot calculate distance to camera correctly, making the handle the wrong size in some cases.
    sceneManager.render()
  }
}
