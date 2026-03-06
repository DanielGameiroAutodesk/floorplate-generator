import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { SnappingLines } from "./SnappingVisuals"
import sceneManager from "src/core/three/sceneManager"
import { useExitHotKeys } from "./DrawTransportCurve"
import { exitCurrentTool } from "src/core/toolsState"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { raycast, type PrepassData } from "src/core/terrain/2d-raytracer"
import { Vector3 } from "three"
import { curveToolAdditionalSnappingLines, snapPoints, snapSegments, type Point, type Segment } from "./snapping"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import { addNodeCursor, defaultCursor, deleteNodeCursor } from "src/integrations/cursors/setCursor"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { mousePosition } from "src/core/useMousePosition"
import type { SnapInfo } from "src/integrations/snapping/snappingEngine"
import useGuideText from "./useGuideText"
import { signal, useSignal } from "@preact/signals"
import { newId } from "src/lib/element/urn"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import type { I18nStringProvider } from "src/i18n"

export type Vec3WithId = { position: Vector3; id: string }
type Vec2 = { x: number; y: number }

export const selectedPointSignal = signal<Point | undefined>(undefined)

export default function EditTransportCurveTool({
  pointsWithIds,
  onPreview,
  onComplete,
  onHover,
  resetPreview,
  exitCallback,
}: {
  pointsWithIds: Vec3WithId[]
  onPreview: (points: Vec3WithId[]) => void
  onComplete: (points: Vec3WithId[]) => void
  onHover: (pointId: string | undefined) => void
  resetPreview: () => void
  exitCallback: () => void
}) {
  const snappingActiveSignal = useSignal(true)
  const deletePointCandidateSignal = useSignal<Point | undefined>(undefined)
  const selectedPointIdSignal = useSignal<Point | undefined>(undefined)
  const isDraggingSignal = useSignal<boolean>(false)
  const floatingInputPositionSignal = useSignal<{ x: number; y: number } | undefined>(undefined)
  const terrainSamplerData = terrainSignal.value.terrainSamplerData

  const text = useMemo<I18nStringProvider>(() => {
    const isMac = navigator.userAgent.toLowerCase().includes("mac")
    const addDeleteModeToggle = isMac ? "⌥ Option" : "Alt"
    return () => `Hold ${addDeleteModeToggle} to add or delete points`
  }, [])
  useGuideText(text)

  const currentPoint = selectedPointSignal.value
  const localSnappingLines = useMemo(() => {
    if (!currentPoint) return []
    if (pointsWithIds.length < 2) return []

    if (currentPoint.id === pointsWithIds[0].id) {
      return curveToolAdditionalSnappingLines(
        pointsWithIds
          .slice(1, 3)
          .map((v) => v.position)
          .reverse(),
      )
    } else if (currentPoint.id === pointsWithIds[pointsWithIds.length - 1].id) {
      return curveToolAdditionalSnappingLines(pointsWithIds.slice(-3, -1).map((v) => v.position))
    } else return []
  }, [pointsWithIds, currentPoint])

  const spliceSnappedSegmentsPoint = useCallback(
    (points: Vec3WithId[]) => {
      const segments: Segment[] = points
        .slice(1)
        .map((v, i) => ({ position: [points[i].position, v.position], edgeId: i.toString() }))
      const snappedToSegments = snapSegments(segments)
      if (snappedToSegments) {
        const { point: segmentsPoint, segment } = snappedToSegments
        if (points.some((v) => v.position.equals(segmentsPoint))) return points
        const elevation = raycast(segmentsPoint.x, segmentsPoint.y, terrainSamplerData)
        const index = parseInt(segment.edgeId)
        return points.toSpliced(index + 1, 0, {
          position: new Vector3(segmentsPoint.x, segmentsPoint.y, elevation),
          id: newId(),
        })
      }
    },
    [terrainSamplerData],
  )
  const [snapInfo, setSnapInfo] = useState<SnapInfo | undefined>(undefined)
  const [hoveredPoint, setHoveredPoint] = useState<string | undefined>(undefined)

  const snapToContext = useCallback(() => {
    let globalPosition: Vector3 | undefined = undefined
    const currentPoint = selectedPointSignal.peek()

    if (currentPoint) {
      if (currentPoint.id === pointsWithIds[0].id) {
        globalPosition = pointsWithIds[1].position
      } else if (currentPoint.id === pointsWithIds[pointsWithIds.length - 1].id) {
        globalPosition = pointsWithIds[pointsWithIds.length - 2].position
      }
      // TODO: Consider enabling passing precomputed octree in API
      return snappingAPIStateful.snap(mousePosition, globalPosition, localSnappingLines)
    }
    return undefined
  }, [pointsWithIds, localSnappingLines])

  useEffect(() => {
    onHover(hoveredPoint)
  }, [hoveredPoint, onHover])
  const mousemove = useCallback(
    (e: MouseEvent) => {
      defaultCursor()
      const currentPoint = selectedPointSignal.peek()
      const hoveredPoint = snapPoints(pointsWithIds)
      if (currentPoint === undefined) {
        setHoveredPoint(hoveredPoint?.point.id)
      }
      const snappedToDragStart = currentPoint?.id === hoveredPoint?.point.id ? hoveredPoint : undefined
      if (isDraggingSignal.peek()) {
        floatingInputPositionSignal.value = { x: e.clientX, y: e.clientY }
      }
      // if (isDraggin()) {
      //   //updated the position of input box
      // }
      if (currentPoint) {
        // Handle moving existing point
        const snappingActive = e.altKey ? false : true
        const snappedToContext = snapToContext()

        if (snappingActive && (snappedToDragStart || snappedToContext)) {
          const newPointsWithIds = replaceAtIdWithSampledPoint(
            pointsWithIds,
            currentPoint.id,
            snappedToDragStart?.point.position || snappedToContext!.position,
            terrainSamplerData,
          )
          onPreview(newPointsWithIds)
          setSnapInfo(snappedToContext)
        } else {
          const newPointsWithIds = replaceAtIdWithMousePoint(pointsWithIds, currentPoint.id)
          onPreview(newPointsWithIds)
          setSnapInfo(undefined)
        }
      } else if (e.altKey) {
        //TODO set hover point here as well?
        const snappedToPoints = snapPoints(pointsWithIds)?.point
        // Potentially delete point, no preview
        if (snappedToPoints) {
          deleteNodeCursor()
          return Propagate.YES
        }
        // Preview new point if snapped to segment
        const segmentSnappedPoints = spliceSnappedSegmentsPoint(pointsWithIds)
        if (segmentSnappedPoints) {
          addNodeCursor()
          onPreview(segmentSnappedPoints)
        }
        // Not snapped to point or segment, just preview existing points
        else onPreview(pointsWithIds)
      }
      return Propagate.YES
    },
    [
      pointsWithIds,
      isDraggingSignal,
      floatingInputPositionSignal,
      snapToContext,
      terrainSamplerData,
      onPreview,
      spliceSnappedSegmentsPoint,
    ],
  )

  const mousedown = useCallback(
    (e: MouseEvent) => {
      const snappedToPoints = snapPoints(pointsWithIds)?.point
      if (snappedToPoints && e.altKey) {
        deletePointCandidateSignal.value = snappedToPoints
      } else {
        selectedPointSignal.value = snappedToPoints
        if (snappedToPoints) {
          isDraggingSignal.value = true
          selectedPointIdSignal.value = snappedToPoints
          floatingInputPositionSignal.value = { x: e.clientX, y: e.clientY }
        } else {
          selectedPointIdSignal.value = undefined
          floatingInputPositionSignal.value = undefined
        }
      }

      return Propagate.YES
    },
    [pointsWithIds, isDraggingSignal, selectedPointIdSignal, floatingInputPositionSignal, deletePointCandidateSignal],
  )

  const mouseup = useCallback(
    (e: MouseEvent) => {
      const currentPoint = selectedPointSignal.peek()
      const snappedToPoints = snapPoints(pointsWithIds)?.point
      isDraggingSignal.value = false
      const snap = snapPoints(pointsWithIds)

      let updatedPoints = pointsWithIds

      const deleteCandidate = deletePointCandidateSignal.peek()
      if (e.altKey && snappedToPoints && deleteCandidate?.id === snappedToPoints.id) {
        // Alt-click on point - delete point
        const index = pointsWithIds.findIndex((v) => v.id === snappedToPoints.id)
        updatedPoints = pointsWithIds.toSpliced(index, 1)
      } else if (currentPoint && snap?.point.id !== currentPoint.id) {
        // Finish moving existing point
        const snappingActive = !e.altKey
        const snappedToContext = snapToContext()
        if (snappingActive && snappedToContext) {
          // Move point with snapping
          updatedPoints = replaceAtIdWithSampledPoint(
            pointsWithIds,
            currentPoint.id,
            snappedToContext.position,
            terrainSamplerData,
          )
        } else {
          // Alt-drag - move point without snapping
          updatedPoints = replaceAtIdWithMousePoint(pointsWithIds, currentPoint.id)
        }
        selectedPointSignal.value = undefined
        setSnapInfo(undefined)
      } else if (e.altKey && !snappedToPoints) {
        // Add new point if snapped to segment
        const pointsSnappedToSegments = spliceSnappedSegmentsPoint(pointsWithIds)
        if (pointsSnappedToSegments) updatedPoints = pointsSnappedToSegments
      } else {
        selectedPointSignal.value = undefined
      }
      onComplete(updatedPoints)

      return Propagate.YES
    },
    [
      pointsWithIds,
      isDraggingSignal,
      onComplete,
      snapToContext,
      terrainSamplerData,
      spliceSnappedSegmentsPoint,
      deletePointCandidateSignal,
    ],
  )

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        if (selectedPointSignal.peek() === undefined) {
          const snappedToPoints = snapPoints(pointsWithIds)?.point
          // Potentially delete point, no preview
          if (snappedToPoints) return Propagate.YES
          // Preview new point if snapped to segment
          const segmentSnappedPoints = spliceSnappedSegmentsPoint(pointsWithIds)
          if (segmentSnappedPoints) onPreview(segmentSnappedPoints)
        }
        // Snapping visuals should be turned off when alt is pressed
        snappingActiveSignal.value = false
      }
      return Propagate.YES
    },
    [pointsWithIds, onPreview, spliceSnappedSegmentsPoint, snappingActiveSignal],
  )
  const keyup = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        deletePointCandidateSignal.value = undefined
        if (selectedPointSignal.peek() === undefined) {
          resetPreview()
        }
        snappingActiveSignal.value = true
      }
      return Propagate.YES
    },
    [resetPreview, snappingActiveSignal, deletePointCandidateSignal],
  )

  const dbClick = useCallback(() => {
    onComplete(pointsWithIds)
    exitCurrentTool()
    return Propagate.YES
  }, [pointsWithIds, onComplete])

  useEventHandler("mousemove", mousemove, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mouseup", mouseup, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("mousedown", mousedown, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("dblclick", dbClick, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("keydown", keydown, Priority.TOOL, sceneManager.renderer.domElement)
  useEventHandler("keyup", keyup, Priority.TOOL, sceneManager.renderer.domElement)
  useExitHotKeys(exitCallback)

  return <>{snappingActiveSignal.value && <SnappingLines snapInfo={snapInfo} />}</>
}

const replaceAtIdWithSampledPoint = (
  points: Vec3WithId[],
  id: string,
  samplePos2D: Vec2,
  terrainSamplerData: PrepassData,
): Vec3WithId[] => {
  const elevation = raycast(samplePos2D.x, samplePos2D.y, terrainSamplerData)
  const newPoint = { position: new Vector3(samplePos2D.x, samplePos2D.y, elevation), id }
  return points.map((v) => (v.id === id ? newPoint : v))
}

const replaceAtIdWithMousePoint = (points: Vec3WithId[], id: string): Vec3WithId[] => {
  const newPosition = raycastApi.raycastTerrain()?.position
  const newPoint = newPosition ? { position: new Vector3(newPosition.x, newPosition.y, newPosition.z), id } : undefined
  return newPoint ? points.map((v) => (v.id === id ? newPoint : v)) : points
}
