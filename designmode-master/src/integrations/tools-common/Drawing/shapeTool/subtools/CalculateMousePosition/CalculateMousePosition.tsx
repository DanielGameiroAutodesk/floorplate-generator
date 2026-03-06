import { useCallback, useEffect, useMemo, useState } from "preact/compat"
import {
  SNAP_TO_LINE_LENGTH,
  SNAP_TO_LINE_LENGTH_TERRAIN,
} from "src/integrations/tools-common/Drawing/shapeTool/utils/ShapeToolFunctions"
import type { Raycaster } from "three"
import { Line3, Plane, Vector3 } from "three"
import {
  currentSnapInfoSignal,
  enableSnappingSignal,
  lockedSnapLineSignal,
  selectedDerivedSnappingLinesSignal,
  setCurrentSnapInfoSignalValue,
  setEnableSnappingSignalValue,
  userDefinedSnapToGuidesSignal,
} from "src/integrations/snapping/snappingPicker.state"
import { BBoxOctree } from "src/lib/three/BBoxOctree/BBoxOctree"
import { SnappingIndicator } from "src/integrations/snapping/SnappingIndicator"
import type { SnapInfo, SnappingPoint } from "src/integrations/snapping/snappingEngine"
import { repositionLockedLineSnapping, snap } from "src/integrations/snapping/snappingEngine"
import { intersectScene } from "src/integrations/snapping/snappingEngineHelpers"
import { mousePosition } from "src/core/useMousePosition"
import { projectPositionToTerrain } from "src/integrations/tools-common/Drawing/shapeTool/common/utils/projection"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { isDefined } from "src/lib/array"
import { useRoofAndFloorSnapping } from "src/integrations/tools-common/AffineTooling/RoofSnapping"
import useIs2D from "src/core/three/useIs2d"
import { HiddenPaths } from "src/core/hidden"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import SnappingPicker from "src/integrations/snapping/snapping-picker/SnappingPicker"
import { samePoint } from "src/lib/three/geometryUtils"
import { getCurrentDrawAngle, getRepositionedCurrentPoint } from "./trigonometryUtils"
import { bboxOctreeSnappingLinesSignal } from "src/integrations/snapping/bboxOctreeSnappingLines"
import { getRaycastableMeshesForVisibleNodesSignal } from "src/core/elements/child-node-container-derived-data/volumeMeshWithAcceleratedRaycast"
import { exitCurrentTool } from "src/core/toolsState"
import { raycast } from "src/core/terrain/2d-raytracer"
import { makeParallelAndOrthogonalSnappingLines } from "src/integrations/snapping/makeParallelAndOrthogonalSnappingLines"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export type Guide = {
  direction: Vector3
  stepSize?: number
  min?: number
  max?: number
}

type Props = {
  startPoint?: Vector3
  maxLength?: number
  currentShapeSnappingLines?: SnappingLine[]
  onTerrain: boolean
  onChange: (newPos: Vector3) => any
  onCancel?: () => void
  moveMode?: ShapeToolMoveMode
  placedVertices?: Vector3[]
  setCurrentPosByAngleInput?: (newPos: Vector3) => void
  useDerivedSnappingLines?: boolean
  commitCurrentPreview?: () => void
  guide?: Guide
  showSnappingPoints?: boolean
  hideFloatingInputs?: boolean
  ignoreTerrainSnappingLines?: boolean
  enableSnappingPicker?: boolean
  customSnappingPoints?: SnappingPoint[]
  discreteLength?: number
}
const UP = new Vector3(0, 0, 1)
const lockLine = new Line3()
const NO_SNAPPING_LINES: SnappingLine[] = []

const lockPlane = new Plane()

export const disableSnappingHotkeys = ["Alt", "Option"]

// ensure stable identity of placedVertices if parent component passes down undefined
const emptyVertices: Vector3[] = []
const emptySet = new Set<string>()

const reusablePosition = new Vector3()

export const CalculateMousePosition = (props: Props) => {
  return <CalculateMousePositionInner {...props} />
}

