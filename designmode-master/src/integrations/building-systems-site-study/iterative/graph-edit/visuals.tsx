import { Color, Group, Vector2, Vector3 } from "three"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { useLayoutEffect, useMemo, useState } from "preact/hooks"

import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

import VertexHandle from "src/integrations/tools-common/VertexHandle/VertexHandle"

import type { HoveredItem, WallGraph } from "./selection"

type Point = { x: number; y: number }
type Line = [Point, Point]

const DEFAULT_EDGE_COLOR = new Color("#01FFEA")
const ACTIVE_EDGE_COLOR = new Color("#00E8E1")

const DEFAULT_EDGE_MATERIAL_PROPS = {
  vertexColors: true,
  depthTest: false,
  linewidth: 1,
  resolution: screenResolutionVector,
}
const defaultEdgeMaterial = new LineMaterial(DEFAULT_EDGE_MATERIAL_PROPS)
const activeEdgeMaterial = new LineMaterial({ ...DEFAULT_EDGE_MATERIAL_PROPS, linewidth: 3 })
const guidelineMaterial = new LineMaterial({ ...DEFAULT_EDGE_MATERIAL_PROPS, color: new Color("#E30288") })

const getZ = ({ x, y }: { x: number; y: number }) => new Vector3(x, y, terrainSignal.peek().elevationAt(x, y))

export function ExploreGraphVisuals({
  graph,
  selection = [],
  hover = [],
}: {
  graph: WallGraph
  selection: HoveredItem[]
  hover: HoveredItem[]
}) {
  const [vertexHandles, setVertexHandles] = useState<VertexHandle[]>([])

  useLayoutEffect(() => {
    // We need to manually dispose the old vertex handles when they are no longer needed, therefore
    // we do this part in a useEffect so we can use the cleanup function for that
    const newVertexHandles = Object.entries(graph.vertices).map(([key, v]) => {
      const vh = new VertexHandle(getZ(v))
      if (hover.some((h) => h.type === "vertex" && h.id === key)) vh.hover()
      if (selection.some((h) => h.type === "vertex" && h.id === key)) vh.snapActive()
      return vh
    })
    setVertexHandles(newVertexHandles)
    return () => newVertexHandles.forEach((handle) => handle.dispose())
  }, [graph, hover, selection])

  const [lineMesh, activeLineMesh] = useMemo(() => {
    let positions: number[] = []
    let colors: number[] = []
    let activePositions: number[] = []
    let activeColors: number[] = []
    for (let [eid, e] of Object.entries(graph.edges)) {
      const a = graph.vertices[e.start]
      const b = graph.vertices[e.end]

      const vec_a = new Vector2(a.x, a.y)
      const vec_b = new Vector2(b.x, b.y)

      const diff = vec_b.clone().sub(vec_a)
      const dist = diff.length()
      const LENGTH_PER_SEGMENT = 1
      const segments = Math.ceil(dist / LENGTH_PER_SEGMENT)
      const distPerSegment = dist / segments

      const activeEdge = [...hover, ...selection].some((h) => h.type === "edge" && h.id === eid)

      for (let i = 0; i < segments; i++) {
        const p0 = vec_a.clone().add(diff.clone().setLength(distPerSegment * i))
        const p1 = vec_a.clone().add(diff.clone().setLength(distPerSegment * (i + 1)))
        if (activeEdge) {
          activePositions.push(...getZ(p0).toArray(), ...getZ(p1).toArray())
          activeColors.push(...ACTIVE_EDGE_COLOR.toArray(), ...ACTIVE_EDGE_COLOR.toArray())
        } else {
          positions.push(...getZ(p0).toArray(), ...getZ(p1).toArray())
          colors.push(...DEFAULT_EDGE_COLOR.toArray(), ...DEFAULT_EDGE_COLOR.toArray())
        }
      }
    }

    const lineMesh = new LineSegments2(new LineSegmentsGeometry(), defaultEdgeMaterial)
    lineMesh.geometry.setPositions(positions)
    lineMesh.geometry.setColors(colors)
    const activeLineMesh = new LineSegments2(new LineSegmentsGeometry(), activeEdgeMaterial)
    activeLineMesh.geometry.setPositions(activePositions)
    activeLineMesh.geometry.setColors(activeColors)
    return [lineMesh, activeLineMesh]
  }, [graph, hover, selection])

  const group = useMemo(() => {
    return new Group().add(...vertexHandles, lineMesh).add(activeLineMesh)
  }, [lineMesh, activeLineMesh, vertexHandles])

  useObjectLifecycle(group)
  return null
}

export function SnappingGuidelineVisuals({ guidelines }: { guidelines: Line[] }) {
  const lineMesh = useMemo(() => {
    let positions: number[] = []
    let colors: number[] = []
    for (let [a, b] of guidelines) {
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
        positions.push(...getZ(p0).toArray(), ...getZ(p1).toArray())
        colors.push(...ACTIVE_EDGE_COLOR.toArray(), ...ACTIVE_EDGE_COLOR.toArray())
      }
    }

    const lineMesh = new LineSegments2(new LineSegmentsGeometry(), guidelineMaterial)
    lineMesh.geometry.setPositions(positions)
    lineMesh.geometry.setColors(colors)
    return lineMesh
  }, [guidelines])

  useObjectLifecycle(lineMesh)
  return null
}
