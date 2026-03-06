import type { ChildNodeContainer } from "src/core/elements/ChildNodeContainer"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import type { PartialSnappingLine } from "src/core/elements/element-container-derived-data/snapping"
import type { Matrix4 } from "three"
import { Box3, Vector3 } from "three"
import { raycast } from "src/core/terrain/2d-raytracer"
import { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import ArrayUtils from "src/lib/array"
// eslint-disable-next-line import/no-restricted-paths
import { subdivideLine } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/polygon"
import { createParameterizedDerivedDataController } from "src/core/elements/derived-data/derived-data"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"

export const snappingLinesController = createParameterizedDerivedDataController(computeSnappingLines)
export const bboxOctreeSnappingLinesController =
  createParameterizedDerivedDataController(computeBboxOctreeSnappingLines)

function computeSnappingLines(terrainSamplerData: TerrainSamplerData) {
  return function (node: ChildNodeContainer): SnappingLine[] {
    const partialSnappingLines = node.elementContainer.snappingLines.getOrCompute()

    return partialSnappingLines
      .map((partialSnappingLine) => transformedSnappingLine(partialSnappingLine, node.globalMatrix))
      .map((psl) =>
        snappingLineFromPartialSnappingLine(
          psl,
          (x: number, y: number) => raycast(x, y, terrainSamplerData),
          node.path,
        ),
      )
  }
}

function computeBboxOctreeSnappingLines(terrainSamplerData: TerrainSamplerData) {
  return (node: ChildNodeContainer): BBoxOctree<SnappingLine> => {
    const octree = new BBoxOctree<SnappingLine>()
    const snappingLines = node.snappingLines(terrainSamplerData).getOrCompute()
    snappingLines?.forEach((l) => {
      l.segments.map((s) => octree.set(s.bbox, l))
    })
    return octree
  }
}

export function transformedSnappingLine(
  partialSnappingLine: PartialSnappingLine,
  globalTransform: Matrix4,
): PartialSnappingLine {
  if (partialSnappingLine.onTerrain) {
    const start = new Vector3(partialSnappingLine.start[0], partialSnappingLine.start[1], 0).applyMatrix4(
      globalTransform,
    )
    const end = new Vector3(partialSnappingLine.end[0], partialSnappingLine.end[1], 0).applyMatrix4(globalTransform)
    return {
      start: [start.x, start.y],
      end: [end.x, end.y],
      onTerrain: true,
    }
  }
  return {
    start: new Vector3(partialSnappingLine.start[0], partialSnappingLine.start[1], partialSnappingLine.start[2] ?? 0)
      .applyMatrix4(globalTransform)
      .toArray(),
    end: new Vector3(partialSnappingLine.end[0], partialSnappingLine.end[1], partialSnappingLine.end[2] ?? 0)
      .applyMatrix4(globalTransform)
      .toArray(),
    onTerrain: false,
  }
}

export function snappingLineFromPartialSnappingLine(
  partialSnappingLine: PartialSnappingLine,
  elevationAt: (x: number, y: number) => number,
  shapeId: string,
): SnappingLine {
  if (partialSnappingLine.onTerrain) {
    return {
      type: "LINE",
      start: new Vector3(
        partialSnappingLine.start[0],
        partialSnappingLine.start[1],
        elevationAt(partialSnappingLine.start[0], partialSnappingLine.start[1]),
      ),
      end: new Vector3(
        partialSnappingLine.end[0],
        partialSnappingLine.end[1],
        elevationAt(partialSnappingLine.end[0], partialSnappingLine.end[1]),
      ),
      center: new Vector3(
        (partialSnappingLine.start[0] + partialSnappingLine.end[0]) / 2,
        (partialSnappingLine.start[1] + partialSnappingLine.end[1]) / 2,
        elevationAt(
          (partialSnappingLine.start[0] + partialSnappingLine.end[0]) / 2,
          (partialSnappingLine.start[1] + partialSnappingLine.end[1]) / 2,
        ),
      ),
      onTerrain: true,
      segments:
        ArrayUtils.sliding2(
          subdivideLine([new Vector3(...partialSnappingLine.start), new Vector3(...partialSnappingLine.end)], 2),
        ).map(([start, end]) => {
          start.setZ(elevationAt(start.x, start.y))
          end.setZ(elevationAt(end.x, end.y))
          return {
            start,
            end,
            bbox: new Box3(start, end),
          }
        }) ?? [],
      shapeId,
      refLines: [],
    }
  } else {
    const start = new Vector3(partialSnappingLine.start[0], partialSnappingLine.start[1], partialSnappingLine.start[2])
    const end = new Vector3(partialSnappingLine.end[0], partialSnappingLine.end[1], partialSnappingLine.end[2])
    return {
      type: "LINE",
      start,
      end,
      center: new Vector3(
        (partialSnappingLine.start[0] + partialSnappingLine.end[0]) / 2,
        (partialSnappingLine.start[1] + partialSnappingLine.end[1]) / 2,
        (partialSnappingLine.start[2] + partialSnappingLine.end[2]) / 2,
      ),
      onTerrain: false,
      segments: [{ start, end, bbox: new Box3().expandByPoint(start).expandByPoint(end).expandByScalar(0.1) }],
      shapeId,
      refLines: [],
    }
  }
}
