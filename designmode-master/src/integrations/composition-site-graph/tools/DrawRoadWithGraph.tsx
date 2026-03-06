import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { useCallback, useMemo } from "react"
import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { RoadIconLarge } from "src/integrations/basic-elements/draw/Transportation/icons/RoadIcon"
import type { RowHouseGraph, Selection } from "src/integrations/composition-site-graph/state"
import { DrawEdges } from "./DrawEdges"
import { useState } from "preact/hooks"
import { GraphMesh } from "./GraphMesh"
import type { Graph } from "src/integrations/composition-site-graph/graph/types"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import graph from "src/integrations/composition-site-graph/graph/graph"
import Composition from "src/integrations/composition-site-graph/graph-element/composition"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { newChildKey } from "src/lib/element/urn"
import { mergePath, ROOT_KEY } from "src/lib/element/path"
import CurrentTemplate from "src/integrations/composition-site-graph-parcel/templates/CurrentTemplate"
import { Matrix4 } from "three"
import { HotkeyCategory, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useHotkey } from "src/core/hotkeys"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

export function addRoadPropertiesToEdges(g: RowHouseGraph) {
  const key = newChildKey()
  const edgesWithRoadProperties = Object.fromEntries(
    Object.entries(g.edges).map(([edgeId, edge]) => [
      edgeId,
      {
        ...edge,
        properties: {
          ...edge.properties,
          road: {
            type: "road",
            width: 6,
            path: mergePath(ROOT_KEY, key),
          },
        },
      },
    ]),
  )
  const underscoreEdgesWithRoadProperties = Object.fromEntries(
    Object.entries(g._edges).map(([edgeId, edge]) => [
      edgeId,
      {
        ...edge,
        properties: {
          ...edge.properties,
          road: {
            type: "road",
            width: 6,
            path: mergePath(ROOT_KEY, key),
          },
        },
      },
    ]),
  )
  const graphWithRoads = {
    ...g,
    edges: edgesWithRoadProperties,
    _edges: underscoreEdgesWithRoadProperties,
  }
  return graphWithRoads
}

function Wrapper() {
  const renderAPI = useRenderAPI("graph-tool")
  const terrain = terrainSignal.value
  const actionAPI = useActionAPI()
  const currentTemplate = CurrentTemplate.templateSignal.value

  const [state, setState] = useState<Graph>(graph.empty())
  const [graphMesh] = useState(new GraphMesh(state, terrain.elevationAt, new Matrix4()))

  renderAPI.useObjectLifecycle_TEMPORARY_FIX(graphMesh)

  const onCommit = useCallback(
    (graph: Graph) => {
      setState(graph)
      if (!currentTemplate) {
        console.error("NO CURRENT TEMPLATE")
        return
      }
      const graphWithRoads = addRoadPropertiesToEdges(graph)
      const result = Composition.create(graphWithRoads, currentTemplate, terrain.elevationAt)
      actionAPI.preview_UNSTABLE(
        actionAPI.add.subTree_UNSTABLE(result.rootUrn, result.elements, new Set(), result.representations),
      )
    },
    [actionAPI, currentTemplate, terrain.elevationAt],
  )

  const onPreview = useCallback(
    (graph: Graph) => {
      if (!currentTemplate) {
        console.error("NO CURRENT TEMPLATE")
        return
      }
      const graphWithRoads = addRoadPropertiesToEdges(graph)
      const result = Composition.create(graphWithRoads, currentTemplate, terrain.elevationAt)
      actionAPI.preview_UNSTABLE(
        actionAPI.add.subTree_UNSTABLE(result.rootUrn, result.elements, new Set(), result.representations),
      )
    },
    [actionAPI, currentTemplate, terrain.elevationAt],
  )

  const onCancel = useCallback(() => {
    if (!currentTemplate) {
      console.error("NO CURRENT TEMPLATE")
      return
    }
    const graphWithRoads = addRoadPropertiesToEdges(state)
    const result = Composition.create(graphWithRoads, currentTemplate, terrain.elevationAt)
    actionAPI.apply(
      "Add graph road",
      actionAPI.add.subTree_UNSTABLE(result.rootUrn, result.elements, new Set(), result.representations),
    )
    actionAPI.resetPreview_UNSTABLE()
    snappingAPIStateful.clearSnapInfo()
    exitCurrentTool()
  }, [actionAPI, currentTemplate, state, terrain.elevationAt])

  const keydown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel()
        return Propagate.NO
      }
      if (e.key === "Enter") {
        onCancel()
        return Propagate.NO
      }
      return Propagate.YES
    },
    [onCancel],
  )
  useEventHandler("keydown", keydown, Priority.TOOL)

  return (
    <DrawEdges
      state={state}
      onCommit={onCommit}
      onPreview={onPreview}
      onPreviewGraphVisuals={(graph: Graph, selection: Selection[] = [], hover: Selection[] = []) =>
        graphMesh.update(graph, selection, hover)
      }
    />
  )
}

export const HOTKEY_ROADS = "T"
export const useDrawRoadsWithGraph = () => {
  const actionsAPI = useActionAPI()

  const onCancel = useCallback(() => {
    exitCurrentTool()
    actionsAPI.resetPreview_UNSTABLE()
  }, [actionsAPI])

  const drawRoad = useCallback(() => {
    toolAPI.setTool({
      id: "draw-roads-with-graph",
      toolbar: () => <ToolbarCloseButton onClick={onCancel} />,
      tool: Wrapper,
      propertyPanel: "default",
    })
  }, [onCancel])

  const hotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.drawRoad),
      keyCode: HOTKEY_ROADS,
      callback: drawRoad,
      editAccessRequired: true,
      category: HotkeyCategory.Tools,
    }
  }, [drawRoad])

  useHotkey(hotkey)

  const roadToolbarButton: ToolConfig = useMemo(() => {
    return {
      label: (t) => t(($) => $.transportation.roads.withGraphToolButton),
      icon: RoadIconLarge,
      onClick: drawRoad,
      shortCut: HOTKEY_ROADS,
    }
  }, [drawRoad])

  return roadToolbarButton
}
