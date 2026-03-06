import type { Matrix4 } from "three"
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Vector2,
  Vector3,
} from "three"

import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import type { Selection } from "src/integrations/composition-site-graph/state"
import { dispose } from "src/core/three/useObjectLifecycle"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { colors } from "src/lib/colors"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { Graph, Id } from "src/integrations/composition-site-graph/graph/types"
import earcut from "earcut"
import { _getCoEdgeVertices } from "src/integrations/composition-site-graph/graph/coEdge"
import { getElevationInLocalCoordinateSystem, getGlobalTerrainPosition } from "./getGlobalTerrainPosition"
import { objectKeys } from "src/lib/record"

const polygonMaterial = new MeshBasicMaterial({
  color: new Color(0xff0000),
  depthTest: false,
  transparent: true,
  opacity: 0.1,
  //side: DoubleSide,
})

const CO_EDGE_MATERIAL = new MeshBasicMaterial({
  vertexColors: true,
  depthTest: false,
  transparent: true,
  opacity: 1,
})

const VERTEX_COLORS_BY_ID = false
const DEFAULT_EDGE_COLOR = new Color(colors.borderAccent)
const HOVERED_EDGE_COLOR = new Color(colors.blue70)
const SELECTED_EDGE_COLOR = new Color(colors.red70)

const EDGE_SELECTION_ENABLED = false
const COEDGE_SELECTED_ENABLED = false

const material = new LineMaterial({
  vertexColors: true,
  depthTest: false,
  linewidth: 2,
  resolution: screenResolutionVector,
})
const colorMap = new Map<Id, Color>()

export class GraphMesh extends Object3D {
  private graph: Graph
  private getElevationGlobal: (x: number, y: number) => number

  private vertexHandels: VertexHandle[] = []
  private lineMesh: LineSegments2 | undefined

  private polygonMesh: Mesh | undefined
  private coEdgeMesh: Mesh | undefined

  private selectionState: Selection[] = []
  private hoverState: Selection[] = []

  private readonly transform: Matrix4

  get selection() {
    return this.selectionState
  }

  get hover() {
    return this.hoverState
  }

  constructor(graph: Graph, getElevation: (x: number, y: number) => number, transform: Matrix4) {
    super()
    this.graph = graph
    this.transform = transform
    //this.group.applyMatrix4(this.transform)

    this.getElevationGlobal = getElevation
    this.updateVisuals()
  }

  update(graph: Graph, selection?: Selection[], hover?: Selection[]) {
    this.graph = graph
    if (selection) this.selectionState = selection
    if (hover) this.hoverState = hover
    this.updateVisuals()
  }

  updateHover(hover: Selection[]) {
    this.hoverState = hover
    this.updateVisuals()
  }

