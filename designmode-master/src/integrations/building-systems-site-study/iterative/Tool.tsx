import { type Signal, useComputed, useSignalEffect } from "@preact/signals"
import { useCallback, useEffect, useErrorBoundary, useMemo } from "preact/hooks"
import { useSetRecoilState } from "recoil"
import { captureException } from "@sentry/browser"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import { isClockwise } from "src/lib/geometry/geometryUtils"
import { shapeToBlock } from "src/lib/three/Shape/shapeUtils"
import { type InternalPath } from "src/lib/element/path"
import { elementState } from "src/core/elements/ElementState"
import { useReadonlySignal } from "src/lib/signal"
import { useThrottle } from "src/lib/debounce"
import { Priority, Propagate, useEventHandler } from "src/lib/eventManager"
import sceneManager from "src/core/three/sceneManager"
import { HotkeyCategory, useHotkey } from "src/core/hotkeys"
import { isDefined } from "src/lib/array"
import { Analytics } from "src/core/analytics"
import { setFadeAllExceptSignalValue } from "src/core/selection/selectionState"
import {
  type SelectionPath,
  selectionPathSetToInternalPathSet,
  internalPathSetToSelectionPathSet,
} from "src/core/selection/selectionTypes"
import { useIsImperial } from "src/lib/unitSettings"
import { getTranslator, type I18nStringProvider } from "src/i18n/index"

import DrawGroundPolygon from "src/integrations/tools-common/Drawing/basicShape/DrawGroundPolygon"
import { UndoRedoHotkeyBindings } from "src/integrations/tools-common/UndoRedoHotkeyBindings"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"

import { SetGridTool } from "./generators"
import type { IterativeExploreState } from "./explore-tool-state"
import { SelectCellTool } from "./select-cell"
import { ExploreGraphEditor, type SimpleGraph } from "./graph-edit"
import {
  isSiteExploreAreaChildrenGeneratorElement,
  isSiteExploreAreaGraphGeneratorElement,
  SiteExploreArea,
} from "./site-explore-area"
import { useAutomationFillPattern } from "./AutomationFillPattern"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "./constants"

type CreateToolProps = {
  onCancel: () => void
  onCreate: (area: SiteExploreArea) => void
}

export function CreateTool({ onCreate, onCancel }: CreateToolProps) {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("CreateTool error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    setGuideText((): I18nStringProvider => (t) => t(($) => $.guideText.selectAreaToExplore))
    return () => setGuideText(() => () => "")
  }, [setGuideText])
  const imperialFlag = useIsImperial()

  if (error) return null

  return (
    <DrawGroundPolygon
      onComplete={(shape, additionalProperties, metadata) => {
        if (shape) {
          Analytics.trackAddElement(
            EventName.Add,
            {
              feature_category: FeatureCategory.DesignTool,
              feature: ITERATIVE_EXPLORE_FEATURE_NAME,
              sub_feature: "create_tool",
              object_type: "element",
            },
            { ...additionalProperties, ...metadata, category: "site_area", shape_type: "polygon" },
          )
          const { groundPolygon } = shapeToBlock(shape)
          if (isClockwise(groundPolygon)) groundPolygon.reverse()
          onCreate(SiteExploreArea.of(groundPolygon, imperialFlag))
        } else {
          Analytics.track(
            EventName.Close,
            {
              feature_category: FeatureCategory.DesignTool,
              feature: ITERATIVE_EXPLORE_FEATURE_NAME,
              sub_feature: "create_tool",
            },
            { ...additionalProperties, ...metadata, category: "site_area", shape_type: "polygon" },
          )
          // Done with the tool, but no shape was created so consider it cancelled
          onCancel()
        }
      }}
      onUpdate={() => {}}
      onPreviewChange={() => {}}
      onTerrain={true}
      activePreset="surface"
      defaultMode="pick"
    />
  )
}

type EditToolProps = {
  path: InternalPath
  graphEditorSignal: Signal<IterativeExploreState>
  onChange: (area: SiteExploreArea) => void
  onPreviewChange: (area: SiteExploreArea) => void
  onComplete: () => void
}

export function EditTool(props: EditToolProps) {
  // The user might Ctrl-Z (undo) and cause the element to be removed from the proposal while the tool
  // is active. This wrapper ensures we exit the tool if the element suddenly goes out of existence

  const { path, onComplete } = props

  const currentSnapshot = elementState.currentSnapshot.value
  const element = useMemo(() => currentSnapshot.getNode(path), [currentSnapshot, path])

  useEffect(() => {
    if (!element) onComplete()
  }, [element, onComplete])

  return element ? <EditToolInner {...props} /> : null
}