const CalculateMousePositionInner = ({
  startPoint,
  onTerrain,
  onChange,
  onCancel,
  currentShapeSnappingLines = NO_SNAPPING_LINES,
  moveMode,
  placedVertices = emptyVertices,
  setCurrentPosByAngleInput,
  useDerivedSnappingLines = true,
  commitCurrentPreview,
  guide,
  showSnappingPoints = true,
  hideFloatingInputs,
  maxLength,
  ignoreTerrainSnappingLines,
  enableSnappingPicker,
  customSnappingPoints,
  discreteLength,
}: Props) => {
  const pos = mousePosition

  const [currentPos, setCurrentPos] = useState<Vector3 | undefined>(undefined)

  const [manualLength, setManualLength] = useState<number>()
  const [userDefinedAngle, setUserDefinedAngle] = useState<number | undefined>(undefined)
  const snapInfo = currentSnapInfoSignal.value
  const selectedDerivedLines = selectedDerivedSnappingLinesSignal.value
  const lockedSnapLine = lockedSnapLineSignal.value
  const terrainSamplerData = terrainSignal.value.terrainSamplerData
  const hiddenPaths = HiddenPaths.hiddenPathsSignal.value
  const userDefinedSnapToGuide = userDefinedSnapToGuidesSignal.value

  const snappingEnabled = enableSnappingSignal.value

  const currentLength = useMemo(() => {
    if (!startPoint || !currentPos) return undefined
    const diff = reusablePosition.subVectors(currentPos, startPoint)

    if (onTerrain) diff.setZ(0)

    return diff.length()
  }, [startPoint, currentPos, onTerrain])

  const currentAngle = useMemo(() => {
    if (!currentPos) return 0

    if (placedVertices?.length) {
      const firstPlacedPoint = placedVertices[0]
      const lastPlacedPoint = placedVertices[placedVertices.length - 1]

      // When hovering same point as last placed, tools autocompletes the shape to the first point.
      // Get angle to the first placed point instead.
      if (samePoint(lastPlacedPoint, currentPos)) {
        return getCurrentDrawAngle(userDefinedAngle, placedVertices.concat(firstPlacedPoint))
      }
    }
    return getCurrentDrawAngle(userDefinedAngle, placedVertices.concat(currentPos))
  }, [placedVertices, currentPos, userDefinedAngle])

  const repositionCurrentPointByAngle = useCallback(
    (position: Vector3) => {
      return (
        userDefinedAngle !== undefined &&
        startPoint !== undefined &&
        setCurrentPosByAngleInput &&
        getRepositionedCurrentPoint(
          placedVertices,
          userDefinedAngle,
          position.clone().sub(startPoint).length(),
          position,
          moveMode === ShapeToolMoveMode.TERRAIN ? terrainSamplerData : undefined,
        )
      )
    },
    [moveMode, userDefinedAngle, startPoint, setCurrentPosByAngleInput, placedVertices, terrainSamplerData],
  )

  const currentShapeOctree = useMemo(() => {
    const octree = new BBoxOctree<SnappingLine>()
    currentShapeSnappingLines.forEach((l) => {
      if (!userDefinedSnapToGuide && l.type !== "LINE") return
      l.segments.forEach((seg) => octree.set(seg.bbox, l))
    })
    return octree
  }, [currentShapeSnappingLines, userDefinedSnapToGuide])

  useEffect(() => {
    setManualLength(undefined)
    setUserDefinedAngle(undefined)
  }, [startPoint])

  const parallellAndOrthogonalLines: SnappingLine[] = useMemo(() => {
    if (!startPoint || moveMode === ShapeToolMoveMode.VERTICAL) return []

    return makeParallelAndOrthogonalSnappingLines(selectedDerivedLines, startPoint, terrainSamplerData)
  }, [moveMode, selectedDerivedLines, startPoint, terrainSamplerData])

  const rayCastingTargets = getRaycastableMeshesForVisibleNodesSignal.value({ ignoreVirtualNodes: true })

  const getUnsnappedPosition = useCallback(
    (raycaster: Raycaster): Vector3 | undefined => {
      if (guide && startPoint) {
        const planeNormal = sceneManager.camera.getWorldDirection(new Vector3()).cross(UP).cross(guide.direction)
        lockPlane.setFromNormalAndCoplanarPoint(planeNormal, startPoint)
        return raycaster.ray.intersectPlane(lockPlane, new Vector3()) || undefined
      } else if (moveMode === ShapeToolMoveMode.VERTICAL && startPoint) {
        const position = new Vector3()
        raycaster.ray.distanceSqToSegment(
          startPoint.clone().setZ(-1000),
          startPoint.clone().setZ(10000),
          undefined,
          position,
        )
        return position
      } else if (moveMode === ShapeToolMoveMode.HORIZONTAL && startPoint) {
        lockPlane.set(UP, -startPoint.z)
        return raycaster.ray.intersectPlane(lockPlane, new Vector3()) || undefined
      }

      return intersectScene(
        raycaster,
        // Since we want the unsnapped position here, we only use meshes for the raycasting. If we use Line/Line2, we
        // end up "hitting" the line, even though we are quite far away from the line. This makes us "snap" to edges
        // of buildings even though we don't want to.
        rayCastingTargets.filter((rt) => rt.type === "Mesh"),
      )
    },
    [guide, moveMode, rayCastingTargets, startPoint],
  )

  const grid = undefined

  const is2D = useIs2D()
  const { snapPointToRoofsAndFloors } = useRoofAndFloorSnapping(emptySet)
  const repositionBasedOnMoveMode = useCallback(
    (position: Vector3) => {
      if (guide && startPoint) {
        const repositioned = new Vector3()
        lockLine
          .set(startPoint.clone(), startPoint.clone().add(guide.direction))
          .closestPointToPoint(position, false, repositioned)
        const diff = repositioned.clone().sub(startPoint)
        if (guide.min !== undefined && diff.dot(guide.direction) < 0) {
          diff.clampLength(0, -guide.min)
          repositioned.addVectors(startPoint, diff)
          repositioned.addVectors(startPoint, diff)
        }
        if (guide.max !== undefined && diff.dot(guide.direction) > 0) {
          diff.clampLength(0, guide.max)
          repositioned.addVectors(startPoint, diff)
        }
        if (guide.stepSize) {
          const steps = diff.length() / guide.stepSize
          repositioned.copy(startPoint.clone().add(diff.multiplyScalar(Math.round(steps) / steps)))
        }
        return repositioned
      } else if (onTerrain) {
        return projectPositionToTerrain(position)
      } else if (moveMode === ShapeToolMoveMode.VERTICAL && startPoint) {
        const repositioned = new Vector3()
        lockLine.set(startPoint.clone(), startPoint.clone().add(UP)).closestPointToPoint(position, false, repositioned)
        return repositioned
      } else if (moveMode === ShapeToolMoveMode.HORIZONTAL && startPoint) {
        lockPlane.setFromNormalAndCoplanarPoint(UP, startPoint)
        return lockPlane.projectPoint(position, position.clone())
      } else if (moveMode === ShapeToolMoveMode.HORIZONTAL && !startPoint && is2D) {
        const triangles = snapPointToRoofsAndFloors(position, false)
        if (triangles.length) {
          const maxZ = triangles.reduce((max, tri) => Math.max(max, tri.a.z), 0)
          return position.clone().setZ(maxZ)
        } else {
          return position.clone().setZ(raycast(position.x, position.y, terrainSamplerData))
        }
      }

      return position
    },
    [onTerrain, guide, startPoint, moveMode, is2D, snapPointToRoofsAndFloors, terrainSamplerData],
  )

  const cullBasedOnStartPointAndGuide = useMemo(() => {
    if ((!guide && moveMode !== ShapeToolMoveMode.VERTICAL) || !startPoint) return

    const guideDir = (guide ? guide.direction : UP).clone().multiplyScalar(1000)
    const a = startPoint.clone().sub(guideDir)
    const b = startPoint.clone().add(guideDir)

    // prevents snapping to points that are close to the guide.
    return (position: Vector3) => {
      const pointOnGuide = new Vector3()
      const distanceSq = mousePosition.ray.distanceSqToSegment(a, b, undefined, pointOnGuide)
      const snapCam = new Vector3().subVectors(position, sceneManager.camera.position)
      const guideCam = new Vector3().subVectors(pointOnGuide, sceneManager.camera.position)
      return guideCam.length() > snapCam.length() || distanceSq > 1
    }
  }, [guide, moveMode, startPoint])

  const mousemove = useCallback(() => {
    let snapped: SnapInfo | undefined = undefined

    if (snappingEnabled) {
      const lines =
        currentShapeOctree && useDerivedSnappingLines
          ? bboxOctreeSnappingLinesSignal.peek().concat([currentShapeOctree])
          : bboxOctreeSnappingLinesSignal.peek()

      snapped = snap(
        pos,
        rayCastingTargets,
        lines,
        useDerivedSnappingLines ? selectedDerivedLines.concat(parallellAndOrthogonalLines) : [],
        lockedSnapLine,
        grid,
        terrainSamplerData,
        hiddenPaths,
        cullBasedOnStartPointAndGuide,
        ignoreTerrainSnappingLines,
        customSnappingPoints,
      )
    }
    if (!snapped) {
      const position = getUnsnappedPosition(pos)
      if (!position) {
        snapped = undefined
      } else {
        snapped = {
          position,
          orgSnappingPos: position,
          type: "NOT_SNAPPED",
          data: undefined,
          candidateLines: [],
        }
      }
    }
    if (!snapped) {
      setCurrentSnapInfoSignalValue(undefined)
      return Propagate.NO
    }

    if (lockedSnapLine) repositionLockedLineSnapping({ onTerrain, snapped, lockedSnapLine })

    snapped.position = repositionBasedOnMoveMode(snapped.position)
    const repositionedByAngle = repositionCurrentPointByAngle(snapped.position)
    if (repositionedByAngle) snapped.position = repositionedByAngle

    const position = snapped.position

    let max = manualLength ?? maxLength
    if (max !== undefined && startPoint) {
      if (guide) {
        const diff = position.clone().sub(startPoint)
        const sign = diff.dot(guide.direction) > 0 ? 1 : -1
        if (sign < 0 && guide.min !== undefined) {
          max = Math.min(max, -guide.min)
        } else if (guide.max !== undefined) {
          max = Math.min(max, guide.max)
        }
      }

      if (onTerrain) {
        const atLineLengthTerrain = SNAP_TO_LINE_LENGTH_TERRAIN(max, startPoint, terrainSamplerData)(position)
        position?.copy(atLineLengthTerrain)
      } else if (moveMode === ShapeToolMoveMode.VERTICAL) {
        const atLineLength = SNAP_TO_LINE_LENGTH(max, startPoint, "vertical")(position)
        position?.copy(atLineLength)
      } else if (moveMode === ShapeToolMoveMode.HORIZONTAL) {
        const atLineLength = SNAP_TO_LINE_LENGTH(max, startPoint, "horizontal")(position)
        position?.copy(atLineLength)
      }
    }

    // if discreteLength parameter is set, lock the length to an interval of this
    if (discreteLength && startPoint && (!snapped || snapped.type === "NOT_SNAPPED")) {
      const currentLength = position.clone().sub(startPoint).length()
      if (currentLength) {
        const newLength = Math.round(currentLength / discreteLength) * discreteLength
        position.sub(startPoint).normalize().multiplyScalar(newLength).add(startPoint)
      }
    }

    setCurrentSnapInfoSignalValue(snapped)

    setCurrentPos(position)
    onChange(position)

    sceneManager.render()
    return Propagate.YES
  }, [
    snappingEnabled,
    lockedSnapLine,
    onTerrain,
    repositionBasedOnMoveMode,
    repositionCurrentPointByAngle,
    manualLength,
    maxLength,
    startPoint,
    discreteLength,
    currentShapeOctree,
    useDerivedSnappingLines,
    pos,
    rayCastingTargets,
    selectedDerivedLines,
    parallellAndOrthogonalLines,
    grid,
    terrainSamplerData,
    hiddenPaths,
    cullBasedOnStartPointAndGuide,
    ignoreTerrainSnappingLines,
    customSnappingPoints,
    getUnsnappedPosition,
    guide,
    moveMode,
    onChange,
  ])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && (isDefined(manualLength) || isDefined(userDefinedAngle))) {
        commitCurrentPreview && commitCurrentPreview()
        return Propagate.NO
      }

      if (disableSnappingHotkeys.includes(e.key)) {
        e.preventDefault() // prevent alt key from shifting focus away from window on Windows, preventing future keydowns from registering.
        setEnableSnappingSignalValue(false)
      }

      return Propagate.YES
    },
    [manualLength, userDefinedAngle, commitCurrentPreview],
  )
  const keyup = useCallback(
    (e: KeyboardEvent) => {
      if (disableSnappingHotkeys.includes(e.key)) {
        setEnableSnappingSignalValue(true)
      }
      mousemove()
      return Propagate.YES
    },
    [mousemove],
  )
  // always re-enable snapping on unmount.
  useEffect(() => () => setEnableSnappingSignalValue(true), [])
  useEventHandler("keydown", keydown, Priority.COMPUTE_MOUSE_POSITION)
  useEventHandler("keyup", keyup, Priority.COMPUTE_MOUSE_POSITION)
  useEventHandler("mousemove", mousemove, Priority.COMPUTE_MOUSE_POSITION)

  const mousedown = useCallback(() => {
    setUserDefinedAngle(undefined)
    return Propagate.YES
  }, [setUserDefinedAngle])

  useEventHandler("mousedown", mousedown, Priority.TOOL_INPUT)

  const floatingDialogFields = useMemo(() => {
    const enableAngle = moveMode !== ShapeToolMoveMode.VERTICAL && !!setCurrentPosByAngleInput
    const fields: ControlContextValue[] = []

    fields.push({
      type: moveMode === ShapeToolMoveMode.VERTICAL ? "vertical" : "horizontal",
      value: currentLength || 0,
      change: setManualLength,
      submit: commitCurrentPreview,
    })
    if (enableAngle) {
      fields.push({
        type: "angle",
        value: currentAngle,
        change: setUserDefinedAngle,
        submit: commitCurrentPreview,
      })
    }

    return fields
  }, [commitCurrentPreview, currentAngle, currentLength, moveMode, setCurrentPosByAngleInput])

  return (
    <>
      {startPoint && !hideFloatingInputs && (
        <FloatingToolInputs cancel={onCancel || exitCurrentTool} fields={floatingDialogFields} />
      )}
      {(!startPoint || (snapInfo && startPoint.distanceTo(snapInfo.position) > 0.001)) && (
        <SnappingIndicator snapInfo={snapInfo} showSnappingPoints={showSnappingPoints} />
      )}
      {enableSnappingPicker && snapInfo && <SnappingPicker candidateLines={snapInfo.candidateLines} />}
    </>
  )
}
