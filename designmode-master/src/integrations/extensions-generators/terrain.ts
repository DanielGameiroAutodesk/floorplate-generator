import type { BufferGeometry, Object3D } from "three"
import { Box3, EdgesGeometry, Matrix4, Mesh, Vector3 } from "three"
import {
  derivePointsAlongExterior,
  getBottomLinesAndPoints,
  getLowestTerrainElevationForPoints,
} from "src/integrations/snapping/snapping-lib"
import { TERRAIN_LENGTH_THRESHOLD } from "src/integrations/tools-common/PlaceMode/notifyLargeScaledGeometries"

function getLines(object: Object3D) {
  const lines: { v1: Vector3; v2: Vector3 }[] = []

  object.traverse((_child) => {
    if (_child instanceof Mesh) {
      const child: Mesh<BufferGeometry> = _child
      const edges = new EdgesGeometry(child.geometry)
      const edgesPositions = edges.attributes.position.array as Float32Array

      const numbersPerEdge = 6 // 3 numbers per vertex * 2 vertexes per edge
      for (let i = 0; i < edgesPositions.length; i += numbersPerEdge) {
        const v1 = new Vector3(edgesPositions[i], edgesPositions[i + 1], edgesPositions[i + 2])
        const v2 = new Vector3(edgesPositions[i + 3], edgesPositions[i + 4], edgesPositions[i + 5])
        lines.push({ v1, v2 })
      }
    }
  })

  return lines
}

export function getObjectTransformOnTerrain(object: Object3D, getElevation: (x: number, y: number) => number) {
  const translation = new Vector3()
  const boxedObj = new Box3().setFromObject(object)
  const currentElevation = boxedObj.min.z

  if (boxedObj.isEmpty()) {
    return
  }

  // Move model so it starts at the bottom.
  translation.setZ(-currentElevation)

  const { bottomLines, bottomPoints } = getBottomLinesAndPoints({
    lines: getLines(object),
  })
  const pointsAtBottom = derivePointsAlongExterior({
    lines: bottomLines,
    points: bottomPoints,
    sampleMaxDistance: TERRAIN_LENGTH_THRESHOLD,
  })
  const lowestElevation = getLowestTerrainElevationForPoints(pointsAtBottom, getElevation)

  translation.add(new Vector3(0, 0, (lowestElevation ?? 0) - currentElevation))
  return new Matrix4().makeTranslation(translation.x, translation.y, translation.z)
}
