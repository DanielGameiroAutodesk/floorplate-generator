import * as THREE from "three"
import type { Object3D } from "three"
import { AlwaysDepth, BufferAttribute, BufferGeometry, Color, Matrix4, Vector2, Vector3 } from "three"
import { useCallback, useMemo, useState } from "preact/compat"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { v4 as uuidv4 } from "uuid"
import type { DrawLineFixedInputs } from "src/integrations/building-systems-line-buildings/FloatingInputBox/DrawLineBuildingInputBox"
import { DrawLineBuildingInputBox } from "src/integrations/building-systems-line-buildings/FloatingInputBox/DrawLineBuildingInputBox"
import type { Transform } from "@spacemakerai/element-types"
import { getTranslationMatrix } from "src/integrations/building-systems-common/geoHelpers"
import type { OtherBuildingsData } from "src/integrations/building-systems-line-buildings/mergeLineBuildings"
import { mergeLineBuildings } from "src/integrations/building-systems-line-buildings/mergeLineBuildings"
import { lineBuildingApi } from "src/integrations/building-systems-line-buildings/lineBuildingApi"
import { pointPointDistanceXY } from "src/integrations/building-systems-common/geometryHelpers"
import type { ConnectToOtherBuildingPoint } from "./drawLineBuildingSnapping"
import { getDrawLineBuildingSnappedPosition } from "./drawLineBuildingSnapping"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { colors } from "src/lib/colors"
import type { SnappingLine_UNSTABLE } from "src/integrations/raycast/RaycastAPI"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { getRaycastableMeshesForVisibleNodesSignal } from "src/core/elements/child-node-container-derived-data/volumeMeshWithAcceleratedRaycast"
import { intersectScene } from "src/integrations/snapping/snappingEngineHelpers"
import { mousePosition } from "src/core/useMousePosition"
import sceneManager, { screenResolutionVector } from "src/core/three/sceneManager"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import type { Graph, GraphEdge, GraphVertex } from "@spacemakerai/line-buildings-shared/shapeHelpers"
import type { LineAlignment } from "@spacemakerai/line-buildings-shared/LineBuildingTypes"

function useObjectLifecycle(visuals?: Object3D) {
  const renderApi = useRenderAPI("default")
  return renderApi.useObjectLifecycle_TEMPORARY_FIX(visuals)
}
export const LiveBuildingVisuals = ({
  drawShape,
  drawingSnapData,
  parameters,
  otherBuildingsData,
  drawShapeIsInvalid,
}: {
  drawShape: DrawShape
  drawingSnapData: DrawingSnapData
  parameters: Parameters
  otherBuildingsData: any
  drawShapeIsInvalid: boolean
}) => {
  const visuals = useMemo(() => {
    if (drawShape === undefined) return
    if (drawShapeIsInvalid) return undefined
    const { graph, lowestZ } = drawShape

    const transform: Transform = getTranslationMatrix(0, 0, lowestZ)
    const mergedLineBuilding = mergeLineBuildings({ ...parameters, graph }, otherBuildingsData, drawingSnapData)
    const { geometry, lineGeometry: lines } = lineBuildingApi.run(mergedLineBuilding)

    const transformMatrix = transform ? new Matrix4().fromArray(transform) : new Matrix4().identity()

    const group = new THREE.Group()

    if (geometry) {
      const bufferGeo = new BufferGeometry()
      bufferGeo.setAttribute("position", new BufferAttribute(geometry.attributes.position.array, 3))
      bufferGeo.setAttribute("normal", new BufferAttribute(geometry.attributes.normal.array, 3, false))
      bufferGeo.setAttribute("color", new BufferAttribute(geometry.attributes.color.array, 3, true))

      const material = new THREE.MeshLambertMaterial({ vertexColors: true })
      const mesh = new THREE.Mesh(bufferGeo, material)
      group.add(mesh)
    }

    if (lines) {
      const linesGeo = new LineSegmentsGeometry().setPositions(lines.attributes.positions)
      const color = lines?.uniforms?.color || "#222"
      const linewidth = lines?.uniforms?.lineWidth || 2
      const lineMaterial = new LineMaterial({
        color: new Color(color).getHex(),
        linewidth: linewidth,
        resolution: new Vector2(window.screen.width, window.screen.height),
        name: "Box line",
      })

      const mesh = new LineSegments2(linesGeo, lineMaterial)
      group.add(mesh)
    }

    group.applyMatrix4(transformMatrix)
    return group
  }, [drawShape, drawingSnapData, parameters, otherBuildingsData, drawShapeIsInvalid])

  useObjectLifecycle(visuals)

  return null
}

