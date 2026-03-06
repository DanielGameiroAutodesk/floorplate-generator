import type { Vector2 } from "three"
import { Color, Group, type Matrix4, Mesh, Vector3 } from "three"
import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js"
import { generateOutlines2d } from "src/integrations/transportation/glue"
import type { TransportationElement } from "src/integrations/transportation/lib/transportationApi"
import type { TerrainSamplerData } from "src/core/terrain/terrain-types"
import { raycast, type PrepassData } from "src/core/terrain/2d-raytracer"
import transportationApi from "src/integrations/transportation/lib/transportationApi"
import { get2dTransform } from "src/integrations/transportation/utils"
import { colors } from "src/lib/colors"

const controlLinesMaterial = new LineMaterial({
  color: new Color("#808080"),
  depthTest: false,
  linewidth: 2,
  resolution: screenResolutionVector,
})

export function getLinesAndPointsMesh(
  controlPoints: { position: Vector3; id: string }[],
  hoveredPointId: string | undefined,
) {
  const positions = controlPoints
    .slice(1)
    .flatMap((v, i) => [...controlPoints[i].position.toArray(), ...v.position.toArray()])
  const lineGeometry = new LineSegmentsGeometry()
  lineGeometry.setPositions(positions)
  const lineSegmentsMesh = new LineSegments2(lineGeometry, controlLinesMaterial)
  const points = controlPoints.map((v) => {
    if (hoveredPointId === v.id) {
      const vh = new VertexHandle(v.position)
      vh.hover()
      return vh
    }
    return new VertexHandle(v.position)
  })
  return new Group().add(lineSegmentsMesh, ...points)
}

const outlineMaterial = new LineMaterial({
  color: new Color("#006EAF"),
  depthTest: false,
  linewidth: 2,
  resolution: screenResolutionVector,
})

// We need to add the center line outline while in preview because the old actionAPI.preview hides all the geometry and does not support outlines as input on update. Will probably remove when new preview elements is ready for new state.
export function generateCenterLineVisualsTempHack(
  element: TransportationElement,
  globalMatrix: Matrix4,
  terrainSamplerData: TerrainSamplerData,
) {
  const outlines = generateOutlines2d(element, globalMatrix, terrainSamplerData)
  const geometry = new LineSegmentsGeometry().setPositions(outlines)

  return new Group().add(new Mesh(geometry, outlineMaterial))
}

const separationLinesMaterial = new LineMaterial({
  color: new Color(colors.gray30),
  depthTest: false,
  linewidth: 2,
  resolution: screenResolutionVector,
})

const getLinesOnTerrainGeometry = (lineSegments: [Vector2, Vector2][], terrainSamplerData: TerrainSamplerData) => {
  const endPointSegmentsSubdivided = lineSegments.map((segment) => {
    const resolution = 1
    const distance = segment[0].distanceTo(segment[1])
    const numSegments = Math.ceil(distance / resolution)
    const points = []
    for (let i = 0; i <= numSegments; i++) {
      const point = segment[0].clone().lerp(segment[1], i / numSegments)
      points.push(point)
    }
    return points
  })
  const withElevation = endPointSegmentsSubdivided.map((segment) =>
    segment.map((v) => new Vector3(v.x, v.y, raycast(v.x, v.y, terrainSamplerData))),
  )
  const toSubSegments = withElevation.flatMap((segment) => segment.slice(1).map((v, i) => [segment[i], v]))
  const positions = toSubSegments.map(([start, end]) => [...start.toArray(), ...end.toArray()]).flat()
  const lineGeometry = new LineSegmentsGeometry()
  lineGeometry.setPositions(positions)
  return lineGeometry
}

export function getCurveSeparationLines(
  element: TransportationElement,
  terrainSamplerData: PrepassData,
  transform: Matrix4,
): Mesh {
  const endPointSegments = transportationApi.getCurveEndPointSeparationSegments(element)
  const transform2d = get2dTransform(transform)
  const endPointSegmentsTransformed: [Vector2, Vector2][] = endPointSegments.map((segment) => [
    segment[0].clone().applyMatrix3(transform2d),
    segment[1].clone().applyMatrix3(transform2d),
  ])
  const geometry = getLinesOnTerrainGeometry(endPointSegmentsTransformed, terrainSamplerData)
  return new Mesh(geometry, separationLinesMaterial)
}
