import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { Matrix4, Vector3 } from "three"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import { isAnythingSelectedSignal } from "src/core/selection/selectionState"
import sceneManager from "src/core/three/sceneManager"
import { HiddenPaths } from "src/core/hidden"
import { useMoveGroup } from "./utils"
import type { ShapeToolConfig } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import {
  CreateToolMode,
  ShapeToolMoveMode,
  ToolIntention,
} from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { useApplyAffine } from "./transformActions"
import { defaultCursor, rotateCursor } from "src/integrations/cursors/setCursor"
import type { ControlContextValue } from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import FloatingToolInputs from "src/integrations/inputs/floating/FloatingToolInputs/FloatingToolInputs"
import { degreesToRadians, radiansToDegrees } from "@turf/helpers"
import { isDefined } from "src/lib/array"
import { snappingLineFromEndpoints } from "src/integrations/snapping/snappingEngineHelpers"
import {
  createExtendedAndRightAngleSnappingLines,
  createOrthogonalId,
  createOrthogonalSnappingLine,
} from "src/integrations/snapping/utils/createSnapLines"
import { ShapeVisual } from "src/integrations/tools-common/Drawing/shapeTool/visuals/ShapeVisual"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import type { Shape } from "src/lib/three/Shape/types"
import { AT_LEAST_ONE_VERTEX } from "src/lib/three/Shape/shapeUtils"
import { DesignModeEvents } from "src/core/events/events"
import { exitCurrentTool } from "src/core/toolsState"

function getHorizontalDeterminant(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return (by - ay) * (cx - ax) - (bx - ax) * (cy - ay)
}

const identity = new Matrix4()

const v2v1 = new Vector3()
const v2v3 = new Vector3()

export const angleToMatrix = (angle: number, center: number[]) => {
  const rotationMatrix = new Matrix4().makeRotationZ(angle)
  const translationMatrix = new Matrix4().makeTranslation(center[0], center[1], 0)

  return new Matrix4().multiply(translationMatrix).multiply(rotationMatrix).multiply(translationMatrix.invert())
}

export function getRotationFromShape(shape: Shape): { angleRadians: number; matrix4: Matrix4 } {
  if (shape.vertices.length < 3) {
    return {
      angleRadians: 0,
      matrix4: identity,
    }
  }
  const [v1, v2, v3] = shape.vertices
  v2v1.subVectors(v1, v2).setZ(0)
  v2v3.subVectors(v3, v2).setZ(0)
  const angleRadians = v2v1.angleTo(v2v3)
  const sign = getHorizontalDeterminant(v1.x, v1.y, v2.x, v2.y, v3.x, v3.y) >= 0 ? 1 : -1

  return {
    matrix4: angleToMatrix(sign * angleRadians, [v2.x, v2.y]),
    angleRadians,
  }
}

