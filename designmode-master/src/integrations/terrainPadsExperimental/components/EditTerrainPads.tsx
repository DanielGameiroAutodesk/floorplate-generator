import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "preact/compat"
import { terrainApi } from "src/integrations/terrainPadsExperimental/api/terrainPadApi"
import type { TerrainOperation } from "src/core/terrain/terrain-types"
import { Vector3 } from "three"
import { ShapeTool } from "src/integrations/tools-common/Drawing/shapeTool/ShapeTool"
import {
  CreateToolMode,
  type ShapeToolConfig,
  ShapeToolMoveMode,
} from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { isSelfIntersecting, loopFromEdges, ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { elementState } from "src/core/elements/ElementState"
import type { ToolCfg } from "src/core/toolsState"
import { toolAPI } from "src/core/toolsState"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { customSelectionTargetToSelectionPath } from "src/core/selection/selectionTypes"
import { HiddenPaths } from "src/core/hidden"
import { CUSTOM_INTEGRATION } from "src/integrations/terrainPadsExperimental/terrainElemenSystemInterface"
import { terrainEditVisualizationSignal } from "src/integrations/terrainPadsExperimental/visuals/TerrainEditVisuals"

type Edge = [number, number]
type Loop = number[]
type Shape = {
  vertices: Vector3[]
  edges: Edge[]
  loops: Loop[]
}

function isValidShape(shape: Shape) {
  if (shape.vertices.length < 3) return false
  return !isSelfIntersecting(ShapeUtils.connectedVerticesOfShape(shape))
}

export const createEditTerrainPadsToolConfig = (terrainpadId: string): ToolCfg => ({
  id: "editTerrainPads",
  tool: () => <EditTerrainPads terrainPadId={terrainpadId} />,
  propertyPanel: "default",
  toolbar: () => <ToolbarCloseButton />,
})

export const EditTerrainPads = ({ terrainPadId }: { terrainPadId: string }) => {
  const currentTerrain = elementState.currentTerrainSignal.peek()
  if (!currentTerrain) {
    throw new Error("No terrain element in proposal")
  }
  const [shape, setShape] = useState<Shape | undefined>()

  useEffect(() => {
    const customPath = customSelectionTargetToSelectionPath({
      integration: CUSTOM_INTEGRATION,
      id: terrainPadId,
    })
    HiddenPaths.setPathHidden(customPath, true)
    return () => {
      HiddenPaths.setPathHidden(customPath, false)
    }
  }, [terrainPadId])

  const terrainPadToEdit = useMemo(
    () => terrainApi.getTerrainOperation(currentTerrain.element, terrainPadId),
    [currentTerrain.element, terrainPadId],
  )

  const initialShape: Shape = useMemo(() => {
    const flatVertices =
      terrainPadToEdit?.coordinates.map((c) => new Vector3(c.x, c.y, terrainPadToEdit.elevation)) ?? []

    const edges = flatVertices.map((_, i) => [i, (i + 1) % flatVertices.length] as [number, number])
    return {
      vertices: flatVertices,
      edges,
      loops: [loopFromEdges(edges)],
    }
  }, [terrainPadToEdit])

  const getTerrainOperationFromShape = useCallback(
    (shape: Shape): TerrainOperation | undefined => {
      if (!terrainPadToEdit || !isValidShape(shape)) return
      const vertices = ShapeUtils.connectedVerticesOfShape(shape)
      const coordinates = vertices.map((v) => ({ x: v.x, y: v.y }))
      if (coordinates.length < 2) return
      return { ...terrainPadToEdit, coordinates }
    },
    [terrainPadToEdit],
  )

  const [previewOp, setPreviewOp] = useState<TerrainOperation | undefined>(terrainPadToEdit)

  const onPreview = useCallback(
    (shape: Shape) => {
      const operation = getTerrainOperationFromShape(shape)
      if (!operation) return
      setPreviewOp(operation)
    },
    [setPreviewOp, getTerrainOperationFromShape],
  )

  const onUpdate = useCallback((shape: Shape) => {
    setShape(shape)
  }, [])

  const onComplete = useCallback(
    (shape: Shape) => {
      const currentTerrain = elementState.currentTerrainSignal.peek()
      if (!currentTerrain) return

      // TODO: move getTerrainOperationFromShape to terrainApi
      const updatedOperation = getTerrainOperationFromShape(shape)
      if (!updatedOperation) return

      // TODO: add terrainApi.updateTerrainPad function
      const currentTerrainOps = currentTerrain.element.properties.terrain_mode_operations ?? []
      const newOps = currentTerrainOps.map((operation) =>
        operation.id === terrainPadId ? updatedOperation : operation,
      )
      terrainApi.applyTerrainOperationsToElementState(newOps)
      toolAPI.resetTool()
    },
    [terrainPadId, getTerrainOperationFromShape],
  )
  const onCancel = useCallback(() => {
    if (shape !== undefined) {
      onComplete(shape)
    }
    toolAPI.resetTool()
  }, [shape, onComplete])

  useLayoutEffect(() => {
    terrainEditVisualizationSignal.value = { previewOp }
    return () => (terrainEditVisualizationSignal.value = {})
  }, [previewOp])

  const shapeToolConfig: ShapeToolConfig = {
    toolMode: CreateToolMode.Edit,
    moveModes: [ShapeToolMoveMode.HORIZONTAL],
    requireAlwaysValid: true,
    onTerrain: false,
    linkVerticesVertically: false,
    useContextualLines: false,
    snapToExternalShape: false,
  }
  return (
    <ShapeTool
      onComplete={onComplete}
      onPreviewChange={onPreview}
      onUpdate={onUpdate}
      onCancel={onCancel}
      config={shapeToolConfig}
      initialShape={initialShape}
      isValid={isValidShape}
    />
  )
}