  private updateVisuals() {
    // Vertices
    for (let i = this.vertexHandels.length - 1; i >= 0; i--) {
      const v = this.vertexHandels[i]
      this.remove(v)
      this.vertexHandels.pop()
      v.dispose()
    }

    Object.entries(this.graph._vertices)
      //.filter((v) => !v.virtual)
      .forEach(([key, v]) => {
        if (v.type === "virtual") return
        if (v.type === "vertex" && v.locked) return
        const vh = new VertexHandle(getGlobalTerrainPosition(v, this.transform, this.getElevationGlobal))
        if (v.type === "intersection") {
          vh.snapPassive()
        }
        if (this.hoverState.some((s) => s.id === key)) {
          vh.snapActive()
        }
        this.vertexHandels.push(vh)
      })

    this.vertexHandels.forEach((v) => this.add(v))

    // Edges
    if (this.lineMesh) {
      this.remove(this.lineMesh)
      dispose(this.lineMesh)
    }

    const geom = new LineSegmentsGeometry()
    this.lineMesh = new LineSegments2(geom, material)
    this.add(this.lineMesh)

    let positions: number[] = []
    let colors: number[] = []
    for (let [eid, e] of Object.entries(this.graph.edges)) {
      if (VERTEX_COLORS_BY_ID && !colorMap.has(eid)) {
        const hex = Math.floor(Math.random() * 16777215)
        colorMap.set(eid, new Color(hex))
      }

      const a = this.graph._vertices[e.start]
      const b = this.graph._vertices[e.end]

      const vec_a = new Vector2(a.x, a.y)
      const vec_b = new Vector2(b.x, b.y)

      const diff = vec_b.clone().sub(vec_a)
      const dist = diff.length()
      const LENGTH_PER_SEGMENT = 1
      const segments = Math.ceil(dist / LENGTH_PER_SEGMENT)
      const distPerSegment = dist / segments

      for (let i = 0; i < segments; i++) {
        const p0 = vec_a.clone().add(diff.clone().setLength(distPerSegment * i))
        const p1 = vec_a.clone().add(diff.clone().setLength(distPerSegment * (i + 1)))
        positions.push(...getGlobalTerrainPosition(p0, this.transform, this.getElevationGlobal).toArray())
        positions.push(...getGlobalTerrainPosition(p1, this.transform, this.getElevationGlobal).toArray())

        if (EDGE_SELECTION_ENABLED && this.hoverState.some((h) => h.type === "edge" && h.id === eid)) {
          colors.push(...HOVERED_EDGE_COLOR.toArray())
          colors.push(...HOVERED_EDGE_COLOR.toArray())
        } else if (EDGE_SELECTION_ENABLED && this.selectionState.some((h) => h.type === "edge" && h.id === eid)) {
          colors.push(...SELECTED_EDGE_COLOR.toArray())
          colors.push(...SELECTED_EDGE_COLOR.toArray())
        } else if (VERTEX_COLORS_BY_ID) {
          colors.push(...colorMap.get(eid)!.toArray())
          colors.push(...colorMap.get(eid)!.toArray())
        } else {
          colors.push(...DEFAULT_EDGE_COLOR.toArray())
          colors.push(...DEFAULT_EDGE_COLOR.toArray())
        }
      }
    }

    this.lineMesh.geometry.setPositions(positions)
    this.lineMesh.geometry.setColors(colors)

    // Polygon

    if (this.polygonMesh) {
      this.remove(this.polygonMesh)
      dispose(this.polygonMesh)
    }

    const polygonGeo = new BufferGeometry()

    const pos: number[] = []
    const indices: number[] = []

    let indexOffset = 0

    for (let polygon of Object.values(this.graph._polygons)) {
      const loopId = polygon.loopIds[0]
      const loop = this.graph._loops[loopId]
      const vertices = loop.coEdgeIds.map((ce) => {
        const nextVertexId = _getCoEdgeVertices(this.graph, ce).end
        return this.graph._vertices[nextVertexId]
      })

      pos.push(
        ...vertices.flatMap((v) => [
          v.x,
          v.y,
          getElevationInLocalCoordinateSystem(v, this.transform, this.getElevationGlobal),
        ]),
      )

      const is = earcut(vertices.flatMap((v) => [v.x, v.y]))

      indices.push(...is.map((i) => i + indexOffset))
      indexOffset += vertices.length
    }

    polygonGeo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3))
    polygonGeo.setIndex(indices)

    this.polygonMesh = new Mesh(polygonGeo, polygonMaterial)
    //this.add(this.polygonMesh)

    // Co-edges
    if (this.coEdgeMesh) {
      this.remove(this.coEdgeMesh)
      dispose(this.coEdgeMesh)
    }

    const coEdgeGeo = new BufferGeometry()

    const coEdgePositions: Vector3[] = []
    const coEdgeColors: number[] = []
    const coEdgeIndices: number[] = []
    let currIndex = 0

    const selectedCoEdgeIds = this.selectionState.filter((s) => s.type === "co-edge").map((s) => s.id)
    const hoveredCoEdgeIds = this.hoverState.filter((s) => s.type === "co-edge").map((s) => s.id)

    for (let coEdgeId of objectKeys(this.graph._coEdges)) {
      const rectangle = getRectangleForCoEdge(this.graph, coEdgeId, (x: number, y: number) =>
        getElevationInLocalCoordinateSystem({ x, y }, this.transform, this.getElevationGlobal),
      )
      coEdgeIndices.push(...rectangle.indices.map((i) => i + currIndex))
      coEdgePositions.push(...rectangle.positions)
      if (COEDGE_SELECTED_ENABLED && hoveredCoEdgeIds.includes(coEdgeId)) {
        coEdgeColors.push(...rectangle.positions.flatMap(() => [0, 100, 100, 100]))
      } else if (COEDGE_SELECTED_ENABLED && selectedCoEdgeIds.includes(coEdgeId)) {
        coEdgeColors.push(...rectangle.positions.flatMap(() => [0, 0, 255, 150]))
      } else {
        coEdgeColors.push(...rectangle.positions.flatMap(() => [0, 0, 0, 0]))
      }

      currIndex += rectangle.positions.length
    }

    coEdgeGeo.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(coEdgePositions.flatMap((p) => p.toArray())), 3),
    )
    coEdgeGeo.setIndex(coEdgeIndices)
    coEdgeGeo.setAttribute("color", new BufferAttribute(new Uint8Array(coEdgeColors), 4, true))

    this.coEdgeMesh = new Mesh(coEdgeGeo, CO_EDGE_MATERIAL)
    this.add(this.coEdgeMesh)

    sceneManager.render()
  }
}

