import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"
import type { Vector3 } from "three"
import { Group } from "three"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { useComputed, useSignal, useSignalEffect } from "@preact/signals"
import { elementState } from "src/core/elements/ElementState"
import transportationApi, {
  type RadiusPointsUnprocessed,
  type TransportType,
} from "src/integrations/transportation/lib/transportationApi"
import { createUrn, newChildKey, newId, newRevision } from "src/lib/element/urn"
import { PROJECT_ID } from "src/core/project/project"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { curveToolAdditionalSnappingLines, getPosition } from "./snapping"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import type { SnapInfo } from "src/integrations/snapping/snappingEngine"
import { SnappingLines } from "./SnappingVisuals"
import { resetSelectionSetSignal, scenarioModeSignal } from "src/core/selection/selectionState"
import { getLinesAndPointsMesh } from "./toolVisuals"
import {
  createElementContainer,
  lineStringToRailRenderables,
  polygonsToRenderables,
} from "src/integrations/transportation/glue"
import { CurveFloatingInputs, lockPositionToAngle, lockPositionToDistance } from "./FloatingInputs"
import { dispose } from "src/core/three/useObjectLifecycle"
import { AngleCornerVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/AngleCornerVisual"
import {
  bufferWidthSignal,
  defaultRadiusSignal,
  DrawingProperties,
  drawModeSignal,
  SMOOTH_RADIUS,
} from "src/integrations/transportation/PropertyPanels/DrawingProperties"
import type { Renderable } from "src/integrations/renderables/renderable"
import { useReadonlySignal } from "src/lib/signal"
import { PickElementIcon } from "src/lib/components/icons/PickElementIcon_24"
import FountainPenIcon from "src/lib/components/icons/FountainPenIcon"
import { GROUND_POLYGON_HOTKEYS } from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import { RoadTraceShape } from "./CurvedTraceTool"
import { EventName } from "@spacemakerai/webapp-analytics"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { dispatchTransportationEvent } from "src/core/events/transportationEvents"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function DrawTransportCurve({ type }: { type: TransportType }) {
  resetSelectionSetSignal()
  const renderApi = useRenderAPI("DrawTransportCurve")
  const contextRoot = scenarioModeSignal.value ? "base" : "proposal"
  const renderGroup2dSignal = useSignal(new RenderGroup("poc-renderables-2d-preview"))
  renderApi.useObjectLifecycle_TEMPORARY_FIX(renderGroup2dSignal.value, true, sceneManager.overlay.scene, false)
  const pointsSignal = useSignal<Vector3[]>([])

  const typeSignal = useReadonlySignal(type)
  useSignalEffect(() => {
    if (pointsSignal.value.length < 2) return
    const controlPoints: RadiusPointsUnprocessed[] = pointsSignal.value.map((p) => ({
      id: newId(),
      position: p,
    }))
    let renderables: Renderable[] = []
    if (typeSignal.value === "road") {
      const polygons = transportationApi.generatePolygons(
        controlPoints,
        defaultRadiusSignal.value,
        bufferWidthSignal.value,
      )
      renderables = polygonsToRenderables(polygons)
    } else if (typeSignal.value === "rail") {
      const lineString = transportationApi.createCurveLineString(controlPoints, defaultRadiusSignal.value)
      renderables = lineStringToRailRenderables(lineString, bufferWidthSignal.value)
    }
    if (renderables.length === 0) return
    renderGroup2dSignal.value.update(renderables)
    sceneManager.render(false, true)
  })

  const onComplete = useCallback(
    (points: Vector3[]) => {
      const controlPoints: RadiusPointsUnprocessed[] = points.map((p) => ({
        id: newId(),
        position: p,
      }))
      const element = transportationApi.createTransportationElement(
        controlPoints,
        createUrn(transportationApi.systemName, PROJECT_ID, newId(), newRevision()),
        defaultRadiusSignal.peek(),
        bufferWidthSignal.peek(),
        type,
      )
      if (!element) return
      const container = createElementContainer(element)
      elementState.edit(({ addElement }) =>
        addElement(contextRoot, { key: newChildKey(), urn: container.element.urn }, container),
      )

      const curveStyle = defaultRadiusSignal.peek() === SMOOTH_RADIUS ? "smooth" : "tight"
      const mode = drawModeSignal.peek() === "freeform" ? "line" : "trace"

      // category on element is rails not rail, so use that for tracking to follow pattern elsewhere
      const transportationType = type === "rail" ? "rails" : "road"

      dispatchTransportationEvent(transportationType, EventName.Add, {
        curve_style: curveStyle,
        mode: mode,
      })

      exitCurrentTool()
    },
    [contextRoot, type],
  )

  const onPreview = useCallback((points: Vector3[]) => (pointsSignal.value = points), [pointsSignal])

  if (drawModeSignal.value === "freeform") {
    return <CurveTool onComplete={onComplete} onPreview={onPreview} />
  } else if (drawModeSignal.value === "pick") {
    return <RoadTraceShape onCancelDraw={exitCurrentTool} onCompleteDraw={onComplete} />
  }
  return null
}

function CurveTool({
  onComplete,
  onPreview,
}: {
  onComplete: (points: Vector3[]) => void
  onPreview: (points: Vector3[]) => void
}) {
  const renderApi = useRenderAPI("default")

  const terrain = terrainSignal.value
  const snappingActiveSignal = useSignal(true)
  const pointsSignal = useSignal<Vector3[]>([])
  const currentPositionSignal = useSignal<Vector3 | null>(null)
  const linesGroup = useMemo(() => new Group(), [])

  renderApi.useObjectLifecycle_TEMPORARY_FIX(linesGroup, true, sceneManager.scene)
  const specifiedDistanceSignal = useSignal<number | null>(null)
  const specifiedAngleSignal = useSignal<number | null>(null)

  const [snapInfo, setSnapInfo] = useState<SnapInfo | undefined>(undefined)

  const localSnappingLinesSignal = useComputed(() => {
    const points = pointsSignal.value
    if (points.length < 2) return []

    return curveToolAdditionalSnappingLines(points)
  })

  const previewPositions = useCallback(
    (controlPoints: Vector3[]) => {
      if (controlPoints.length < 1) return
      //TODO we dont need id here but we need to pass it to getLinesAndPointsMesh
      const lineSegmentsMesh = getLinesAndPointsMesh(
        controlPoints.map((p) => ({ position: p, id: "" })),
        undefined,
      )
      linesGroup.traverse((obj) => dispose(obj))
      linesGroup.remove(...linesGroup.children)
      linesGroup.add(lineSegmentsMesh)
      onPreview(controlPoints)
      sceneManager.render(false, false)
    },
    [linesGroup, onPreview],
  )

  const currentPosition = currentPositionSignal.value
  useEffect(() => {
    const controlPoints = currentPosition ? pointsSignal.peek().concat([currentPosition]) : pointsSignal.peek()
    previewPositions(controlPoints)
  }, [currentPosition, pointsSignal, previewPositions])

  const mousemove = useCallback(
    (e: MouseEvent) => {
      const snappingActive = e.altKey ? false : true
      const hoverPos = getPosition(
        pointsSignal.peek(),
        snappingActive,
        terrain.elevationAt,
        localSnappingLinesSignal.peek(),
        setSnapInfo,
      )
      let position = lockPositionToDistance(
        hoverPos,
        pointsSignal.peek(),
        specifiedDistanceSignal.peek(),
        terrain.elevationAt,
      )
      position = lockPositionToAngle(position, pointsSignal.peek(), specifiedAngleSignal.peek(), terrain.elevationAt)
      currentPositionSignal.value = position

      return Propagate.NO
    },
    [
      pointsSignal,
      terrain,
      setSnapInfo,
      currentPositionSignal,
      specifiedDistanceSignal,
      specifiedAngleSignal,
      localSnappingLinesSignal,
    ],
  )

  const prevScreenPositionSignal = useSignal<{ x: number; y: number } | null>(null)
  const mouseup = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 0) return Propagate.NO

      const snappingActive = e.altKey ? false : true
      const points = pointsSignal.peek()
      const clickPos = getPosition(
        points,
        snappingActive,
        terrain.elevationAt,
        localSnappingLinesSignal.peek(),
        setSnapInfo,
      )
      let position = lockPositionToDistance(clickPos, points, specifiedDistanceSignal.peek(), terrain.elevationAt)

      position = lockPositionToAngle(position, points, specifiedAngleSignal.peek(), terrain.elevationAt)
      if (position) {
        const prevScreenPos = prevScreenPositionSignal.peek()
        const doubleClick =
          prevScreenPos && Math.sqrt((prevScreenPos.x - e.clientX) ** 2 + (prevScreenPos.y - e.clientY) ** 2) < 5
        if (points.length > 1 && (doubleClick || position.equals(points[points.length - 1]))) {
          onComplete(points)
        } else {
          pointsSignal.value = [...points, position.clone()]
        }
      }
      prevScreenPositionSignal.value = { x: e.clientX, y: e.clientY }
      setTimeout(() => {
        prevScreenPositionSignal.value = null
      }, 1000)
      specifiedDistanceSignal.value = null
      specifiedAngleSignal.value = null

      return Propagate.NO
    },
    [
      pointsSignal,
      terrain,
      setSnapInfo,
      specifiedDistanceSignal,
      specifiedAngleSignal,
      localSnappingLinesSignal,
      onComplete,
      prevScreenPositionSignal,
    ],
  )

  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.renderer.domElement)

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && (specifiedDistanceSignal.peek() || specifiedAngleSignal.peek())) {
        const points = pointsSignal.peek()
        const snappingActive = e.altKey ? false : true
        const mousePos = getPosition(
          pointsSignal.peek(),
          snappingActive,
          terrain.elevationAt,
          localSnappingLinesSignal.peek(),
          setSnapInfo,
        )
        if (!mousePos || points.length === 0) return Propagate.YES

        let position = lockPositionToDistance(
          mousePos,
          pointsSignal.peek(),
          specifiedDistanceSignal.peek(),
          terrain.elevationAt,
        )!
        position = lockPositionToAngle(position, pointsSignal.peek(), specifiedAngleSignal.peek(), terrain.elevationAt)!
        pointsSignal.value = [...points, position]
        return Propagate.NO
      }
      if (e.key === "Enter") {
        onComplete(pointsSignal.peek())
      }
      if (e.altKey) {
        snappingActiveSignal.value = false
      }
      return Propagate.YES
    },
    [
      specifiedDistanceSignal,
      specifiedAngleSignal,
      pointsSignal,
      terrain.elevationAt,
      onComplete,
      snappingActiveSignal,
      localSnappingLinesSignal,
    ],
  )
  const keyup = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        snappingActiveSignal.value = true
      }
      return Propagate.YES
    },
    [snappingActiveSignal],
  )
  useEventHandler("keydown", keydown, Priority.TOOL)
  useEventHandler("keyup", keyup, Priority.TOOL)

  const exitCallback = useCallback(() => {
    if (pointsSignal.peek().length > 1) onComplete(pointsSignal.peek())
    else exitCurrentTool()
  }, [onComplete, pointsSignal])
  useExitHotKeys(exitCallback)

  const setSpecifiedDistance = useCallback(
    (distance: number | null) => {
      specifiedDistanceSignal.value = distance
      if (distance === null) return
      const points = pointsSignal.peek()
      const currentPoint = currentPositionSignal.peek()
      if (points.length === 0 || !currentPoint) return

      const position = lockPositionToDistance(currentPoint, points, distance, terrain.elevationAt)!
      currentPositionSignal.value = position
    },
    [specifiedDistanceSignal, pointsSignal, currentPositionSignal, terrain],
  )
  const setSpecifiedAngle = useCallback(
    (angle: number | null) => {
      specifiedAngleSignal.value = angle
      if (angle === null) return
      const points = pointsSignal.peek()
      const currentPoint = currentPositionSignal.peek()
      if (points.length === 0 || !currentPoint) return

      const position = lockPositionToAngle(currentPoint, points, angle, terrain.elevationAt)!
      currentPositionSignal.value = position
    },
    [specifiedAngleSignal, pointsSignal, currentPositionSignal, terrain],
  )
  const vertices = pointsSignal.value
  return (
    <>
      <CurveFloatingInputs
        points={vertices}
        currentPoint={currentPosition}
        specifiedDistance={specifiedDistanceSignal.value}
        specifiedAngle={specifiedAngleSignal.value}
        setSpecifiedDistance={setSpecifiedDistance}
        setSpecifiedAngle={setSpecifiedAngle}
        exitCallback={exitCallback}
      />
      {snappingActiveSignal.value && <SnappingLines snapInfo={snapInfo} />}
      <AngleCornerVisual
        startPoint={vertices[vertices.length - 2]}
        pivotPoint={vertices[vertices.length - 1]}
        currentPoint={currentPosition ?? undefined}
      />
    </>
  )
}