const COMPLETE_STEP: ShapeToolConfig = {
  requireAlwaysValid: true,
  toolMode: CreateToolMode.DrawLineSegment,
  toolIntention: ToolIntention.Rotate,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  activeVertices: [0],
  onTerrain: false,
  linkVerticesVertically: false,
  useContextualLines: true,
  snapToExternalShape: true,
  hideFloatingInputs: true,
}
const DEFINE_REFERENCE_LINE: ShapeToolConfig = {
  requireAlwaysValid: true,
  toolIntention: ToolIntention.Rotate,
  toolMode: CreateToolMode.DrawLineSegment,
  moveModes: [ShapeToolMoveMode.HORIZONTAL],
  onTerrain: false,
  useContextualLines: true,
  linkVerticesVertically: false,
  snapToExternalShape: true,
  hideFloatingInputs: true,
}
let active = false
const PreciseRotate = () => {
  const isAnythingSelected = isAnythingSelectedSignal.value
  const [initialShape, setInitialShape] = useState<Shape | null>(null)

  const [toolAngleRadians, setToolAngleRadians] = useState<number | undefined>(0)
  const [inputAngleDegrees, setInputAngleDegrees] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!isAnythingSelected) exitCurrentTool()
  }, [isAnythingSelected])

  const applyAffineToSelected = useApplyAffine()

  const onCompleteInput = useCallback(() => {
    if (initialShape && isDefined(inputAngleDegrees) && !isNaN(inputAngleDegrees)) {
      const { x: centerX, y: centeryY } = initialShape.vertices[1]
      const matrix4 = angleToMatrix(degreesToRadians(inputAngleDegrees), [centerX, centeryY])
      void applyAffineToSelected(matrix4, false)
    }

    exitCurrentTool()
  }, [applyAffineToSelected, initialShape, inputAngleDegrees])

  const onCompleteTool = useCallback(
    (shape: Shape) => {
      const { matrix4: affineMatrix } = getRotationFromShape(shape)
      void applyAffineToSelected(affineMatrix, false)
      exitCurrentTool()
    },
    [applyAffineToSelected],
  )

  const onCompleteLine = useCallback((shape: Shape) => {
    const shapeWithExtraVertex: Shape = {
      ...shape,
      vertices: shape.vertices.reverse(),
      edges: [[1, 0]],
    }
    setInitialShape(shapeWithExtraVertex)
  }, [])

  const onCancel = useCallback(() => {
    exitCurrentTool()
  }, [])

  const { moveGroup3D, moveGroup2D } = useMoveGroup()

  useEffect(() => {
    active = true
    return () => {
      active = false
      return HiddenPaths.setSelectedContextRootDirectChildrenHidden(false)
    }
  }, [])

  useEffect(() => {
    rotateCursor()
    return () => defaultCursor()
  }, [])

  const extendedAndOrthogonalSnapLines = useMemo(() => {
    if (!initialShape) return []
    const { edges, vertices } = initialShape

    const lines = edges.map(([start, end]) =>
      snappingLineFromEndpoints(vertices[start], vertices[end], "LINE", false, undefined),
    )

    const orthogonalLines = lines.map((l) => createOrthogonalSnappingLine(l, l.start, undefined, createOrthogonalId(l)))
    const extended = createExtendedAndRightAngleSnappingLines(lines, undefined)

    return [...orthogonalLines, ...extended]
  }, [initialShape])

  const onPreviewChangeInput = useCallback(
    (inputAngleRadians: number) => {
      if (!initialShape || !active) return
      const { x: centerX, y: centeryY } = initialShape.vertices[1]
      const matrix4 = angleToMatrix(inputAngleRadians, [centerX, centeryY])
      HiddenPaths.setSelectedContextRootDirectChildrenHidden(matrix4 !== identity)
      moveGroup3D.matrix.copy(matrix4)
      moveGroup3D.matrixAutoUpdate = false
      moveGroup2D.matrix.copy(matrix4)
      moveGroup2D.matrixAutoUpdate = false
      sceneManager.render(true, true)
      DesignModeEvents.dispatch("tool.affine.preview", matrix4.toArray())
    },
    [initialShape, moveGroup2D, moveGroup3D],
  )

  const onPreviewChangeTool = useCallback(
    (shape: Shape) => {
      // avoids triggering a change when ShapeTool is initialized with a new "draw" vertex
      const lastVertex = shape.vertices[shape.vertices.length - 1]
      if (lastVertex.x === 0 && lastVertex.y === 0 && lastVertex.z === 0) return

      const { matrix4, angleRadians } = getRotationFromShape(shape)
      HiddenPaths.setSelectedContextRootDirectChildrenHidden(matrix4 !== identity)
      moveGroup3D.matrix.copy(matrix4)
      moveGroup3D.matrixAutoUpdate = false
      moveGroup2D.matrix.copy(matrix4)
      moveGroup2D.matrixAutoUpdate = false
      setToolAngleRadians(angleRadians)
      sceneManager.render(true, true)
      DesignModeEvents.dispatch("tool.affine.preview", matrix4.toArray())
    },
    [moveGroup2D, moveGroup3D],
  )

  const derivedAngleDegrees = useMemo(() => {
    if (inputAngleDegrees) return inputAngleDegrees
    if (toolAngleRadians) return radiansToDegrees(toolAngleRadians)
    return 0
  }, [inputAngleDegrees, toolAngleRadians])

  const fields = useMemo<ControlContextValue[]>(
    () => [
      {
        type: "angle",
        value: derivedAngleDegrees,
        change: (angleDegrees) => {
          setInputAngleDegrees(angleDegrees)
          if (isDefined(angleDegrees) && !isNaN(angleDegrees)) {
            onPreviewChangeInput(degreesToRadians(angleDegrees))
          }
        },
        submit: onCompleteInput,
      },
    ],
    [derivedAngleDegrees, onCompleteInput, onPreviewChangeInput],
  )

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (inputAngleDegrees && (e.key === "Tab" || e.key === "Escape" || e.key === "Enter")) {
        onCompleteInput()
        return Propagate.NO
      }

      return Propagate.YES
    },
    [inputAngleDegrees, onCompleteInput],
  )

  const mousedown = useCallback(() => {
    if (inputAngleDegrees) {
      onCompleteInput()
      return Propagate.NO
    }
    return Propagate.YES
  }, [inputAngleDegrees, onCompleteInput])

  useEventHandler("keydown", keydown, Priority.SUBTOOL_LVL2)
  useEventHandler("mousedown", mousedown, Priority.SUBTOOL_LVL2)

  if (!initialShape) {
    return (
      <ShapeTool
        key="preciseRotate:initialLine"
        onComplete={onCompleteLine}
        isValid={AT_LEAST_ONE_VERTEX}
        onCancel={onCancel}
        config={DEFINE_REFERENCE_LINE}
      />
    )
  }

  return (
    <>
      <FloatingToolInputs fields={fields} cancel={exitCurrentTool} />
      {isDefined(inputAngleDegrees) ? (
        <ShapeVisual shape={initialShape} useImperialUnits={false} />
      ) : (
        <ShapeTool
          key="preciseRotate:complete"
          onComplete={onCompleteTool}
          isValid={(s) => s.vertices.length >= 2}
          onCancel={onCancel}
          initialShape={initialShape}
          config={COMPLETE_STEP}
          onPreviewChange={onPreviewChangeTool}
          additionalSnappingLines={extendedAndOrthogonalSnapLines}
          initializeWithAdditionalSnappingLines={true}
        />
      )}
    </>
  )
}

export default PreciseRotate
