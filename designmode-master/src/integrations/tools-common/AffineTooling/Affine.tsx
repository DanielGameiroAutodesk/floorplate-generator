import type { MutableRef } from "preact/hooks"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks"
import { useSetRecoilState } from "recoil"
import type { Object3D, Raycaster } from "three"
import { Box3, Line3, Matrix4, Plane, Vector3 } from "three"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { defaultCursor, moveCursor, moveHorizontalCursor, moveVerticalCursor } from "src/integrations/cursors/setCursor"
import { getRaycastTarget } from "src/core/selection/raycasting"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { mousePosition, mouseScreenPosition } from "src/core/useMousePosition"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { derivePointsAlongExterior, getLowestTerrainElevationForPoints } from "src/integrations/snapping/snapping-lib"
import { TERRAIN_LENGTH_THRESHOLD } from "src/integrations/tools-common/PlaceMode/notifyLargeScaledGeometries"
import { useRoofAndFloorSnapping } from "./RoofSnapping"
import type { SnapData } from "./affineSnapping"
import { affineSnap, useGetSnappingGroup } from "./affineSnapping"
import { pixelsToMetersAtPosition, removeZ } from "./utils"
import type { RaycastData } from "src/core/selection/raycasting"
import { DesignModeEvents } from "src/core/events/events"
import type { AffineSnap } from "src/integrations/snapping/snapping"
import { raycastOrUndefined } from "src/core/terrain/2d-raytracer"
import { raycastTargetsSignal } from "src/core/selection/raycast-targets"
import { elementSelectionPathToInternalPath, isElementSelectionPath } from "src/core/selection/selectionTypes"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { useTranslator, type I18nStringProvider } from "src/i18n"

function rayCastToHorizontalPlane(planePoint: Vector3, rayCaster: Raycaster) {
  const normal = new Vector3(0, 0, 1)
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, planePoint)
  const newPos = new Vector3()

  rayCaster.ray.intersectPlane(plane, newPos)
  return newPos
}

function rayCastToVerticalPlane(planePoint: Vector3, rayCaster: Raycaster) {
  const normal = sceneManager.camera.getWorldDirection(new Vector3()).setZ(0).multiplyScalar(-1)
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, planePoint)
  const newPos = new Vector3()

  rayCaster.ray.intersectPlane(plane, newPos)
  return newPos
}

export type ToolState = {
  type: "move"
  origin: Vector3
  /**
   * This flag indicates if the origin point is inside the terrain.
   *
   * If this is _NOT_ the case, it means the origin is a raycast on the object
   * being moved itself, and move operations will raycast aainst the horizontal
   * plane of this origin point, rather than raycasting against terrain.
   * The reason for this is that it would otherwise shift x+y position if moving
   * the cursor from outside the terrain into the terrain.
   */
  isOriginInsideTerrain: boolean
  mouseDownPos: number[]
  active: boolean
  moveMode: "terrain" | "horizontal" | "vertical"
}

function cycleMoveMode(current: ToolState["moveMode"]) {
  switch (current) {
    case "terrain":
      return "horizontal"
    case "horizontal":
      return "vertical"
    case "vertical":
      return "terrain"
  }
}

// Undefined if the position is outside terrain.
function findTerrainOrigin(): Vector3 | undefined {
  return mousePosition.intersectObject(sceneManager.scene.getObjectByName("Terrain")!)?.[0]?.point
}

function getToolStartState(mousePosition: Raycaster, targets: Map<Object3D, RaycastData>, movingPaths: Set<string>) {
  const directObjects = [...targets.entries()].filter(([, d]) => d.raycastType === "3d").map(([o]) => o)
  const overlayObjects = [...targets.entries()].filter(([, d]) => d.raycastType === "2d").map(([o]) => o)
  const { closest, allTargetsAtPoint } = getRaycastTarget(mousePosition, directObjects, overlayObjects)

  if (closest) {
    const hitPathIsMoving = allTargetsAtPoint.some((atPoint) => {
      const selectionPath = targets.get(atPoint.object)?.selection
      const path =
        selectionPath && isElementSelectionPath(selectionPath)
          ? elementSelectionPathToInternalPath(selectionPath)
          : undefined
      return path && movingPaths.has(path)
    })
    if (hitPathIsMoving) {
      // Since we're starting in terrain mode, set the origin to the first terrain intersection.
      const originInsideTerrain = findTerrainOrigin()
      return {
        type: "move",
        // Fallback to the closest point if outside terrain.
        origin: originInsideTerrain ?? closest.point,
        isOriginInsideTerrain: originInsideTerrain != null,
      }
    }
  }
}