function VisualSnappingPoints({ connectionPoints }: { connectionPoints: any[] }) {
  return (
    <>
      {connectionPoints.map((connectionPoint: any) => {
        const point = connectionPoint.point
        const vector = new Vector3(point.x, point.y, point.z)
        const key = connectionPoint.id
        return <Handle key={key} position={vector} hovered={false} />
      })}
    </>
  )
}

const SNAPPING_ACTIVE_COLOR = new Color("#E30288")
const baseLineParams = {
  color: SNAPPING_ACTIVE_COLOR.getHex(),
  linewidth: 1,
  depthFunc: AlwaysDepth,
  transparent: true,
  opacity: 1,
  dashed: false,
  resolution: screenResolutionVector,
  polygonOffset: true,
  polygonOffsetUnits: -4,
  polygonOffsetFactor: -4,
}
const shapeToolSnappingLineMaterial = new LineMaterial({
  ...baseLineParams,
})

function ShapeToolSnapLineVisuals({ visualSnapData }: { visualSnapData: { lines: SnappingLine_UNSTABLE[] } }) {
  const lineVisuals = useMemo(() => {
    if (visualSnapData?.lines === undefined || visualSnapData.lines.length === 0) return undefined
    const snappedToLines = visualSnapData.lines
    const geom = new LineSegmentsGeometry()
    const n = snappedToLines.length
    const positions = new Float32Array(6 * n)
    for (let i = 0; i < n; i++) {
      const v0 = snappedToLines[i].start
      const v1 = snappedToLines[i].end
      positions[i * 6] = v0.x
      positions[i * 6 + 1] = v0.y
      positions[i * 6 + 2] = v0.z
      positions[i * 6 + 3] = v1.x
      positions[i * 6 + 4] = v1.y
      positions[i * 6 + 5] = v1.z
    }
    geom.setPositions(positions)
    return new LineSegments2(geom, shapeToolSnappingLineMaterial)
  }, [visualSnapData])

  useObjectLifecycle(lineVisuals)
  return <></>
}

