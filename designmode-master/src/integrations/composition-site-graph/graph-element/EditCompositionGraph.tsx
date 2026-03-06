import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool } from "src/core/toolsState"
import type { InternalPath } from "src/lib/element/path"
import { mergePath } from "src/lib/element/path"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import Composition from "./composition"
import type { Graph } from "src/integrations/composition-site-graph/graph/types"
import { EditGraphTool } from "src/integrations/composition-site-graph/tools/EditGraphTool"
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks"
import { GraphMesh } from "src/integrations/composition-site-graph/tools/GraphMesh"
import { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"

import CurrentTemplate from "src/integrations/composition-site-graph-parcel/templates/CurrentTemplate"
import type { CompositionElement } from "./types"
import { isCompositionElement } from "./types"
import SelectRowhouses from "./CompositionSelection"
import { useDimTerrain } from "src/integrations/tools-common/PlaceMode/placeModeVisualHook"
import { EditCompositionWrapper } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/sideBar/CompositionPanel"
import type { Matrix4 } from "three"
import { getElevationInLocalCoordinateSystem } from "src/integrations/composition-site-graph/tools/getGlobalTerrainPosition"
import { AnalyticsLegacy } from "src/core/analytics"
import { CompositionEventNames } from "src/integrations/composition/CompositionMixpanelEventNames"
import {
  resetKeyFiguresSelectionOverride,
  setKeyFiguresSelectionOverride,
} from "src/integrations/analyses/AreaMetrics/KeyFigures"
import type { SnappedSegment } from "src/integrations/composition-site-graph/tools/snapping"
import { elementState } from "src/core/elements/ElementState"
import { useComputed } from "@preact/signals"
import type { Urn } from "forma-elements"
import {
  resetFadeAllExceptSignal,
  resetSelectionSetSignal,
  selectionSetSignal,
  setFadeAllExceptSignalValue,
  setHighlightVisibilitySignalValue,
  setSelectionVisibilitySignalValue,
} from "src/core/selection/selectionState"
import { useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useReadonlySignal } from "src/lib/signal"
import { snappingAPIStateful } from "src/integrations/snapping/SnappingAPI"
import { elementSelectionPathToInternalPath, isElementSelectionPath } from "src/core/selection/selectionTypes"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

function useFadeAllExcept(path: InternalPath) {
  useLayoutEffect(() => {
    setFadeAllExceptSignalValue([path])
    return () => {
      resetFadeAllExceptSignal()
    }
  }, [path])
}

export function editComposedElement(path: InternalPath): ToolCfg {
  //TODO: Move to handler, do not track inside config creation function
  AnalyticsLegacy.track(CompositionEventNames.EditComposition_Start)
  return {
    id: "edit-composition",
    tool: () => <EditGraphWrapper path={path} />,
    toolbar: () => <ToolbarCloseButton />,
    propertyPanel: () => <EditCompositionWrapper path={path} />,
  }
}

function EditGraphWrapper({ path }: { path: InternalPath }) {
  const pathSignal = useReadonlySignal(path)
  const node = useComputed(() => {
    const node = elementState.currentSnapshot.value.getNode(pathSignal.value)
    if (!isCompositionElement(node?.element)) {
      console.error("Not a composing element")
      exitCurrentTool()
      return undefined
    }
    return node
  }).value

  if (!node) return null

  return <EditCompositionGraph path={path} />
}

export interface GraphCapabilitiesInterface<O> {
  addEdge: (state: Graph, vertexId0: string, vertexId1: string) => O
  replaceVertex: (state: Graph, vertexIdToReplace: string, vertexIdToReplaceWith: string) => O
  moveVertex: (state: Graph, vertexId: string, x: number, y: number) => O
  splitEdge: (position: SnappedSegment, state: Graph) => O
  removeVertex: (vertexId: string, state: Graph) => O
}

function EditCompositionGraph({ path }: { path: InternalPath }) {
  const proposal = elementState.currentProposalSignal.value
  const snapshot = proposal.snapshot
  const node = snapshot.getNodeOrThrow(path)
  const element = node.element
  if (!isCompositionElement(element)) {
    console.error(element)
    throw new Error("Unexpected element")
  }
  const terrain = terrainSignal.value
  const actionAPI = useActionAPI()
  const currentTemplate = CurrentTemplate.templateSignal.value
  const terrainSamplerData = terrainSignal.value.terrainSamplerData

  useDimTerrain()
  useFadeAllExcept(path)

  const exit = useCallback(() => {
    AnalyticsLegacy.track(CompositionEventNames.EditComposition_Exit)
    exitCurrentTool()
  }, [])

  useEffect(() => {
    const dispose = SelectRowhouses.selectionSignal.subscribe((selectionPaths) => {
      const globalSelection = new Set(
        [...selectionPaths]
          .filter(isElementSelectionPath)
          .map((selectionPath) => mergePath(path, elementSelectionPathToInternalPath(selectionPath))),
      )
      setKeyFiguresSelectionOverride(globalSelection)
    })
    return () => {
      dispose()
      resetKeyFiguresSelectionOverride()
    }
  }, [path])

  const escapeHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitEditGraph),
      keyCode: "Escape",
      editAccessRequired: true,
      callback: exit,
    }
  }, [exit])

  useHotkey(escapeHotkey)

  const enterHotkey = useMemo<HotkeyKeyRegistration>(() => {
    return {
      description: (t) => t(($) => $.hotkeys.exitEditGraph),
      keyCode: "Enter",
      editAccessRequired: true,
      callback: exit,
    }
  }, [exit])

  useHotkey(enterHotkey)

  useLayoutEffect(() => {
    SelectRowhouses.start(exit)
    return () => {
      SelectRowhouses.exit()
    }
  }, [exit])

  const selectedPaths = selectionSetSignal.value

  useEffect(() => {
    setSelectionVisibilitySignalValue(false)
    setHighlightVisibilitySignalValue(false)
    return () => {
      setSelectionVisibilitySignalValue(true)
      setHighlightVisibilitySignalValue(true)
    }
  }, [path, selectedPaths])

  useEffect(() => {
    if (!terrainSamplerData) return

    SelectRowhouses.update(element, path, proposal, terrainSamplerData)
  }, [element, proposal, path, terrainSamplerData])

  const graph = useMemo(
    () => element?.properties?.definingRepresentation?.graph as Graph | undefined,
    [element?.properties?.definingRepresentation?.graph],
  )

  const getElevationForLocalCoordinates = useCallback(
    (x: number, y: number) => {
      return getElevationInLocalCoordinateSystem({ x, y }, node.globalMatrix, terrain.elevationAt)
    },
    [terrain.elevationAt, node.globalMatrix],
  )

  const onPreview = useCallback(
    ({ graph, element }: { graph: Graph; element: CompositionElement }) => {
      if (!currentTemplate) {
        console.error("NO CURRENT TEMPLATE")
        return
      }

      const result = Composition.updateGraph(
        element,
        graph,
        currentTemplate,
        getElevationForLocalCoordinates,
        (urn: Urn) => snapshot.getFormaElementOrThrow(urn),
      )
      const actions = actionAPI.update.subTree(path, result.rootUrn, result.elements, new Set(), result.representations)

      actionAPI.preview_UNSTABLE(actions)
    },
    [actionAPI, currentTemplate, getElevationForLocalCoordinates, path, snapshot],
  )

  const onComplete = useCallback(
    ({ graph, element }: { graph: Graph; element: CompositionElement }) => {
      if (!currentTemplate) {
        console.error("NO CURRENT TEMPLATE")
        return
      }

      const result = Composition.updateGraph(
        element,
        graph,
        currentTemplate,
        getElevationForLocalCoordinates,
        (urn: Urn) => snapshot.getFormaElementOrThrow(urn),
      )

      resetSelectionSetSignal()
      snappingAPIStateful.clearSnapInfo()
      const actions = actionAPI.update.subTree(path, result.rootUrn, result.elements, new Set(), result.representations)

      actionAPI.apply(CompositionEventNames.EditComposition_EditGraph, actions)
      SelectRowhouses.setActive(true)
    },
    [actionAPI, currentTemplate, getElevationForLocalCoordinates, path, snapshot],
  )

  if (!graph) {
    window.forma_toasts.push({
      content: `Element did not have graph`,
      status: "warning",
    })
    exitCurrentTool()
    return null
  }
  const graphCapabilities: GraphCapabilitiesInterface<{ graph: Graph; element: CompositionElement }> = {
    addEdge: (state: Graph, vertexId0: string, vertexId1: string) => {
      return Composition.addEdge(element, state, vertexId0, vertexId1)
    },
    splitEdge: (position: SnappedSegment, state: Graph) => {
      return Composition.splitEdge(element, position, state)
    },
    removeVertex: (vertexId: string, state: Graph) => {
      return Composition.removeVertex(element, state, vertexId)
    },
    replaceVertex: (state: Graph, vertexIdToReplace: string, vertexIdToReplaceWith: string) => {
      return Composition.replaceVertex(element, state, vertexIdToReplace, vertexIdToReplaceWith)
    },
    moveVertex: (state: Graph, vertexId: string, x: number, y: number) => {
      return Composition.moveVertex(element, state, vertexId, x, y)
    },
  }

  return (
    <EditGraphToolWrapper
      graph={graph}
      graphCapabilities={graphCapabilities}
      transform={node.globalMatrix}
      onPreview={onPreview}
      resetPreview={actionAPI.resetPreview_UNSTABLE}
      onComplete={onComplete}
      getZ={terrain.elevationAt}
    />
  )
}

