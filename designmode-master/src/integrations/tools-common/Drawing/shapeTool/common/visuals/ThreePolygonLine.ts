import type { Vector3 } from "three"
import { AlwaysDepth, Color, Object3D } from "three"
import { Line2 } from "three/addons/lines/Line2.js"
import { LineGeometry } from "three/addons/lines/LineGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { closePolygon } from "src/lib/three/polygon"
import { colors } from "src/lib/colors"

export const DEFAULT_MATERIAL = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

export class ThreePolygonLine extends Object3D {
  private material: LineMaterial
  get line(): Line2 {
    return this._line
  }
  private _line: Line2
  public polygon!: Vector3[]
  private readonly closed: boolean
  private _renderOrder: number

  constructor(polygon: Vector3[], closed: boolean = true, material = DEFAULT_MATERIAL, renderOrder = 1) {
    super()
    this.material = material
    this.closed = closed
    const mesh = this.lineFromPolygon(polygon)
    this._line = mesh
    this.setLine(mesh)
    this.updatePolygon(polygon)
    this._renderOrder = renderOrder
  }

  private setLine(line: Line2): void {
    this.disposeLine()

    this._line = line
    this.add(line)
  }

  private lineFromPolygon(polygon: Vector3[]): Line2 {
    this.polygon = polygon
    if (polygon.length < 2) {
      const geom = new LineGeometry()
      geom.setPositions([0, 0, 0, 0, 0, 0])
      return new Line2(geom, this.material)
    }

    if (this.closed) {
      closePolygon(polygon)
    }

    const positions = new Float32Array(polygon.flatMap((v) => [v.x, v.y, v.z]))
    const lg = new LineGeometry()
    lg.setPositions(positions)

    const line = new Line2(lg, this.material)

    if (this.material.defines.USE_DASH !== undefined) {
      //https://discourse.threejs.org/t/dashed-line2-material/10825
      line.computeLineDistances()
    }

    line.renderOrder = this._renderOrder
    return line
  }

  updatePolygon = (newPolygon: Vector3[]): ThreePolygonLine => {
    this.setLine(this.lineFromPolygon(newPolygon))
    this.polygon = newPolygon
    return this
  }

  setMaterial = (newMaterial: LineMaterial) => {
    this.material = newMaterial
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
