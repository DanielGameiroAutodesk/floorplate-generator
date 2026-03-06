import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks"
import { useSetRecoilState } from "recoil"
import type { Group, Vector3 } from "three"
import { Matrix4, OrthographicCamera } from "three"
import { isAnythingSelectedSignal, selectionSetSignal } from "src/core/selection/selectionState"
import sceneManager from "src/core/three/sceneManager"
import { HiddenPaths } from "src/core/hidden"
import { useMoveGroup } from "./utils"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import { useApplyAffine } from "./transformActions"
import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { defaultCursor, moveCursor, moveHorizontalCursor, moveVerticalCursor } from "src/integrations/cursors/setCursor"
import type {
  ControlContextValue,
  ValueTypes,
} from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { CalculateMousePosition } from "src/integrations/tools-common/Drawing/shapeTool/subtools/CalculateMousePosition/CalculateMousePosition"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { DashedLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DashedLineSegment"
import type RenderGroup from "src/integrations/renderables/RenderGroup"
import type { Segment } from "src/lib/geometry/geometryTypes"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import type { SnappingLine } from "src/integrations/snapping/snapping"
import type { SnappingPoint } from "src/integrations/snapping/snappingEngine"
import { isDefined } from "src/lib/array"
import { DesignModeEvents } from "src/core/events/events"
import { exitCurrentTool } from "src/core/toolsState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"
import { useTranslator, type I18nStringProvider } from "src/i18n"

const identity = new Matrix4()

function getTranslationFromLineSegment(l: Segment, horizontal = false): Matrix4 {
  const x = l[1][0] - l[0][0]
  const y = l[1][1] - l[0][1]
  const z = horizontal ? 0 : l[1][2] - l[0][2]
  return new Matrix4().makeTranslation(x, y, z)
}

type PreviewRendererProps = {
  hideOriginalElements: boolean
  moveGroup3D: RenderGroup
  moveGroup2D: Group
  showMoveGroup: boolean
  setShowMoveGroup: (show: boolean) => void
}
const createPreviewRenderer =
  ({
    hideOriginalElements,
    moveGroup3D,
    moveGroup2D,
    showMoveGroup,
    setShowMoveGroup,
  }: PreviewRendererProps): LineSegmentRenderer =>
  ({ lineSegment }) => {
    // Ignoring lint rule as this is an edge case where this is
    // returning an component.
    // eslint-disable-next-line local/signals-explicit-naming
    const selectedIds = selectionSetSignal.value

    useLayoutEffect(() => {
      if (!lineSegment) return
      const mat3D = getTranslationFromLineSegment(lineSegment, sceneManager.camera instanceof OrthographicCamera)
      moveGroup3D.matrix.copy(mat3D)
      moveGroup3D.matrixAutoUpdate = false
      const mat2D = getTranslationFromLineSegment(lineSegment, true)
      moveGroup2D.matrix.copy(mat2D)
      moveGroup2D.matrixAutoUpdate = false

      DesignModeEvents.dispatch("tool.affine.preview", mat3D.toArray())

      setShowMoveGroup(mat3D !== identity)
      sceneManager.render(true, true)
    }, [lineSegment, selectedIds])

    useEffect(() => {
      HiddenPaths.setPathsHidden(selectedIds, hideOriginalElements && showMoveGroup)
      return () => HiddenPaths.setPathsHidden(selectedIds, false)
    }, [selectedIds])

    return null
  }

const PreciseMove = () => {
  const { elevationAt } = terrainSignal.value
  const isAnythingSelected = isAnythingSelectedSignal.value
  const [duplicateMode, setDuplicateMode] = useState(false)
  const [firstPoint, setFirstPoint] = useState<Vector3 | undefined>(undefined)
  const [constrainPoint, setConstrainPoint] = useState<Vector3 | undefined>(undefined)
  const [currentPoint, setCurrentPoint] = useState<Vector3 | undefined>(undefined)

  useEffect(() => {
    if (!isAnythingSelected) exitCurrentTool()
  }, [isAnythingSelected])

  const applyAffine = useApplyAffine()

  const onComplete = useCallback(
    (l: Segment) => {
      const affineMatrix = getTranslationFromLineSegment(l, sceneManager.is2D)
      void applyAffine(affineMatrix, duplicateMode)
      exitCurrentTool()
    },
    [applyAffine, duplicateMode],
  )

  const lineSegment = useMemo(() => {
    if (!firstPoint || !currentPoint) return undefined
    return [firstPoint.toArray(), currentPoint.toArray()] as Segment
  }, [currentPoint, firstPoint])

  const addPoint = useCallback(() => {
    if (!currentPoint) return
    if (!firstPoint) {
      setFirstPoint(currentPoint)
    } else if (lineSegment) {
      onComplete(lineSegment)
    }
  }, [currentPoint, firstPoint, lineSegment, onComplete])

  const ctrlDownTime = useRef<number | null>(null)
  const onKeydown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && !ctrlDownTime.current) {
      setDuplicateMode((current) => !current)
      setTimeout(() => (ctrlDownTime.current = Date.now()), 0)
      return Propagate.NO
    } else if (e.key === "Escape") {
      exitCurrentTool()
    }
    return Propagate.YES
  }, [])

  useEventHandler("keydown", onKeydown, Priority.MOVE_TOOL)

  const onKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Control") {
        if (ctrlDownTime.current && Date.now() - ctrlDownTime.current > 300) {
          setDuplicateMode((current) => !current)
          ctrlDownTime.current = null
          return Propagate.NO
        }
      }
      if (e.key === "Enter" && lineSegment) {
        onComplete(lineSegment)
        return Propagate.NO
      }
      return Propagate.YES
    },
    [lineSegment, onComplete],
  )

  useEventHandler("keyup", onKeyUp, Priority.MOVE_TOOL)

  const onMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button === 0) {
        addPoint()
      }
      return Propagate.NO
    },
    [addPoint],
  )

  useEventHandler("mouseup", onMouseUp, Priority.MOVE_TOOL)

  const t = useTranslator()

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    const isMac = navigator.userAgent.toLowerCase().includes("mac")
    setGuideText(
      (): I18nStringProvider => (t) =>
        [
          t(($) => $.shapeTool.instructions.preciseMoveVertical, { key: "Tab ↹" }),
          t(($) => $.shapeTool.instructions.activateGuideLines, { key: isMac ? "⌥ Option" : "Alt" }),
        ].join(" "),
    )
    return () => setGuideText(() => () => "")
  }, [setGuideText, t])

  const [showMoveGroup, setShowMoveGroup] = useState(false)
  const { moveGroup3D, moveGroup2D } = useMoveGroup(showMoveGroup)
  const PreviewRenderer = useMemo(
    () =>
      createPreviewRenderer({
        hideOriginalElements: !duplicateMode,
        showMoveGroup,
        setShowMoveGroup,
        moveGroup3D,
        moveGroup2D,
      }),
    [duplicateMode, moveGroup2D, moveGroup3D, showMoveGroup],
  )

  const [mode, setMode] = useState<"horizontal" | "vertical" | "masl" | "none" | "magl">("none")
  const [horizontalInput, setHorizontalInput] = useState<number | undefined>(undefined)
  const [verticalInput, setVerticalInputInput] = useState<number | undefined>(undefined)
  const [maglInput, setMaglInput] = useState<number | undefined>()
  const [maslInput, setMaslInput] = useState<number | undefined>()

  const verticalDisabled = useMemo(() => moveGroup3D.children.length == 0, [moveGroup3D.children.length])

  useEffect(() => {
    switch (mode) {
      case "none":
        moveCursor()
        break
      case "horizontal":
        moveHorizontalCursor()
        break
      case "vertical":
      case "magl":
      case "masl":
        moveVerticalCursor()
        break
      default:
        defaultCursor()
    }
    return () => defaultCursor()
  }, [mode])

  const derivedHorizontal = useMemo(() => {
    if (mode === "horizontal" && horizontalInput) return horizontalInput
    if (!firstPoint || !currentPoint) return undefined
    return ((currentPoint.x - firstPoint.x) ** 2 + (currentPoint.y - firstPoint.y) ** 2) ** 0.5
  }, [currentPoint, firstPoint, horizontalInput, mode])

  const derivedVertical = useMemo(() => {
    if (mode === "vertical" && verticalInput) return verticalInput
    if (!firstPoint || !currentPoint) return
    return currentPoint.z - firstPoint.z
  }, [currentPoint, firstPoint, verticalInput, mode])

  const derivedMasl = useMemo(() => {
    if (mode === "masl" && maslInput) return maslInput
    if (!currentPoint) return
    return currentPoint.z
  }, [currentPoint, maslInput, mode])

  const derivedMagl = useMemo(() => {
    if (mode === "magl" && maglInput) return maglInput
    if (!currentPoint) return
    return currentPoint.z - elevationAt(currentPoint.x, currentPoint.y)
  }, [currentPoint, elevationAt, maglInput, mode])

  const handleMaslChange = useCallback(
    (newMasl: number | undefined) => {
      if (isDefined(newMasl) && firstPoint) {
        setMaslInput(newMasl)
        setVerticalInputInput(newMasl - firstPoint.z)
      } else {
        setMaslInput(undefined)
        setVerticalInputInput(undefined)
      }
    },
    [firstPoint],
  )

  const handleMaglChange = useCallback(
    (newMagl: number | undefined) => {
      if (isDefined(newMagl) && firstPoint) {
        const firstPointMagl = firstPoint.z - elevationAt(firstPoint.x, firstPoint.y)
        setMaglInput(newMagl)
        setVerticalInputInput(newMagl - firstPointMagl)
      } else {
        setMaslInput(undefined)
        setVerticalInputInput(undefined)
      }
    },
    [elevationAt, firstPoint],
  )

  const fields = useMemo<ControlContextValue[]>(
    () => [
      {
        type: "none",
        value: 0,
        change: () => {}, // switch to horizontal?
      },
      {
        type: "horizontal",
        value: derivedHorizontal ?? 0,
        change: setHorizontalInput,
        submit: () => {}, // switch to vertical?
        metricMin: -2000,
      },
      {
        type: "vertical",
        value: derivedVertical ?? 0,
        change: setVerticalInputInput,
        disabled: verticalDisabled,
        metricMin: -2000,
      },
      {
        type: "masl",
        value: derivedMasl ?? 0,
        change: handleMaslChange,
        disabled: verticalDisabled,
        metricMin: -2000,
      },
      {
        type: "magl",
        value: derivedMagl ?? 0,
        change: handleMaglChange,
        disabled: verticalDisabled,
        metricMin: -2000,
      },
    ],
    [
      derivedHorizontal,
      derivedMagl,
      derivedMasl,
      derivedVertical,
      handleMaglChange,
      handleMaslChange,
      verticalDisabled,
    ],
  )

  const resetInputValues = useCallback(() => {
    setVerticalInputInput(undefined)
    setMaslInput(undefined)
    setMaglInput(undefined)
    setHorizontalInput(undefined)
  }, [])

  const currentPointRef = useRef<Vector3 | undefined>(undefined)
  currentPointRef.current = currentPoint // use this ref to avoid re-creating the onFocus callback, causing it to be called from within DrawToolFloatingDialog
  const onFocus = useCallback(
    (value: ValueTypes) => {
      if (value !== "horizontal" && value !== "vertical" && value !== "masl" && value !== "none" && value !== "magl")
        return

      // Don't cycle to vertical when vertical disabled.
      if (value === "vertical" && verticalDisabled) {
        setConstrainPoint(undefined)
        setMode("none")
        return
      }

      if (value === "horizontal" || value === "vertical") {
        setConstrainPoint(firstPoint?.clone())
      } else if (value === "none") {
        resetInputValues()
        setConstrainPoint(undefined)
      }
      setMode(value)
    },
    [firstPoint, resetInputValues, verticalDisabled],
  )

  const horizontalLineSegment = useMemo(() => {
    if (!firstPoint || !currentPoint) return undefined
    return [firstPoint.toArray(), [currentPoint.x, currentPoint.y, firstPoint.z]] as Segment
  }, [currentPoint, firstPoint])

  const verticalLineSegment = useMemo(() => {
    if (!firstPoint || !currentPoint) return undefined
    return [currentPoint.toArray(), [currentPoint.x, currentPoint.y, firstPoint.z]] as Segment
  }, [currentPoint, firstPoint])

  /* Creates helper line from first point vertically */
  const verticalSnappingLine: SnappingLine[] = useMemo(() => {
    if (!firstPoint || mode === "horizontal") return []
    return [
      snappingLineFromEndpoints(firstPoint, firstPoint?.clone().setZ(firstPoint.z + 500), "LINE", false, undefined),
    ]
  }, [firstPoint, mode])

  /* Creates snapping point to be able to snap to start again */
  const firstPointAsSnappingPoint: SnappingPoint[] = useMemo(() => {
    if (!firstPoint) return []
    return [{ position: firstPoint.clone(), type: "POINT" }]
  }, [firstPoint])

  const currentMoveMode = useMemo(() => {
    if (["vertical", "magl", "masl"].includes(mode)) return ShapeToolMoveMode.VERTICAL
    if (mode === "horizontal") return ShapeToolMoveMode.HORIZONTAL
    return ShapeToolMoveMode.TERRAIN
  }, [mode])

  const currentLength = useMemo(() => {
    if (mode === "horizontal") return horizontalInput
    if (["vertical", "magl", "masl"].includes(mode)) return verticalInput
    return undefined
  }, [horizontalInput, mode, verticalInput])

  return (
    <>
      <CalculateMousePosition
        onTerrain={false}
        onChange={setCurrentPoint}
        startPoint={constrainPoint || firstPoint}
        moveMode={currentMoveMode}
        hideFloatingInputs={true}
        maxLength={currentLength}
        enableSnappingPicker={true}
        currentShapeSnappingLines={verticalSnappingLine}
        customSnappingPoints={firstPointAsSnappingPoint}
      />
      {firstPoint && <FloatingToolInputs fields={fields} focus={onFocus} cancel={exitCurrentTool} />}
      {lineSegment && (
        <>
          <PreviewRenderer lineSegment={lineSegment} />
          <DashedLineSegment lineSegment={verticalLineSegment} />
          <DashedLineSegment lineSegment={horizontalLineSegment} />
        </>
      )}
      {currentPoint && <Handle position={currentPoint} />}
      {firstPoint && <Handle position={firstPoint} />}
    </>
  )
}

export default PreciseMove
