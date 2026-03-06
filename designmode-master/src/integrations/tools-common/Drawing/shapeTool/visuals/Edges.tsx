import { useEffect, useMemo } from "preact/compat"
import { DistanceLabel } from "./labels/DistanceLabel/DistanceLabel"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { AlwaysDepth, Color, GreaterDepth, LessEqualDepth } from "three"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { ThreeShape } from "./ThreeShape"
import { screenResolutionVector } from "src/core/three/sceneManager"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { colors } from "src/lib/colors"
import type { Edge, Shape } from "src/lib/three/Shape/types"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type Props = {
  shape: Shape
  hoveredEdgeIndex?: number
  hoveredVertices?: number[]
  valid?: boolean
  onTerrain?: boolean
  closed?: boolean
  useImperialUnits: boolean
}

const NORMAL = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
  depthFunc: AlwaysDepth,
  depthWrite: true,
  depthTest: true,
  resolution: screenResolutionVector,
})

const NORMAL_DASHED = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  transparent: true,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
  depthFunc: AlwaysDepth,
  depthWrite: true,
  depthTest: true,
  resolution: screenResolutionVector,
  dashed: true,
  dashScale: 5,
  dashSize: 3,
  gapSize: 2,
})

const NORMAL_BEHIND = new LineMaterial({
  color: new Color(colors.gray40).getHex(),
  linewidth: 1,
  depthFunc: GreaterDepth,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  resolution: screenResolutionVector,
})

const HOVER_INVALID = new LineMaterial({
  color: new Color(colors.red60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

const HOVER = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

const INVALID = new LineMaterial({
  color: new Color(colors.red60).getHex(),
  linewidth: 2,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
  depthFunc: LessEqualDepth,
  transparent: true,
  resolution: screenResolutionVector,
})
const INVALID_BEHIND = new LineMaterial({
  color: new Color(colors.red60).getHex(),
  linewidth: 1,
  opacity: 0.35,
  depthFunc: GreaterDepth,
  depthWrite: false,
  transparent: true,
  resolution: screenResolutionVector,
})

export const Edges = ({
  shape,
  hoveredEdgeIndex = -1,
  hoveredVertices = [],
  valid = true,
  onTerrain = false,
  closed = false,
  useImperialUnits,
}: Props) => {
  const baseEditMode = scenarioModeSignal.value

  useEffect(() => {
    const color = baseEditMode ? colors.scenarioPurple : colors.blue60
    NORMAL.color.set(color)
    NORMAL_DASHED.color.set(color)
    HOVER.color.set(color)
  }, [baseEditMode])
  const terrainSamplerData = terrainSignal.value.terrainSamplerData
  const [unhovered, hovered, unhovered_back, closedRubberBand] = useMemo(() => {
    const hoveredEdges: Edge[] = shape.edges.filter((value, index) => hoveredEdgeIndex === index)
    const normalEdges: Edge[] = shape.edges.filter((value, index) => hoveredEdgeIndex !== index)

    const closedRubberBand = new ThreeShape(
      {
        ...shape,
        edges: closed ? ShapeUtils.closeEdgesOnShape(shape).edges.slice(-1) : [],
      },
      NORMAL_DASHED,
      onTerrain,
      terrainSamplerData,
    )

    const unhovered = new ThreeShape(
      {
        ...shape,
        edges: normalEdges,
      },
      valid ? NORMAL : INVALID,
      onTerrain,
      terrainSamplerData,
    )
    const unhovered_back = new ThreeShape(
      {
        ...shape,
        edges: normalEdges,
      },
      valid ? NORMAL_BEHIND : INVALID_BEHIND,
      onTerrain,
      terrainSamplerData,
    )
    const hovered = new ThreeShape(
      {
        ...shape,
        edges: hoveredEdges,
      },
      valid ? HOVER : HOVER_INVALID,
      onTerrain,
      terrainSamplerData,
    )
    return [unhovered, hovered, unhovered_back, closedRubberBand]
  }, [shape, closed, onTerrain, terrainSamplerData, valid, hoveredEdgeIndex])

  useObjectLifecycle(hovered)
  useObjectLifecycle(unhovered)
  useObjectLifecycle(unhovered_back)
  useObjectLifecycle(closedRubberBand)

  const relevantVertices = hoveredVertices.concat(shape.edges[hoveredEdgeIndex])
  const relevantEdges = shape.edges.filter((e) => e.some((v) => relevantVertices.includes(v)))

  if (shape.vertices.length < 2) return null
  return (
    <>
      {relevantEdges.map((edge, i) => (
        <DistanceLabel
          vertices={[shape.vertices[edge[0]], shape.vertices[edge[1]]]}
          key={i}
          onTerrain={onTerrain}
          color={
            edge === shape.edges[hoveredEdgeIndex]
              ? baseEditMode
                ? colors.scenarioPurple
                : colors.blue50
              : colors.gray40
          }
          useImperialUnits={useImperialUnits}
        />
      ))}
    </>
  )
}

export { HOVER as hoverLineMaterial }
export { NORMAL as selectionLineMaterial }
