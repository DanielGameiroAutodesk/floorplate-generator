import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { AlwaysDepth, Color, Object3D, Vector3 } from "three"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { subdivideLine } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import ArrayUtils from "src/lib/array"
import type { Shape } from "src/lib/three/Shape/types"
import { colors } from "src/lib/colors"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { raycast } from "src/core/terrain/2d-raytracer"

export const THREE_SHAPE_MATERIAL = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

export class ThreeShape extends Object3D {
  private terrainSamplerData?: TerrainSamplerData
  get line(): LineSegments2 {
    return this._line
  }

  private material: LineMaterial

  public shape!: Shape
  private _line: LineSegments2
  private onTerrain: boolean

  constructor(
    shape: Shape,
    outlineMaterial: LineMaterial = THREE_SHAPE_MATERIAL,
    onTerrain = false,
    terrainSamplerData?: TerrainSamplerData,
  ) {
    super()
    this.terrainSamplerData = terrainSamplerData

    this.material = outlineMaterial
    this.onTerrain = onTerrain

    this.shape = shape
    const mesh = this.lineFromShape(shape)
    this._line = mesh
    this._line.computeLineDistances()
    this.add(mesh)
  }

  public setMaterial(mat: LineMaterial) {
    this.material = mat
    this._line.material = mat
  }

  private lineFromShape(shape: Shape): LineSegments2 {
    this.shape = shape

    let geom = new LineSegmentsGeometry()
    if (shape.vertices.length < 2) {
      geom.setPositions([0, 0, 0, 0, 0, 0])
      return new LineSegments2(geom, this.material)
    }

    let positions: number[] = []

    const project = (v: Vector3) => {
      let z = this.terrainSamplerData ? raycast(v.x, v.y, this.terrainSamplerData) : v.z
      return new Vector3(v.x, v.y, z)
    }

    for (const [start, end] of shape.edges) {
      const from = shape.vertices[start]
      const to = shape.vertices[end]
      if (!from || !to) {
        console.error("Illegal edge, refers to non-existent vertices", {
          edge: [start, end],
          vertices: shape.vertices,
        })
      }
      let line = [from, to]
      if (this.onTerrain) {
        const subDivisionLength = pixelsToMetersAtPosition(20, sceneManager.camera, from)
        line = subdivideLine(line, subDivisionLength).map(project)
      }

      positions = positions.concat(
        ArrayUtils.sliding2(line).flatMap(([v1, v2]) => [v1.x, v1.y, v1.z, v2.x, v2.y, v2.z]),
      )
    }
    geom.setPositions(positions)

    const line = new LineSegments2(geom, this.material)
    line.renderOrder = 1
    return line
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
