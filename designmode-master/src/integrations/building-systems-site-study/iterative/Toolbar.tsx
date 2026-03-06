import { useCallback, useErrorBoundary } from "preact/hooks"
import type { Signal } from "@preact/signals"
import { captureException } from "@sentry/browser"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import { HotkeyCategory, useHotkey } from "src/core/hotkeys"
import MultipleOnLine_24 from "src/lib/components/icons/MultipleOnLine_24"
import FountainPenIconPlus16 from "src/lib/components/icons/FountainPenIconPlus16"
import { Analytics } from "src/core/analytics"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { getTranslator } from "src/i18n/index"

import SurfaceToolbar from "src/integrations/Toolbars/CoreToolbar/domain/common/SurfaceToolbar"
import { set2DCallback } from "src/integrations/tools-common/Drawing/basicShape/DrawPolygon"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"

import type { IterativeExploreState } from "./explore-tool-state"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "./constants"

type CreateToolbarProps = {
  onComplete: () => void
}

export function CreateToolbar({ onComplete }: CreateToolbarProps) {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("CreateToolbar error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  useHotkey({
    description: (t) => t(($) => $.hotkeys.exitTool),
    keyCode: "Escape",
    editAccessRequired: false,
    category: HotkeyCategory.Tools,
    callback: onComplete,
  })
  useHotkey({
    description: (t) => t(($) => $.hotkeys.exitTool),
    keyCode: "Enter",
    editAccessRequired: false,
    category: HotkeyCategory.Tools,
    callback: onComplete,
  })
  set2DCallback(onComplete, undefined, "pick") // Added to make clicking on "Exit drawing mode" work

  if (error) return null

  return <SurfaceToolbar category="surface" defaultMode="pick" />
}

type EditToolbarProps = {
  graphEditorSignal: Signal<IterativeExploreState>
  onComplete: () => void
}

export function EditToolbar({ onComplete, graphEditorSignal }: EditToolbarProps) {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("EditToolbar error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  const onExitKey = useCallback(() => {
    const state = graphEditorSignal.peek()
    switch (state.type) {
      case "property-panel":
        return
      case "set-grid-position":
        return (graphEditorSignal.value = {
          type: "graph-editor",
          exploreGraphEditorState: "idle",
          selectedCells: new Set(),
        })
      case "graph-editor": {
        if (state.exploreGraphEditorState !== "idle" || state.selectedCells.size > 0) {
          return (graphEditorSignal.value = {
            type: "graph-editor",
            exploreGraphEditorState: "idle",
            selectedCells: new Set(),
          })
        }
        onComplete()
      }
    }
  }, [graphEditorSignal, onComplete])

  const onDrawLine = useCallback(
    (method: "toolbar" | "hotkey") => {
      Analytics.track(
        EventName.Select,
        {
          feature_category: FeatureCategory.DesignTool,
          feature: ITERATIVE_EXPLORE_FEATURE_NAME,
          sub_feature: "draw_line",
        },
        { method },
      )
      graphEditorSignal.value = { type: "graph-editor", exploreGraphEditorState: "drawLine", selectedCells: new Set() }
    },
    [graphEditorSignal],
  )

  const onAddNode = useCallback(
    (method: "toolbar" | "hotkey") => {
      Analytics.track(
        EventName.Select,
        {
          feature_category: FeatureCategory.DesignTool,
          feature: ITERATIVE_EXPLORE_FEATURE_NAME,
          sub_feature: "add_node",
        },
        { method },
      )
      graphEditorSignal.value = { type: "graph-editor", exploreGraphEditorState: "addNode", selectedCells: new Set() }
    },
    [graphEditorSignal],
  )

  useHotkey({
    description: (t) => t(($) => $.hotkeys.exitTool),
    keyCode: "Escape",
    editAccessRequired: false,
    category: HotkeyCategory.Tools,
    callback: onExitKey,
  })
  useHotkey({
    description: (t) => t(($) => $.hotkeys.exitTool),
    keyCode: "Enter",
    editAccessRequired: false,
    category: HotkeyCategory.Tools,
    callback: onExitKey,
  })
  useHotkey({
    description: (t) => t(($) => $.hotkeys.drawLine),
    keyCode: "l",
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
    callback: () => onDrawLine("hotkey"),
  })
  useHotkey({
    description: (t) => t(($) => $.hotkeys.addNode),
    keyCode: "n",
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
    callback: () => onAddNode("hotkey"),
  })

  const state = graphEditorSignal.value

  if (error) return null

  switch (state.type) {
    case "property-panel":
      return null
    case "set-grid-position":
      return (
        <ToolbarCloseButton
          onClick={() =>
            (graphEditorSignal.value = {
              type: "graph-editor",
              exploreGraphEditorState: "idle",
              selectedCells: new Set(),
            })
          }
        />
      )
    case "graph-editor":
      return (
        <>
          <ToolbarButton
            icon={<MultipleOnLine_24 />}
            onClick={() => onDrawLine("toolbar")}
            label={(t) => t(($) => $.basicElements.generic.line.name)}
            active={state.exploreGraphEditorState === "drawLine"}
            shortCut="l"
          />
          <ToolbarButton
            icon={<FountainPenIconPlus16 />}
            onClick={() => onAddNode("toolbar")}
            label={(t) => t(($) => $.automation.explore.addNodeButton)}
            active={state.exploreGraphEditorState === "addNode"}
            shortCut="n"
          />
          <FormaToolbarDivider direction="vertical" />
          <ToolbarCloseButton onClick={onComplete} />
        </>
      )
  }
}
