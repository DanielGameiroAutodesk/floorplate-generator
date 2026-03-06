import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import type { LineSegmentRenderer } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import { Matrix4, Vector3 } from "three"
import { atom, useRecoilCallback, useRecoilState, useRecoilValue } from "recoil"
import { useCreateAffineActions } from "src/integrations/tools-common/AffineTooling/transformActions"
import type { FormaElement } from "@spacemakerai/element-types"
import { EditLineSegment } from "./EditLineSegment"
import { DistanceOfLineSegment } from "src/integrations/tools-common/Drawing/shapeTool/visuals/DistanceOfLineSegment"
import { makePreviewComponent } from "./ReferenceImagePreview"
import { createDiagonalLine, createTransformFromLineSegments } from "./utils"
import { makeReferenceImageLineVisual } from "./ReferenceImageLineVisual"
import { Handle } from "src/integrations/tools-common/VertexHandle/Handle"
import { AnalyticsLegacy } from "src/core/analytics"
import { ReferenceImageAnalytics } from "./referenceImageAnalytics"
import { useHideRenderable } from "src/integrations/basic-elements/tooling/useHideRenderable"
import type { InternalPath } from "src/lib/element/path"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool } from "src/core/toolsState"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { DrawReferencePointsIcon } from "./drawReferencePointsIcon"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { Coord3D, Segment, Segment2D } from "src/lib/geometry/geometryTypes"
import { segmentToSegment2D } from "src/lib/geometry/geometryTypes"
import { elementState } from "src/core/elements/ElementState"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { raycast } from "src/core/terrain/2d-raytracer"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

declare module "forma-elements" {
  interface Properties {
    scalingReferenceLineSegment?: Segment2D
  }
}

export const isReferenceImage = (element: FormaElement) => {
  return element?.properties?.category === "referenceImage"
}

export function makeEditReferenceImageToolCfg(path: InternalPath): ToolCfg {
  return {
    id: "editReferenceImage",
    tool: () => <EditReferenceImage path={path} />,
    toolbar: () => <EditReferenceImageToolbar />,
    propertyPanel: "default",
  }
}

const EditReferenceImage = ({ path }: { path: InternalPath }) => {
  const editedElement = elementState.currentSnapshot.value.getNode(path)?.element
  if (!editedElement) return null
  return <Transform2DTool editedElement={editedElement} path={path} />
}

const HandleVisual: LineSegmentRenderer = ({ lineSegment }) => {
  if (!lineSegment) return null
  return (
    <>
      <Handle position={new Vector3().fromArray(lineSegment[0])} />
      <Handle position={new Vector3().fromArray(lineSegment[1])} />
    </>
  )
}

const isMovingReferencePointsState = atom({
  key: "isMovingReferencePointsState",
  default: false,
})

const v1Resused = new Vector3()

function applyMatrixToLineSegment(segment: Segment | Segment2D, matrix: Matrix4): Segment {
  return segment.map(([x, y, z = 0]) => v1Resused.set(x, y, z).applyMatrix4(matrix).toArray()) as Segment
}