const lineMaterial = new LineMaterial({
  color: new Color(colors.blue60).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

const invalidLineMaterial = new LineMaterial({
  color: new Color(colors.red50).getHex(),
  linewidth: 2,
  depthFunc: AlwaysDepth,
  transparent: true,
  resolution: screenResolutionVector,
})

function LineVisuals({
  lineData,
  positionData,
  drawShapeIsInvalid,
}: {
  lineData: LineData
  positionData: PositionData | undefined
  drawShapeIsInvalid: boolean
}) {
  const lineVisuals = useMemo(() => {
    if (!positionData) return
    const geom = new LineSegmentsGeometry()

    const line = [...lineData.line.map((v) => v.position)]
    if (positionData) line.push(positionData.snappedPosition)
    const n = line.length - 1
    const positions = new Float32Array(6 * n)
    for (let i = 0; i < n; i++) {
      const v0 = line[i]
      const v1 = line[i + 1]
      positions[i * 6] = v0.x
      positions[i * 6 + 1] = v0.y
      positions[i * 6 + 2] = v0.z
      positions[i * 6 + 3] = v1.x
      positions[i * 6 + 4] = v1.y
      positions[i * 6 + 5] = v1.z
    }
    geom.setPositions(positions)
    if (drawShapeIsInvalid) return new LineSegments2(geom, invalidLineMaterial)
    return new LineSegments2(geom, lineMaterial)
  }, [lineData, positionData, drawShapeIsInvalid])

  useObjectLifecycle(lineVisuals)
  return (
    <>
      {positionData && <Handle position={positionData.snappedPosition} hovered={positionData.snapped} />}
      {lineData.line.map((vertex, i) => {
        return <Handle key={i} position={vertex.position} hovered={false} />
      })}
    </>
  )
}

/////
//
////

type LineEntry = { position: Vector3 }
type LineData = { line: LineEntry[]; snapFromLines: [Vector3, Vector3][] }
type PositionData = { snappedPosition: Vector3; snapped: boolean }

export type DrawingSnapData = {
  startedDrawing: boolean
  startSnap?: any
  endSnap?: any
}
export type DrawShape = { graph: Graph; lowestZ: number }

function lineToGraph({ line, closed }: { line: LineEntry[]; closed: boolean }) {
  const vertices: Record<string, GraphVertex> = {}
  const edges: Record<string, GraphEdge> = {}
  const vertexIDs: string[] = []
  const n = closed ? line.length - 1 : line.length
  for (let i = 0; i < n; i++) {
    const vertex = line[i]
    const vertexID = uuidv4()
    vertices[vertexID] = { x: vertex.position.x, y: vertex.position.y, id: vertexID }
    vertexIDs.push(vertexID)
  }
  const m = line.length - 1
  for (let i = 0; i < m; i++) {
    const edgeID = uuidv4()
    const vertexOneID = vertexIDs[i]
    const vertexTwoID = vertexIDs[(i + 1) % n]
    edges[edgeID] = { start: vertexOneID, end: vertexTwoID, id: edgeID }
  }
  return { vertices, edges }
}

function drawPointSnappedToLast(line: Vector3[], position: Vector3) {
  if (line.length === 0) return false
  const n = line.length
  const prevPoint = line[n - 1]
  return pointPointDistanceXY(prevPoint, position) === 0
}

type OnComplete = ({
  graph,
  drawingSnapData,
  lowestZ,
  parameters,
}: {
  graph: Graph
  drawingSnapData: DrawingSnapData
  lowestZ: number
  parameters: any
}) => void

type IsMergedDrawLineBuildingValid = ({
  sideGraph,
  parameters,
  otherBuildingsData,
  drawingSnapData,
}: {
  sideGraph: Graph
  parameters: { width: number; lineAlignment: LineAlignment }
  otherBuildingsData: OtherBuildingsData
  drawingSnapData: DrawingSnapData
}) => boolean

type Parameters = { width: number; lineAlignment: LineAlignment; minSubBuildingLength: number }

function useRaycastFunction() {
  const rayCastingTargets = getRaycastableMeshesForVisibleNodesSignal.value({ ignoreVirtualNodes: true })
  return useCallback(() => intersectScene(mousePosition, rayCastingTargets), [rayCastingTargets])
}

export const DrawLineBuildingTool = ({
  connectionPoints,
  parameters,
  otherBuildingsData,
  drawingSnapData,
  setDrawingSnapData,
  isValid,
  onComplete,
}: {
  connectionPoints: ConnectToOtherBuildingPoint[]
  parameters: Parameters
  otherBuildingsData: OtherBuildingsData
  drawingSnapData: DrawingSnapData
  setDrawingSnapData: (drawingSnapData: DrawingSnapData | ((prev: DrawingSnapData) => DrawingSnapData)) => void
  isValid: IsMergedDrawLineBuildingValid
  onComplete: OnComplete
}) => {
  const raycastFunction = useRaycastFunction()
  const [drawShape, setDrawShape] = useState<DrawShape | undefined>(undefined)

  const [fixedInputs, setFixedInputs] = useState<DrawLineFixedInputs>({
    fixedAngle: undefined,
    fixedLength: undefined,
  })

  const [visualSnapData, setVisualSnapData] = useState<any>([])

  const [positionData, setPositionData] = useState<undefined | PositionData>(undefined)
  const [lineData, setLineData] = useState<LineData>({ line: [], snapFromLines: [] })
  const [disableSnapping, setDisableSnapping] = useState(false)

  const mouseMoveOrInputChange = useCallback(
    (fixedInputs: DrawLineFixedInputs) => {
      const intersect = raycastFunction()
      if (intersect === undefined) return
      const first = lineData?.line.length === 0
      const drawFromLines = lineData.snapFromLines
      const shapeToolSnapLines = raycastApi.snapping.getLinesAtMousePosition_UNSTABLE()
      const startSnap = drawingSnapData.startSnap
      const { snappedPosition, snapped, snapPoint, closed, visualSnapData } = getDrawLineBuildingSnappedPosition({
        position: intersect,
        connectionPoints: connectionPoints,
        line: lineData.line.map((v) => v.position),
        parameters,
        first,
        shapeToolSnapLines: disableSnapping ? [] : shapeToolSnapLines,
        drawFromLines,
        startSnap,
        fixedInputs,
      })

      setPositionData({ snappedPosition, snapped })

      if (!first && snappedPosition) {
        const snappedToLast = drawPointSnappedToLast(
          lineData.line.map((v) => v.position),
          snappedPosition,
        )
        const line = snappedToLast ? lineData.line : [...lineData.line, { position: snappedPosition }]
        const graph = lineToGraph({ line: line, closed })
        const lowestZ = line[0].position.z
        if (graph) setDrawShape({ graph, lowestZ })
        setDrawingSnapData((old: DrawingSnapData) => {
          if (old?.startedDrawing) {
            return { ...old, endSnap: snapPoint }
          }
          return { ...old, startSnap: snapPoint }
        })
      }
      setVisualSnapData(visualSnapData || [])
    },
    [
      raycastFunction,
      lineData.line,
      lineData.snapFromLines,
      drawingSnapData.startSnap,
      connectionPoints,
      parameters,
      disableSnapping,
      setDrawingSnapData,
    ],
  )

  const mousemove = useCallback(() => {
    mouseMoveOrInputChange(fixedInputs)
    return Propagate.YES
  }, [mouseMoveOrInputChange, fixedInputs])

  const mousedown = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.YES
      const intersect = raycastFunction()
      if (intersect === undefined) return Propagate.YES
      const first = lineData.line?.length === 0
      const drawFromLines = lineData.snapFromLines
      const startSnap = drawingSnapData.startSnap
      const shapeToolSnapLines = raycastApi.snapping.getLinesAtMousePosition_UNSTABLE()

      const { snappedPosition, snapPoint, closed, snapFromLines } = getDrawLineBuildingSnappedPosition({
        position: intersect,
        connectionPoints: connectionPoints,
        line: lineData.line.map((v) => v.position),
        parameters,
        first,
        shapeToolSnapLines: disableSnapping ? [] : shapeToolSnapLines,
        drawFromLines,
        startSnap,
        fixedInputs,
      })

      const snappedToLast = drawPointSnappedToLast(
        lineData.line.map((v) => v.position),
        snappedPosition,
      )
      const line = snappedToLast ? lineData.line : [...lineData.line, { position: snappedPosition }]
      if (closed || (snappedToLast && line?.length >= 2)) {
        const graph = lineToGraph({ line: line, closed })
        const lowestZ = line[0].position.z
        onComplete({ graph, lowestZ, parameters, drawingSnapData })
      }
      if (!first && snapPoint) {
        const graph = lineToGraph({ line: line, closed: false })
        const lowestZ = line[0].position.z
        const updatedSnapData = { ...drawingSnapData, endSnap: snapPoint }
        onComplete({ graph, lowestZ, parameters, drawingSnapData: updatedSnapData })
      }

      if (first) {
        setDrawingSnapData({ startedDrawing: true, startSnap: snapPoint })
      }
      if (line.length > 0) {
        const graph = lineToGraph({ line: line, closed })
        const lowestZ = line[0].position.z
        if (graph) setDrawShape({ graph, lowestZ })
      }
      setLineData({ line, snapFromLines: snapFromLines || [] })
      setFixedInputs({ fixedAngle: undefined, fixedLength: undefined })
      return Propagate.YES
    },
    [
      connectionPoints,
      disableSnapping,
      drawingSnapData,
      fixedInputs,
      lineData.line,
      lineData.snapFromLines,
      onComplete,
      parameters,
      raycastFunction,
      setDrawingSnapData,
    ],
  )

  const completeLineBuilding = useCallback(() => {
    if (lineData.line?.length < 2) return Propagate.YES
    const graph = lineToGraph({ line: lineData.line, closed: false })
    const lowestZ = lineData.line[0].position.z
    onComplete({ graph: graph, drawingSnapData, parameters, lowestZ })
  }, [drawingSnapData, lineData.line, onComplete, parameters])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
        case "Enter": {
          completeLineBuilding()
          return Propagate.YES
        }
        case "Alt":
        case "Option": {
          setDisableSnapping(true)
          return Propagate.YES
        }
        default: {
          return Propagate.YES
        }
      }
    },
    [completeLineBuilding],
  )
  const keyup = useCallback((e: KeyboardEvent) => {
    if (e.key === "Alt" || e.key === "Option") {
      setDisableSnapping(false)
    }
    return Propagate.YES
  }, [])

  useEventHandler("mousemove", mousemove, Priority.SUBTOOL)
  useEventHandler("mousedown", mousedown, Priority.SUBTOOL, sceneManager.canvas)
  useEventHandler("keydown", keydown, Priority.SUBTOOL)
  useEventHandler("keyup", keyup, Priority.SUBTOOL)

  const drawShapeIsInvalid = useMemo(() => {
    if (!drawShape) return false
    const { graph } = drawShape
    return !isValid({ sideGraph: graph, parameters, drawingSnapData, otherBuildingsData })
  }, [drawShape, parameters, drawingSnapData, otherBuildingsData, isValid])

  return (
    <>
      <LineVisuals lineData={lineData} positionData={positionData} drawShapeIsInvalid={drawShapeIsInvalid} />
      <ShapeToolSnapLineVisuals visualSnapData={visualSnapData} />
      {positionData && lineData.line?.length >= 1 && (
        <DrawLineBuildingInputBox
          line={lineData.line.map((v) => v.position)}
          position={positionData.snappedPosition}
          fixedInputs={fixedInputs}
          updateFixedInputs={(updatedFixedInputs: DrawLineFixedInputs) => {
            mouseMoveOrInputChange(updatedFixedInputs)
            setFixedInputs(updatedFixedInputs)
          }}
        />
      )}
      <VisualSnappingPoints connectionPoints={connectionPoints} />
      {drawShape && (
        <LiveBuildingVisuals
          drawShape={drawShape}
          drawingSnapData={drawingSnapData}
          drawShapeIsInvalid={drawShapeIsInvalid}
          parameters={parameters}
          otherBuildingsData={otherBuildingsData}
        />
      )}
    </>
  )
}