function EditGraphToolWrapper<O extends { graph: Graph }>({
  graph,
  graphCapabilities,
  onPreview,
  resetPreview,
  onComplete,
  transform,
  getZ,
}: {
  graph: Graph
  graphCapabilities: GraphCapabilitiesInterface<O>
  onPreview: (graph: O) => void
  resetPreview: () => void
  onComplete: (graph: O) => void
  transform: Matrix4
  getZ: (x: number, y: number) => number
}) {
  const renderAPI = useRenderAPI("EditGraphInner")

  const [graphMesh, setGraphMesh] = useState(new GraphMesh(graph, getZ, transform))
  useEffect(() => {
    //if graph is updated, set new graph mesh
    setGraphMesh((graphMesh) => {
      const hover = graphMesh.hover
      const selection = graphMesh.selection
      const newGraphMesh = new GraphMesh(graph, getZ, transform)
      newGraphMesh.update(graph, selection, hover)
      return newGraphMesh
    })
  }, [getZ, graph, transform])
  renderAPI.useObjectLifecycle_TEMPORARY_FIX(graphMesh)

  return (
    <EditGraphTool
      state={graph}
      graphCapabilities={graphCapabilities}
      onComplete={onComplete}
      onPreview={onPreview}
      resetPreview={resetPreview}
      transform={transform}
      onPreviewGraphVisuals={(graph, selection, hover) => graphMesh.update(graph, selection, hover)}
    />
  )
}