const Transform2DTool = ({ path, editedElement }: { editedElement: FormaElement; path: InternalPath }) => {
  const snapshot = elementState.currentSnapshot.value
  const terrain = terrainSignal.value.terrainSamplerData

  const [previousLineSegment, setPreviousLineSegment] = useState<Segment | undefined>()
  const [isMovingReferencePoints, setIsMovingReferencePoints] = useRecoilState(isMovingReferencePointsState)
  const [accumulatedTransform, setAccumulatedTransform] = useState<Matrix4>(new Matrix4())

  useHideRenderable(path, !!previousLineSegment)

  useEffect(() => {
    // Don't track this with new tracking schema
    AnalyticsLegacy.track(ReferenceImageAnalytics.StartEdit)
  }, [])

  const worldMatrix = useMemo(() => snapshot.getNodeOrThrow(path).globalMatrix, [path, snapshot])

  useEffect(() => {
    const geojson = snapshot.getNode(path)?.elementContainer.representations.footprint
    if (!geojson) return

    const loadedRefLine = editedElement.properties?.scalingReferenceLineSegment
    if (loadedRefLine) {
      const worldSpace = applyMatrixToLineSegment(loadedRefLine, worldMatrix)
      const worldSpaceSegment = worldSpace.map(([x, y]) => [x, y, raycast(x, y, terrain)] as Coord3D) as Segment

      setPreviousLineSegment(worldSpaceSegment)
    } else {
      const diagonalLine = createDiagonalLine(geojson, worldMatrix, terrain)
      setPreviousLineSegment(diagonalLine)
    }
  }, [worldMatrix, terrain, path, editedElement, snapshot])

  const LineVisual = useMemo(() => makeReferenceImageLineVisual(isMovingReferencePoints), [isMovingReferencePoints])

  const onUpdate = useCallback(
    (lineSegment: Segment) => {
      if (previousLineSegment) {
        setAccumulatedTransform((cur) =>
          createTransformFromLineSegments(lineSegment, previousLineSegment).multiply(cur),
        )
      }
      setPreviousLineSegment(lineSegment)
    },
    [previousLineSegment],
  )

  const createAffineActions = useCreateAffineActions()
  const { apply } = useActionAPI()
  const onComplete = useCallback(
    (lineSegment: Segment | undefined) => {
      if (!previousLineSegment) return
      const toUse = lineSegment || previousLineSegment
      const matrix = createTransformFromLineSegments(toUse, previousLineSegment).multiply(accumulatedTransform)

      const saved = segmentToSegment2D(
        applyMatrixToLineSegment(toUse, worldMatrix.clone().invert().multiply(matrix.clone().invert())),
      )

      const savedLineProperty = {
        scalingReferenceLineSegment: saved,
      }

      const affineActions = createAffineActions(matrix, new Set([path]), savedLineProperty)

      apply("Scale Reference Image", affineActions)

      exitCurrentTool()
    },
    [previousLineSegment, accumulatedTransform, createAffineActions, path, apply, worldMatrix],
  )

  const cancel = useCallback(() => {
    if (isMovingReferencePoints) {
      setIsMovingReferencePoints(false)
    } else {
      previousLineSegment && onComplete(undefined)
      exitCurrentTool()
    }
  }, [setIsMovingReferencePoints, isMovingReferencePoints, onComplete, previousLineSegment])

  const cancelHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.ui.cancel),
      keyCode: "Escape",
      editAccessRequired: false,
      callback: cancel,
    }
  }, [cancel])
  useHotkey(cancelHotkey)

  const PreviewReferenceImage: LineSegmentRenderer = useMemo(
    () => makePreviewComponent(previousLineSegment, isMovingReferencePoints, accumulatedTransform),
    [previousLineSegment, isMovingReferencePoints, accumulatedTransform],
  )

  if (!previousLineSegment) return null

  return (
    <>
      {isMovingReferencePoints ? (
        <LineSegmentTool
          previewRenderers={[LineVisual, HandleVisual, PreviewReferenceImage, DistanceOfLineSegment]}
          onComplete={(l) => {
            setPreviousLineSegment(l)
            setIsMovingReferencePoints(false)
          }}
          hideFloatingInputs={true}
          moveMode={ShapeToolMoveMode.TERRAIN}
          onCancel={cancel}
        />
      ) : (
        <EditLineSegment
          lineSegment={previousLineSegment}
          previewRenderers={[LineVisual, PreviewReferenceImage, DistanceOfLineSegment]}
          onComplete={onComplete}
          onCancel={cancel}
          onUpdate={onUpdate}
        />
      )}
    </>
  )
}

const EditReferenceImageToolbar = () => {
  const active = useRecoilValue(isMovingReferencePointsState)
  const redefine = useRecoilCallback(
    ({ set }) =>
      () => {
        // Don't track this with new tracking schema
        AnalyticsLegacy.track(ReferenceImageAnalytics.StartSetReferencePoints)
        set(isMovingReferencePointsState, true)
      },
    [],
  )

  const shortCut = "R"
  const hotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.tools.transform.redefineReferencePointsButton),
      editAccessRequired: true,
      callback: redefine,
      keyCode: shortCut,
    }
  }, [redefine])
  useHotkey(hotkey)
  return (
    <>
      <ToolbarButton
        icon={<DrawReferencePointsIcon />}
        label={(t) => t(($) => $.tools.transform.redefineReferencePointsButton)}
        onClick={redefine}
        active={active}
        shortCut={shortCut}
      />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton />
    </>
  )
}
