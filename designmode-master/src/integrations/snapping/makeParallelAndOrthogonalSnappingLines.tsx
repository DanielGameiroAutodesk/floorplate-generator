import type { SnappingLine } from "./snapping"
import { Vector3 } from "three"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { snappingLineFromEndpoints } from "./snappingEngineHelpers"

export function makeParallelAndOrthogonalSnappingLines(
  selectedDerivedLines: SnappingLine[],
  startOfCurrentLine: Vector3,
  terrainBin: TerrainSamplerData,
) {
  const direction = new Vector3()

  const isBaseLine = (l: SnappingLine) => ["LINE", "LINE_EXTENSION", "CENTER_ORTHOGONAL"].includes(l.type)

  const parallellLines: SnappingLine[] = selectedDerivedLines.filter(isBaseLine).map((l) => {
    direction.subVectors(l.end, l.start).normalize().multiplyScalar(500)
    let snappingLine = snappingLineFromEndpoints(
      startOfCurrentLine.clone().sub(direction),
      startOfCurrentLine.clone().add(direction),
      "PARALLEL",
      l.onTerrain,
      terrainBin,
      undefined,
      [l],
    )
    return snappingLine
  })

  const orthogonalLines: SnappingLine[] = selectedDerivedLines.filter(isBaseLine).map((l) => {
    const direction = new Vector3()
      .subVectors(l.end, l.start)
      .normalize()
      .multiplyScalar(500)
      .applyAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)
    return snappingLineFromEndpoints(
      startOfCurrentLine.clone().sub(direction),
      startOfCurrentLine.clone().add(direction),
      "ORTHOGONAL",
      l.onTerrain,
      terrainBin,
      undefined,
      [l],
    )
  })
  return parallellLines.concat(orthogonalLines)
}