function getNextQuickMoveCycleState(
  intermediateTranslation: MutableRef<Vector3>,
  transform: MutableRef<Matrix4>,
  toolState: ToolState,
): ToolState {
  intermediateTranslation.current.add(
    new Vector3(transform.current.elements[12], transform.current.elements[13], transform.current.elements[14]),
  )

  const moveMode = cycleMoveMode(toolState.moveMode)
  let origin = toolState.origin.clone().applyMatrix4(transform.current)
  let isOriginInsideTerrain = toolState.isOriginInsideTerrain
  if (moveMode === "terrain") {
    // Undefined if outside terrain, in which case we can't use it.
    const terrainOrigin = findTerrainOrigin()
    if (terrainOrigin) {
      origin = terrainOrigin
    }
    isOriginInsideTerrain = terrainOrigin != null
  }

  return {
    ...toolState,
    moveMode,
    mouseDownPos: [mouseScreenPosition.x, mouseScreenPosition.y],
    origin,
    isOriginInsideTerrain,
  }
}

export const SNAPPING_DISTANCE = 20
let previousDragPos = { x: 0, y: 0 }

export const Affine = ({
  setControlOfVisuals,
  moveGroup3D,
  moveGroup2D,
  movingSnapData,
  targetSnapData,
  apply,
  movingPaths,
  initialState,
  setDuplicate,
  showGuideText = true,
}: {
  moveGroup3D: Object3D
  moveGroup2D: Object3D
  movingSnapData: AffineSnap[]
  targetSnapData: AffineSnap[]
  apply: (m: Matrix4) => any
  movingPaths: Set<string>
  setControlOfVisuals?: (b: boolean) => any
  initialState?: undefined | ToolState
  setDuplicate?: (bool: boolean | ((b: boolean) => boolean)) => void
  showGuideText?: boolean
}) => {
  const terrainSamplerData = terrainSignal.value.terrainSamplerData
  const [toolState, setToolState] = useState<undefined | ToolState>(initialState)
  const transform = useRef(new Matrix4())
  const intermediateTranslation = useRef(new Vector3(0, 0, 0))

  const getSnappingGroup = useGetSnappingGroup()
  const [snappedShapes, setSnappedShapes] = useState<SnapData>()
  const snapGroup = useMemo(() => {
    if (!snappedShapes?.selection) return
    return getSnappingGroup(snappedShapes)
  }, [getSnappingGroup, snappedShapes])
  useObjectLifecycle(snapGroup, !!toolState?.active)

  const resetToolState = useCallback(() => {
    // fire setControl before setting state to get the timing right
    if (toolState?.active && setControlOfVisuals) setControlOfVisuals(false)
    setToolState(undefined)
  }, [toolState, setControlOfVisuals])

  const mousedown = useCallback(
    (e: MouseEvent) => {
      if (e.button === 2) return Propagate.YES
      if (e.shiftKey) return Propagate.YES

      const newToolState = getToolStartState(mousePosition, raycastTargetsSignal.peek(), movingPaths)

      if (!toolState && newToolState) {
        setToolState({
          ...newToolState,
          mouseDownPos: [e.clientX, e.clientY],
          active: false,
          moveMode: "terrain",
        } as ToolState)
        if (e.ctrlKey && setDuplicate) {
          setDuplicate(true)
        }
        return Propagate.NO
      }
      return Propagate.YES
    },
    [movingPaths, toolState, setDuplicate],
  )

  const pointsAlongExterior = useMemo(
    () =>
      derivePointsAlongExterior({
        lines: movingSnapData.flatMap((sd) => sd.lines),
        points: movingSnapData.flatMap((item) => item.points ?? []),
        sampleMaxDistance: TERRAIN_LENGTH_THRESHOLD,
      }),
    [movingSnapData],
  )

  const currentElevation = useMemo(() => {
    if (moveGroup3D.children.length === 0) return 0
    return new Box3().setFromObject(moveGroup3D).min.z
  }, [moveGroup3D])

  const { snapLinesToRoofsAndFloors } = useRoofAndFloorSnapping(movingPaths)

  const filteredMovingSnapData = useMemo(() => {
    // filters moving snap data based on proximity to toolstate origin.
    if (!toolState || !toolState.active) return []
    const p = toolState.origin
    const line = new Line3()
    const closest = new Vector3()
    const snapWithDistance = movingSnapData
      .map((snap) => {
        const minDistance = snap.lines.reduce(
          (acc, { v1, v2 }) => Math.min(acc, line.set(v1, v2).closestPointToPoint(p, true, closest).distanceTo(p)),
          Infinity,
        )
        return {
          distance: minDistance,
          snap,
        }
      })
      .sort((a, b) => a.distance - b.distance)
    const maxMovingSnappingObjects = 1
    return snapWithDistance.slice(0, maxMovingSnappingObjects).map(({ snap }) => snap)
  }, [movingSnapData, toolState])

  const getMatrixFromEvent = useCallback(
    (preventSnapping: boolean) => {
      if (!toolState) return
      if (toolState.type === "move") {
        let translation: Vector3 | undefined
        if (toolState.moveMode === "vertical") {
          // vertical mode
          const currentPosition = rayCastToVerticalPlane(toolState.origin, mousePosition)
          let zDiff = currentPosition.z - toolState.origin.z
          if (!preventSnapping) {
            const targetElevation = currentElevation + zDiff + intermediateTranslation.current.z
            const lines = filteredMovingSnapData
              .flatMap(({ lines }) => lines)
              .map(
                ({ v1, v2 }) =>
                  [
                    v1.clone().add(intermediateTranslation.current),
                    v2.clone().add(intermediateTranslation.current),
                  ] as [Vector3, Vector3],
              )
            const snappedZ = snapLinesToRoofsAndFloors(lines, targetElevation)
            if (snappedZ) zDiff = snappedZ - currentElevation - intermediateTranslation.current.z
          }
          translation = new Vector3(0, 0, zDiff)
          setSnappedShapes(undefined)
        } else {
          // horizontal modes
          let currentPosition: Vector3 | undefined
          if (toolState.moveMode === "terrain" && toolState.isOriginInsideTerrain) {
            const terrain = sceneManager.scene.getObjectByName("Terrain")
            if (terrain) {
              const intersections = mousePosition.intersectObject(terrain)
              if (intersections.length !== 0) {
                currentPosition = intersections[0].point
              }
            }
          }

          // This also covers the case when the cursor either started outside
          // the terrain or at this point is outside terrain,
          // in which case we fallback to regular horizontal mode as there
          // is no terrain to raycast to.
          if (!currentPosition) {
            currentPosition = rayCastToHorizontalPlane(toolState.origin, mousePosition)
          }

          const numMovingLines = filteredMovingSnapData.reduce((acc, s) => acc + s.lines.length, 0)
          const numTargetLines = targetSnapData.reduce((acc, s) => acc + s.lines.length, 0)
          const affordsSnapping = numMovingLines * numTargetLines < 1_000_000
          let snappedShapes: SnapData | undefined = undefined
          if (affordsSnapping && !preventSnapping) {
            const snap = affineSnap(
              filteredMovingSnapData,
              targetSnapData,
              currentPosition.clone().sub(toolState.origin).add(intermediateTranslation.current),
              pixelsToMetersAtPosition(SNAPPING_DISTANCE, sceneManager.camera, currentPosition),
            )
            translation = snap.translation.sub(intermediateTranslation.current)
            if (snap.snapped) snappedShapes = snap.snapData
          } else {
            translation = currentPosition.sub(toolState.origin)
          }

          if (toolState.moveMode === "terrain") {
            // terrain snapping
            const translatedPoints = pointsAlongExterior.map((point) => point.clone().add(translation!))
            const elevationAtPosition = getLowestTerrainElevationForPoints(translatedPoints, (x, y) => {
              return raycastOrUndefined(x, y, terrainSamplerData)
            })
            if (elevationAtPosition != null) {
              translation?.setZ(elevationAtPosition - currentElevation - intermediateTranslation.current.z)
              if (snappedShapes) {
                snappedShapes.selection.shape.forEach((v) => {
                  v.setZ(elevationAtPosition)
                })
              }
            }
          } else {
            translation?.setZ(0)
          }
          setSnappedShapes(snappedShapes)
        }
        if (!translation) return
        return new Matrix4().makeTranslation(translation.x, translation.y, translation.z)
      }
    },
    [
      currentElevation,
      filteredMovingSnapData,
      pointsAlongExterior,
      snapLinesToRoofsAndFloors,
      targetSnapData,
      terrainSamplerData,
      toolState,
    ],
  )

  const updateVisuals = useCallback(
    (preventSnapping: boolean) => {
      const matrix = getMatrixFromEvent(preventSnapping)
      if (!matrix) return Propagate.YES

      const { x, y, z } = intermediateTranslation.current
      const withIntermediate = matrix && new Matrix4().makeTranslation(x, y, z).premultiply(matrix)

      if (withIntermediate) {
        DesignModeEvents.dispatch("tool.affine.preview", withIntermediate.toArray())
        moveGroup3D.matrix.copy(withIntermediate)
        moveGroup3D.matrixAutoUpdate = false
        moveGroup2D.matrix.copy(removeZ(withIntermediate))
        moveGroup2D.matrixAutoUpdate = false
        transform.current.copy(matrix)
        sceneManager.render(!!moveGroup3D.children.length, !!moveGroup2D.children.length)
        return Propagate.NO
      }
      return Propagate.YES
    },
    [getMatrixFromEvent, moveGroup2D, moveGroup3D],
  )

  const mousemove = useCallback(
    (e: MouseEvent | KeyboardEvent) => {
      if (!toolState) {
        return Propagate.YES
      } else {
        if (toolState && !toolState.active) {
          // check correct keys and wait for movement before activating the tool
          if (
            e instanceof KeyboardEvent ||
            e.button === 2 ||
            (toolState &&
              (e.clientX - toolState.mouseDownPos[0]) ** 2 + (e.clientY - toolState.mouseDownPos[1]) ** 2 < 10)
          ) {
            return Propagate.YES
          } else {
            DesignModeEvents.dispatch("tool.edit.start", { toolId: "affine" })
            setControlOfVisuals && setControlOfVisuals(true)
            setToolState({ ...toolState, active: true })
          }
        }
        return updateVisuals(e instanceof MouseEvent && e.altKey)
      }
    },
    [toolState, updateVisuals, setControlOfVisuals],
  )

  const dragover = useCallback(
    (e: MouseEvent | KeyboardEvent) => {
      const event = e as DragEvent
      event.preventDefault()
      if (previousDragPos.x === event.x && previousDragPos.y === event.y) return Propagate.YES
      previousDragPos = { x: event.x, y: event.y }
      return mousemove(e)
    },
    [mousemove],
  )

  // reset the transform when deactivating tool
  useEffect(() => {
    if (!toolState?.active) {
      transform.current.identity()
      intermediateTranslation.current.set(0, 0, 0)
    }
  }, [toolState?.active])

  // update transform on movegroups if they get reinitialized (e.g. due to saving logic updating elements)
  useLayoutEffect(() => {
    const { x, y, z } = intermediateTranslation.current
    const withIntermediate = new Matrix4().makeTranslation(x, y, z).premultiply(transform.current)
    moveGroup3D.matrix.copy(withIntermediate)
    moveGroup3D.matrixAutoUpdate = false
    moveGroup2D.matrix.copy(removeZ(withIntermediate))
    moveGroup2D.matrixAutoUpdate = false
  }, [moveGroup2D, moveGroup3D])

  const mouseup = useCallback(
    (e: MouseEvent) => {
      if (toolState) {
        if (!toolState.active) {
          resetToolState()
          return Propagate.YES
        }

        const matrix = getMatrixFromEvent(e.altKey)
        transform.current.identity()

        if (toolState.type === "move") {
          if (matrix) {
            const { x, y, z } = intermediateTranslation.current
            const intermediateMatrix = new Matrix4().makeTranslation(x, y, z)
            apply(matrix.premultiply(intermediateMatrix))
            intermediateTranslation.current.set(0, 0, 0)
          }
          resetToolState()
          DesignModeEvents.dispatch("tool.edit.end")
          return Propagate.NO
        }
      }
      return Propagate.YES
    },
    [apply, getMatrixFromEvent, resetToolState, toolState],
  )

  const ctrlDownTime = useRef<number | null>(null)
  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (!toolState?.active) return Propagate.YES
      if (e.key === "Escape") {
        resetToolState()
        DesignModeEvents.dispatch("tool.edit.end")
        return Propagate.NO
      } else if (e.key === "Tab") {
        if (toolState?.type === "move" && moveGroup3D.children.length > 0) {
          const nextQuickMoveState = getNextQuickMoveCycleState(intermediateTranslation, transform, toolState)
          setToolState(nextQuickMoveState)
        }
        e.preventDefault()
        return Propagate.NO
      } else if (e.key === "Control" && !ctrlDownTime.current) {
        setTimeout(() => (ctrlDownTime.current = Date.now()), 0)
        setDuplicate?.((current) => !current)
        return Propagate.NO
      }
      return Propagate.YES
    },
    [moveGroup3D.children.length, resetToolState, setDuplicate, toolState],
  )

  useEffect(() => {
    if (toolState?.type === "move") updateVisuals(false)
  }, [toolState?.type, toolState?.moveMode, updateVisuals])

  const keyup = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        mousemove(e)
      } else if (e.key === "Control") {
        if (ctrlDownTime.current && Date.now() - ctrlDownTime.current > 300) {
          setDuplicate?.(false)
        }
        ctrlDownTime.current = null
        return Propagate.NO
      }
      return Propagate.YES
    },
    [mousemove, setDuplicate],
  )

  const t = useTranslator()

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    if (toolState?.type !== "move" || !showGuideText) return
    const isMac = navigator.userAgent.toLowerCase().includes("mac")
    setGuideText(
      (): I18nStringProvider => (t) =>
        t(($) => $.shapeTool.instructions.affineInstructions, { key: isMac ? "⌥ Option" : "Alt" }),
    )
    return () => setGuideText(() => () => "")
  }, [setGuideText, showGuideText, toolState?.type, t])

  useEventHandler("mousedown", mousedown, Priority.AFFINE_TOOL, sceneManager.canvas)
  useEventHandler("mousemove", mousemove, Priority.AFFINE_TOOL, sceneManager.canvas)
  useEventHandler("dragover", dragover, Priority.AFFINE_TOOL, sceneManager.canvas)
  useEventHandler("mouseup", mouseup, Priority.AFFINE_TOOL, sceneManager.canvas)
  useEventHandler("drop", mouseup, Priority.AFFINE_TOOL, sceneManager.canvas)
  useEventHandler("keydown", keydown, Priority.AFFINE_TOOL, sceneManager.canvas)
  useEventHandler("keyup", keyup, Priority.AFFINE_TOOL, sceneManager.canvas)

  useEffect(() => {
    if (toolState?.type === "move") {
      switch (toolState.moveMode) {
        case "vertical":
          moveVerticalCursor()
          break
        case "horizontal":
          moveHorizontalCursor()
          break
        case "terrain":
          moveCursor()
          break
        default:
          defaultCursor()
      }
    }

    return () => defaultCursor()
  }, [toolState])

  return null
}
