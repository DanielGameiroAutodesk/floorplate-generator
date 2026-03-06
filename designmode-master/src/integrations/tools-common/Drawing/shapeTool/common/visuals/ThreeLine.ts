import { Line2 } from "three/addons/lines/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { Vector3 } from "three"
import { AlwaysDepth, Color, Object3D } from "three"
import { colors } from "src/lib/colors"
import { screenResolutionVector } from "src/core/three/sceneManager"

const MATERIAL = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

export class ThreeLine extends Object3D {
  get line(): Line2 {
    return this._line
  }

  private material: LineMaterial

  public vertices!: Vector3[]
  private _line: Line2

  constructor(vertices: Vector3[], material: LineMaterial = MATERIAL) {
    super()
    this.material = material

    const mesh = this.lineFromVertices(vertices)
    this._line = mesh
    this.setLine(mesh)
    this.updateLine(vertices)
  }

  public setMaterial(mat: LineMaterial) {
    this.material = mat
    this._line.material = mat
  }

  private lineFromVertices(vertices: Vector3[]): Line2 {
    this.vertices = vertices

    let geom = new LineGeometry()
    if (vertices.length < 2) {
      geom.setPositions([0, 0, 0, 0, 0, 0])
      return new Line2(geom, this.material)
    }

    const positions = new Float32Array(vertices.flatMap((v) => [v.x, v.y, v.z]))

    const lg = geom
    lg.setPositions(positions)

    const line = new Line2(lg, this.material)
    line.renderOrder = 1
    return line
  }

  updateLine = (newVertices: Vector3[]): ThreeLine => {
    this.setLine(this.lineFromVertices(newVertices))
    this.vertices = newVertices
    return this
  }

  private setLine(line: Line2): void {
    this.disposeLine()

    this._line = line
    line.computeLineDistances()
    this.add(line)
  }

  private disposeLine(): void {
    this.remove(this._line)
    this.line.geometry.dispose()
  }

  dispose() {
    this.parent?.remove(this)
    this.disposeLine()
  }
}