function EditToolInner({ path, onChange, graphEditorSignal, onPreviewChange, onComplete }: EditToolProps) {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("EditTool error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  const setGuideText = useSetRecoilState(guideTextAtom)
  useEffect(() => {
    setGuideText((): I18nStringProvider => (t) => t(($) => $.guideText.editSiteLayout))
    return () => setGuideText(() => () => "")
  }, [setGuideText])
  const imperialFlag = useIsImperial()
  const imperialFlagSignal = useReadonlySignal(imperialFlag)

  const pathSignal = useReadonlySignal(path)
  const areaSignal = useComputed(() =>
    SiteExploreArea.of(
      elementState.currentSnapshot.value.getNodeOrThrow(pathSignal.value).elementContainer,
      imperialFlagSignal.value,
    ),
  )

  const polygonsSignal = useComputed(() => {
    if (!isSiteExploreAreaGraphGeneratorElement(areaSignal.value.element)) return []
    return areaSignal.value.element.properties.generator.parameters.polygons
  })
  useAutomationFillPattern(polygonsSignal.value)

  const onGraphPreviewChange = useThrottle((graph: SimpleGraph) => {
    onPreviewChange(areaSignal.value.withGraph(graph, imperialFlag))
  }, 100)

  const dblclick = useCallback(() => {
    const state = graphEditorSignal.peek()
    if (state.type !== "graph-editor") return Propagate.NO
    if (state.exploreGraphEditorState !== "idle") {
      // Don't exit tool when editing graph
      return Propagate.YES
    }
    if (state.selectedCells.size > 0) {
      // Don't exit tool when cells are selected
      return Propagate.YES
    }
    onComplete()
    return Propagate.NO
  }, [graphEditorSignal, onComplete])

  useEventHandler("dblclick", dblclick, Priority.TOOL, sceneManager.renderer.domElement)

  const onSelectedCellsChange = useCallback(
    (paths: Set<SelectionPath>) => {
      Analytics.track(
        EventName.Select,
        {
          feature_category: FeatureCategory.DesignTool,
          feature: ITERATIVE_EXPLORE_FEATURE_NAME,
          sub_feature: "select_cell",
        },
        {
          cell_count: paths.size,
        },
      )
      graphEditorSignal.value = {
        type: "graph-editor",
        exploreGraphEditorState: "idle",
        selectedCells: selectionPathSetToInternalPathSet(paths),
      }
    },
    [graphEditorSignal],
  )

  const onBackspaceKey = useCallback(() => {
    const state = graphEditorSignal.peek()
    if (state.type !== "graph-editor") return Propagate.YES
    const selectedCells = Array.from(state.selectedCells)
    if (selectedCells.length === 0) return
    const area = areaSignal.peek()
    const currentSnapshot = elementState.currentSnapshot.peek()
    Analytics.track(EventName.Edit, {
      feature_category: FeatureCategory.DesignTool,
      feature: ITERATIVE_EXPLORE_FEATURE_NAME,
      sub_feature: "delete_cell_content",
      object_type: "element",
    })
    onChange(
      area.withChildElementsGeneratorConfig(
        selectedCells
          .map((path) => {
            const childElement = currentSnapshot.getNode(path)?.element
            if (!childElement) return
            if (!isSiteExploreAreaChildrenGeneratorElement(childElement)) return
            return {
              childElement,
              generatorConfig: {
                generatorId: "site-explore-area-buildings-v1",
                parameters: {
                  ...childElement.properties.generator.parameters,
                  technique: "blank",
                },
              },
            } as const
          })
          .filter(isDefined),
        imperialFlag,
      ),
    )
  }, [graphEditorSignal, areaSignal, onChange, imperialFlag])

  useHotkey({
    description: (t) => t(($) => $.hotkeys.remove),
    keyCode: "Backspace",
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
    callback: onBackspaceKey,
  })

  useSignalEffect(() => {
    const state = graphEditorSignal.value
    if (state.type !== "graph-editor" || state.selectedCells.size === 0) return

    setFadeAllExceptSignalValue([...state.selectedCells])

    return () => {
      setFadeAllExceptSignalValue([pathSignal.value])
    }
  })

  const selectedCellsSignal = useComputed<Set<SelectionPath>>(() =>
    graphEditorSignal.value.type === "graph-editor"
      ? internalPathSetToSelectionPathSet(graphEditorSignal.value.selectedCells)
      : new Set(),
  )

  if (error) return null
  const siteExploreArea = areaSignal.value
  const element = siteExploreArea.element
  if (!isSiteExploreAreaGraphGeneratorElement(element)) return null

  const graphEditorState = graphEditorSignal.value

  switch (graphEditorState.type) {
    case "property-panel":
      return null
    case "set-grid-position": {
      if (!isSiteExploreAreaGraphGeneratorElement(element)) return null
      const generatorParameters = element.properties.generator.parameters
      if (generatorParameters.technique !== "grid2") return null
      return (
        <SetGridTool
          polygons={generatorParameters.polygons}
          parameters={generatorParameters.params}
          onExit={() => {
            graphEditorSignal.value = {
              type: "graph-editor",
              exploreGraphEditorState: "idle",
              selectedCells: new Set(),
            }
          }}
          onComplete={(parameters) => {
            onChange(
              siteExploreArea.withGeneratorConfig(
                { ...element.properties.generator, parameters: { ...generatorParameters, params: parameters } },
                imperialFlag,
              ),
            )
            graphEditorSignal.value = {
              type: "graph-editor",
              exploreGraphEditorState: "idle",
              selectedCells: new Set(),
            }
          }}
        />
      )
    }

    case "graph-editor":
      return (
        <>
          <ExploreGraphEditor
            graph={siteExploreArea.element.properties.definingRepresentation.graph}
            onGraphChange={(graph) => {
              Analytics.track(EventName.Edit, {
                feature_category: FeatureCategory.DesignTool,
                feature: ITERATIVE_EXPLORE_FEATURE_NAME,
                sub_feature: "edit_graph",
                object_type: "element",
              })
              onChange(siteExploreArea.withGraph(graph, imperialFlag))
            }}
            editorState={graphEditorState.exploreGraphEditorState}
            onEditorStateChange={(editorState) => {
              graphEditorSignal.value = {
                ...graphEditorState,
                exploreGraphEditorState: editorState,
                selectedCells: new Set(),
              }
            }}
            onGraphPreviewChange={onGraphPreviewChange}
          />
          {graphEditorState.exploreGraphEditorState === "idle" && (
            <SelectCellTool
              nodePath={path}
              selectedCellsSignal={selectedCellsSignal}
              onSelectedCellsChange={onSelectedCellsChange}
            />
          )}
          <UndoRedoHotkeyBindings />
        </>
      )
  }
}