export function useExitHotKeys(callback: () => void) {
  const escapeHotkey = useMemo<HotkeyKeyRegistration>(
    () => ({
      description: (t) => t(($) => $.hotkeys.exitTransportationTool),
      keyCode: "Escape",
      editAccessRequired: true,
      callback: callback,
    }),
    [callback],
  )
  useHotkey(escapeHotkey)
  const enterHotkey = useMemo<HotkeyKeyRegistration>(
    () => ({
      description: (t) => t(($) => $.hotkeys.exitTransportationTool),
      keyCode: "Enter",
      editAccessRequired: true,
      callback: callback,
    }),
    [callback],
  )
  useHotkey(enterHotkey)
}

const DrawCurvedRoadsToolbar = () => {
  const activeMode = drawModeSignal.value
  return (
    <>
      <ToolbarButton
        icon={<FountainPenIcon />}
        onClick={() => (drawModeSignal.value = "freeform")}
        label={(t) => t(($) => $.basicElements.generic.line.name)}
        active={activeMode === "freeform"}
        shortCut={GROUND_POLYGON_HOTKEYS.LINE}
      />
      <ToolbarButton
        icon={<PickElementIcon />}
        onClick={() => (drawModeSignal.value = "pick")}
        label={(t) => t(($) => $.drawing.traceShape)}
        active={activeMode === "pick"}
        shortCut={GROUND_POLYGON_HOTKEYS.PICK}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton onClick={exitCurrentTool} />
    </>
  )
}

export function createCurvedTransportationTool(type: TransportType) {
  toolAPI.setTool({
    id: "curvedTransport",
    tool: () => <DrawTransportCurve type={type} />,
    propertyPanel: () => <DrawingProperties type={type} />,
    toolbar: () => <DrawCurvedRoadsToolbar />,
  })
}