const bufferGeo = new BufferGeometry()

export const coEdgeHitMesh = new Mesh(
  bufferGeo,
  new MeshLambertMaterial({
    color: new Color(0xff0000),
    depthTest: false,
    transparent: true,
    opacity: 0.2,
  }),
)

const EDGE_DISTANCE_SIZE = 8

function getRectangleForCoEdge(
  state: Graph,
  coEdgeId: Id,
  getZ: (x: number, y: number) => number,
): { positions: Vector3[]; indices: number[] } {
  const coEdge = state._coEdges[coEdgeId]
  const edgeId = coEdge.edgeId
  const edge = state._edges[edgeId]

  const startVertexId = coEdge.reverse ? edge.end : edge.start
  const endVertexId = coEdge.reverse ? edge.start : edge.end

  const start = state._vertices[startVertexId]
  const end = state._vertices[endVertexId]

  const startVec = new Vector3(start.x, start.y, getZ(start.x, start.y))
  const endVec = new Vector3(end.x, end.y, getZ(end.x, end.y))

  const diffVec = endVec.clone().sub(startVec).setZ(0).normalize()
  const diffVecRotated = new Vector3(diffVec.y, -diffVec.x, 0)

  const startRight = startVec.clone().add(diffVecRotated.setLength(EDGE_DISTANCE_SIZE))
  const endRight = endVec.clone().add(diffVecRotated)

  return {
    positions: [startVec, endVec, startRight, endRight],
    indices: [0, 3, 1, 0, 2, 3],
  }
}

export function updateCoEdgeHitMesh(state: Graph, getZ: (x: number, y: number) => number) {
  const positions: Vector3[] = []
  const indices: number[] = []
  const edgeIdMapping: Id[] = []

  let currIndex = 0

  for (let coEdgeId of objectKeys(state._coEdges)) {
    const rectangle = getRectangleForCoEdge(state, coEdgeId, getZ)
    indices.push(...rectangle.indices.map((i) => i + currIndex))
    positions.push(...rectangle.positions)
    currIndex += rectangle.positions.length
    edgeIdMapping.push(coEdgeId)
  }

  bufferGeo.setAttribute("position", new BufferAttribute(new Float32Array(positions.flatMap((p) => p.toArray())), 3))
  bufferGeo.setIndex(indices)

  coEdgeHitMesh.userData["edgeIdMapping"] = edgeIdMapping
  bufferGeo.computeBoundingBox()
  bufferGeo.computeBoundingSphere()

  sceneManager.render()
}
