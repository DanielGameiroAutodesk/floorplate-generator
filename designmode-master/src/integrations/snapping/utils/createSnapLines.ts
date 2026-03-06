import { Vector3 } from "three"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import { v4 as uuid } from "uuid"
import type { SnappingLine } from "src/integrations/snapping/snapping"

import { GeometryConstants } from "src/lib/three/geometryUtils"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"

const reusableLineDirection = new Vector3()

export function createExtendedAndRightAngleSnappingLines(
  lines: SnappingLine[],
  terrain: TerrainSamplerData | undefined,
): SnappingLine[] {
  const extensions: SnappingLine[] = lines.flatMap((line) => {
    reusableLineDirection.subVectors(line.end, line.start).normalize().multiplyScalar(500)

    const startExtension = new Vector3().subVectors(line.start, reusableLineDirection)
    const endExtension = new Vector3().addVectors(line.end, reusableLineDirection)
    return [snappingLineFromEndpoints(startExtension, endExtension, "LINE_EXTENSION", line.onTerrain, terrain)]
  })

  return lines.concat(extensions) //.concat(orthogonal)
}

export const createOrthogonalId = (l: SnappingLine) => `${l.shapeId || uuid()}_ORTHOGONAL`

export const createOrthogonalSnappingLine = (
  l: SnappingLine,
  pos: Vector3,
  terrainBin: TerrainSamplerData | undefined,
  shapeId: string,
) => {
  const direction = new Vector3()
    .subVectors(l.end, l.start)
    .normalize()
    .multiplyScalar(500)
    .applyAxisAngle(GeometryConstants.UP, Math.PI / 2)
  return snappingLineFromEndpoints(
    pos.clone().sub(direction),
    pos.clone().add(direction),
    "ORTHOGONAL",
    l.onTerrain,
    terrainBin,
    shapeId,
  )
}
