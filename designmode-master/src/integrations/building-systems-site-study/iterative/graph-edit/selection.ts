import { Vector3 } from "three"

import { mousePosition } from "src/core/useMousePosition"
import { minBy } from "src/lib/array"
import { pixelsToMetersAtPosition } from "src/lib/three/pixels-to-meters-at-position"
import sceneManager from "src/core/three/sceneManager"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

import { SNAPPING_SENSITIVITY } from "src/integrations/snapping/constants"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"

const NUMERICAL_PRECISION = 0.00001
const HOVER_BUFFER = 20

type Edge = { start: string; end: string; id: string }
type Vertex = { x: number; y: number; id: string }

export type WallGraph = {
  edges: Record<string, Edge>
  vertices: { [key: string]: Vertex }
}

type SelectableVertex = { id: string; position: Vector3 }
type SelectableEdge = { id: string; position: [Vector3, Vector3] }

type HoveredVertex = { type: "vertex"; id: string }
type HoveredEdge = { type: "edge"; id: string }

export type HoveredItem = HoveredVertex | HoveredEdge

function getHoveredVertex(vertices: SelectableVertex[]): HoveredVertex | undefined {
  const ray = mousePosition.ray
  const verticesWithDistances = vertices.map((vertex) => ({
    vertex: vertex,
    distanceSq: ray.distanceSqToPoint(vertex.position),
  }))
  if (verticesWithDistances.length === 0) return undefined
  verticesWithDistances.sort((a, b) => a.distanceSq - b.distanceSq)
  const closestToPoint = verticesWithDistances[0]
  const candidates = verticesWithDistances
    .filter((v) => closestToPoint.distanceSq + NUMERICAL_PRECISION > v.distanceSq)
    .map((v) => ({ ...v, distanceToCamera: ray.origin.distanceTo(v.vertex.position) }))
  const closest = minBy(candidates, (dist) => dist.distanceToCamera)
  if (closest && closest.distanceSq <= snappingDistanceAtPosition(closest.vertex.position) + HOVER_BUFFER) {
    return { type: "vertex", id: closest.vertex.id }
  }
}

function getHoveredEdge(edges: SelectableEdge[]): HoveredEdge | undefined {
  let candidates = []
  for (let edge of edges) {
    const posOnSegment = new Vector3()
    const distanceSq = mousePosition.ray.distanceSqToSegment(edge.position[0], edge.position[1], posOnSegment)
    if (distanceSq < snappingDistanceAtPosition(posOnSegment) + HOVER_BUFFER) {
      candidates.push({ edge, distanceSq, position: posOnSegment })
    }
  }
  const closest = minBy(candidates, (ss) => ss.distanceSq)
  if (closest) {
    return { type: "edge", id: closest.edge.id }
  }
}

export function getHoveredItem(g: WallGraph): HoveredItem | undefined {
  const getZ = ({ x, y }: { x: number; y: number }) => new Vector3(x, y, terrainSignal.peek().elevationAt(x, y))

  const hoveredVertex = getHoveredVertex(Object.entries(g.vertices).map(([id, v]) => ({ id, position: getZ(v) })))
  if (hoveredVertex) return hoveredVertex

  const hoveredEdge = getHoveredEdge(
    Object.entries(g.edges).map(([id, e]) => ({
      id,
      position: [getZ(g.vertices[e.start]), getZ(g.vertices[e.end])],
    })),
  )
  if (hoveredEdge) return hoveredEdge
}

export function getMousePoint(): Vector3 | undefined {
  const raycastResult = raycastApi.raycastTerrain()
  if (!raycastResult) return undefined
  return new Vector3(raycastResult.position.x, raycastResult.position.y, raycastResult.position.z)
}

export function snappingDistanceAtPosition(position: Vector3): number {
  return pixelsToMetersAtPosition(SNAPPING_SENSITIVITY, sceneManager.camera, position)
}
