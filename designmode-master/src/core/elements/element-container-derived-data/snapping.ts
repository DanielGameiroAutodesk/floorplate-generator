import type { ElementContainer } from "src/core/elements/ElementContainer"
import ArrayUtils, { isDefined } from "src/lib/array"
import { parseUrn } from "src/lib/element/urn"
import { Box3 } from "three"
import { edgesPositionFromBox3 } from "src/lib/three/geometryUtils"
import type { Feature } from "geojson"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { getRegisteredElementSystem } from "src/core/element-systems"

export const snappingLinesController = createDerivedDataController(createSnappingLines)

export type PartialSnappingLine = PartialSnappingLine2D | PartialSnappingLine3D

type PartialSnappingLine2D = {
  start: [number, number]
  end: [number, number]
  onTerrain: true
}

type PartialSnappingLine3D = {
  start: [number, number, number]
  end: [number, number, number]
  onTerrain: false
}

const SNAPPING_LINES_THRESHOLD = 6 * 20_000 // 6 floats per snapping line

function createSnappingLines(container: ElementContainer): PartialSnappingLine[] {
  if (isDefined(getRegisteredElementSystem(parseUrn(container.element.urn).system)?.generateSnappingLines)) {
    const customSnappingLines = calculateCustomSnappingLines(container)
    if (customSnappingLines) return customSnappingLines
  }
  if (parseUrn(container.element.urn).system === "terrain") return []

  const footprint = container.representations.footprint
  // assume that if an element has some 2d geometry, then that's all it consists of (i.e. no mixed terrain and non-terrain stuff in one element)
  // kjetils comment: is this a good assumption? If we want to condone gathering geometry + logic in one element, it seems we should not have assumptions like this in core code, as these will force people splitting elements up when they don't want to
  if (footprint && !container.representations.volumeMesh) {
    return calculateSnappingLinesForFootprint(footprint)
  }
  const outlines = container.outlines.getOrCompute()
  if (outlines && outlines.length < SNAPPING_LINES_THRESHOLD) {
    return calculateSnappingLinesFromEdges(outlines)
  }

  const elementBbox = container.bbox.getOrCompute()
  if (elementBbox && elementBbox instanceof Box3) {
    const edges = edgesPositionFromBox3(elementBbox)
    return calculateSnappingLinesFromEdges(edges)
  }
  return []
}

function calculateCustomSnappingLines(container: ElementContainer): PartialSnappingLine[] | undefined {
  const system = getRegisteredElementSystem(parseUrn(container.element.urn).system)
  if (!system || !system.generateSnappingLines) return
  return system.generateSnappingLines(container.element)
}

function calculateSnappingLinesForFootprint(footprint: Feature): PartialSnappingLine2D[] {
  if (
    (footprint.geometry.type !== "Polygon" && footprint.geometry.type !== "LineString") ||
    footprint.properties?.height !== undefined //Legacy check for 2.5D basic elements. These shouldn't have footprint AND volumeMesh.
  )
    return []
  const loop =
    footprint.geometry.type === "Polygon" ? footprint.geometry.coordinates[0] : footprint.geometry.coordinates
  return ArrayUtils.sliding2(loop.map(([x, y]): [number, number] => [x, y])).map(
    ([start, end]): PartialSnappingLine2D => ({ start, end, onTerrain: true }),
  )
}

function calculateSnappingLinesFromEdges(edgesPositions: Float32Array): PartialSnappingLine3D[] {
  const snappingLines: PartialSnappingLine3D[] = []
  const numbersPerEdge = 6 // 3 numbers per vertex * 2 vertexes per edge
  for (let i = 0; i < edgesPositions.length; i += numbersPerEdge) {
    snappingLines.push({
      start: [edgesPositions[i], edgesPositions[i + 1], edgesPositions[i + 2]],
      end: [edgesPositions[i + 3], edgesPositions[i + 4], edgesPositions[i + 5]],
      onTerrain: false,
    })
  }
  return snappingLines
}
