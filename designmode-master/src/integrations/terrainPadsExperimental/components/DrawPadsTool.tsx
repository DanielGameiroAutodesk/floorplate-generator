import { Propagate } from "@spacemakerai/web-sketch-renderer"
import { useCallback, useLayoutEffect, useMemo, useState } from "preact/hooks"
import { elementState } from "src/core/elements/ElementState"
import { Priority, useEventHandler } from "src/lib/eventManager"
import { Vector3 } from "three"
import type { Shape } from "src/lib/three/Shape/types"
import { raycastApi } from "src/integrations/raycast/RaycastAPI"
import styles from "./ElevationAtCursor.module.pcss"
import FormatLength from "src/lib/components/FormatLength"
import { useTranslator } from "src/i18n"
import { isSelfIntersecting, ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import {
  CreateToolMode,
  type ShapeToolConfig,
  ShapeToolMoveMode,
} from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import type { FlatPolygonV1, TerrainOperation } from "src/core/terrain/terrain-types"
import { DEFAULT_BUFFER_RATIO } from "src/integrations/terrainPadsExperimental/utils/bufferOperations"
import { newId } from "src/lib/element/urn"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import { exitCurrentTool } from "src/core/toolsState"
import { terrainEditVisualizationSignal } from "src/integrations/terrainPadsExperimental/visuals/TerrainEditVisuals"
import { setSelectionPathsSignalValue } from "src/core/selection/selectionState"
import { customSelectionTargetToSelectionPath } from "src/core/selection/selectionTypes"
import { defaultCursor } from "src/integrations/cursors/setCursor"

function createOperation(coordinates: Vector3[], padId: string): FlatPolygonV1 | undefined {
  if (coordinates.length < 2) return
  return {
    type: "flat-polygon/v1",
    id: padId,
    coordinates: coordinates.map((v) => ({ x: v.x, y: v.y })),
    applyGrade: true,
    buffer: DEFAULT_BUFFER_RATIO,
    elevation: coordinates[0].z,
  }
}

function isValidShape(shape: Shape) {
  if (shape.vertices.length < 3) return false
  return !isSelfIntersecting(ShapeUtils.connectedVerticesOfShape(shape))
}

function createTerrainOperationFromShape(shape: Shape | undefined, padId: string): FlatPolygonV1 | undefined {
  if (!shape || !isValidShape(shape)) return
  const vertices = ShapeUtils.connectedVerticesOfShape(shape)
  if (vertices.length < 2) return
  return createOperation(vertices, padId)
}

function selectPadInScene(operation: FlatPolygonV1) {
  setSelectionPathsSignalValue(
    new Set([
      customSelectionTargetToSelectionPath({
        integration: terrainApi.SELECTION_INTEGRATION_NAME,
        id: operation.id,
      }),
    ]),
  )
}

function getPosition() {
  const result = raycastApi.raycastTerrain()
  return result ? new Vector3(result.position.x, result.position.y, result.position.z) : null
}

function ElevationAtCursor() {
  const t = useTranslator()
  const [htmlPosition, setHtmlPosition] = useState<{ x: number; y: number } | undefined>(undefined)
  const [elevation, setElevation] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    terrainEditVisualizationSignal.value = {
      highlightZ: elevation,
    }
    return () => {
      terrainEditVisualizationSignal.value = {}
    }
  }, [elevation])

  const mousemove = useCallback((e: MouseEvent) => {
    setHtmlPosition({ x: e.clientX, y: e.clientY })
    setElevation(getPosition()?.z)
    return Propagate.NO
  }, [])

  useEventHandler("mousemove", mousemove, Priority.SUBTOOL)

  if (!htmlPosition) return null
  if (elevation === undefined) return null

  return (
    <div
      style={{ transform: `translateX(calc(${htmlPosition.x}px + 15px)) translateY(calc(${htmlPosition.y}px))` }}
      className={styles.ElevationAtCursorWrapper}
    >
      <FormatLength metricLength={elevation} /> {t(($) => $.units.asl)}
    </div>
  )
}

export const DrawPadsTool = () => {
  const randomPadId = useMemo(() => newId(), [])
  const [showElevationAtCursor, setShowElevationAtCursor] = useState<boolean>(false)
  const [reset, setReset] = useState<boolean>(false)

  useLayoutEffect(() => {
    if (reset) setReset(false)
  }, [reset])

  const onPreviewOrUpdate = useCallback(
    (shape: Shape) => {
      if (shape.vertices.length < 2) {
        setShowElevationAtCursor(true)
        return
      }
      setShowElevationAtCursor(false)
      if (!isValidShape(shape)) return
      const previewOp = createTerrainOperationFromShape(shape, randomPadId)
      terrainEditVisualizationSignal.value = { previewOp }
    },
    [randomPadId],
  )

  const onCompleteDraw = useCallback(
    (shape: Shape) => {
      const currentTerrain = elementState.currentTerrainSignal.peek()
      if (!currentTerrain) return

      const newOperation = createTerrainOperationFromShape(shape, randomPadId)
      if (!newOperation) return

      // TODO: add terrainApi.updateTerrainPad function
      const currentTerrainOps = currentTerrain.element.properties.terrain_mode_operations ?? []
      const newOps: TerrainOperation[] = [newOperation, ...currentTerrainOps]
      terrainApi.applyTerrainOperationsToElementState(newOps)
      selectPadInScene(newOperation)
      exitCurrentTool()
    },
    [randomPadId],
  )

  const onCancel = useCallback(() => {
    if (!showElevationAtCursor) {
      setReset(true)
    } else {
      defaultCursor()
      exitCurrentTool()
    }
  }, [showElevationAtCursor])

  const shapeToolConfig: ShapeToolConfig = {
    toolMode: CreateToolMode.DrawClosedPolygon,
    moveModes: [ShapeToolMoveMode.HORIZONTAL],
    requireAlwaysValid: true,
    onTerrain: false,
    linkVerticesVertically: false,
    useContextualLines: true,
    snapToExternalShape: true,
  }

  return (
    <>
      {showElevationAtCursor && <ElevationAtCursor />}
      {!reset && (
        <ShapeTool
          onComplete={onCompleteDraw}
          onPreviewChange={onPreviewOrUpdate}
          onCancel={onCancel}
          config={shapeToolConfig}
          isValid={isValidShape}
          onUpdate={onPreviewOrUpdate}
        />
      )}
    </>
  )
}
