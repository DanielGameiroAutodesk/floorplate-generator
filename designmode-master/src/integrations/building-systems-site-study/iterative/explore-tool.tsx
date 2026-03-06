import { signal } from "@preact/signals"
import type { Child } from "forma-elements"

import { exitCurrentTool, toolAPI, type ToolCfg } from "src/core/toolsState"
import { elementState } from "src/core/elements/ElementState"
import type { ChildNodeContainer, RootContext } from "src/core/elements/ChildNodeContainer"
import type { EditFunctions } from "src/core/elements/snapshot-helpers/editSnapshot"
import {
  contextRootSignal,
  resetFadeAllExceptSignal,
  resetHighlightedFillSignal,
  resetSelectionSetSignal,
  scenarioModeSignal,
  setFadeAllExceptSignalValue,
  setHighlightVisibilitySignalValue,
  setSelectionVisibilitySignalValue,
} from "src/core/selection/selectionState"
import { newChildKey } from "src/lib/element/urn"
import { type InternalPath, mergePath } from "src/lib/element/path"

import type { IterativeExploreState } from "./explore-tool-state"
import { EditPropertyPanel } from "./PropertyPanel"
import { CreateToolbar, EditToolbar } from "./Toolbar"
import { CreateTool, EditTool } from "./Tool"
import { isSiteExploreAreaElement, type SiteExploreArea } from "./site-explore-area"

export function initIterativeExploreCreateToolCfg(): ToolCfg {
  resetSelectionSetSignal()
  resetHighlightedFillSignal()

  function exitTool() {
    exitCurrentTool()
  }

  function onCreate(area: SiteExploreArea) {
    const rootContext = scenarioModeSignal.peek() ? "base" : "proposal"
    const contextRootPath = contextRootSignal.peek()
    const child = { key: newChildKey(), urn: area.elementContainer.element.urn }
    elementState.edit(performAddElement(area, rootContext, child))
    const nodePath = mergePath(contextRootPath, child.key)
    exitTool()
    toolAPI.setTool(initIterativeExploreEditToolCfg(nodePath))
  }

  return {
    id: "iterative-explore/create",
    toolbar: () => <CreateToolbar onComplete={exitTool} />,
    tool: () => <CreateTool onCreate={onCreate} onCancel={exitTool} />,
    propertyPanel: "default",
  }
}

export function initIterativeExploreEditToolCfg(
  siteExploreAreaNodePath: InternalPath,
  initState: IterativeExploreState = {
    type: "graph-editor",
    exploreGraphEditorState: "idle",
    selectedCells: new Set(),
  },
): ToolCfg {
  const graphEditorSignal = signal<IterativeExploreState>(initState)

  setSelectionVisibilitySignalValue(false)
  setHighlightVisibilitySignalValue(false)
  setFadeAllExceptSignalValue([siteExploreAreaNodePath])

  const exitCleanupFuncs = [
    exitCurrentTool,
    () => setSelectionVisibilitySignalValue(true),
    () => setHighlightVisibilitySignalValue(true),
    resetFadeAllExceptSignal,
  ]

  function exitTool() {
    exitCleanupFuncs.forEach((f) => f())
  }

  function onChange(area: SiteExploreArea) {
    const node = elementState.currentSnapshot.peek().getNodeOrThrow(siteExploreAreaNodePath)
    elementState.edit(performUpdateElement(area, node))
  }

  function onPreviewChange(area: SiteExploreArea) {
    const node = elementState.currentSnapshot.peek().getNodeOrThrow(siteExploreAreaNodePath)
    elementState.preview(performUpdateElement(area, node))
  }

  // For releasing the site explore element
  const onRelease = () => {
    const currentSnapshot = elementState.currentSnapshot.peek()
    const siteExploreAreaNode = currentSnapshot.getNodeOrThrow(siteExploreAreaNodePath)
    elementState.edit(performReleaseElement(siteExploreAreaNode))
    exitTool()
  }

  return {
    id: "iterative-explore/edit",
    toolbar: () => <EditToolbar onComplete={exitTool} graphEditorSignal={graphEditorSignal} />,
    tool: () => (
      <EditTool
        path={siteExploreAreaNodePath}
        graphEditorSignal={graphEditorSignal}
        onChange={onChange}
        onPreviewChange={onPreviewChange}
        onComplete={exitTool}
      />
    ),
    propertyPanel: () => (
      <EditPropertyPanel
        path={siteExploreAreaNodePath}
        onChange={onChange}
        onRelease={onRelease}
        graphEditorSignal={graphEditorSignal}
        initGridTool={() => (graphEditorSignal.value = { type: "set-grid-position" })}
      />
    ),
  }
}

export const performUpdateElement =
  (site: SiteExploreArea, siteExploreAreaNode: ChildNodeContainer) =>
  ({ updateElement }: EditFunctions) =>
    updateElement(
      siteExploreAreaNode.context,
      { ...siteExploreAreaNode.child, urn: site.elementContainer.element.urn },
      site.elementContainer,
    )

const performAddElement =
  (site: SiteExploreArea, context: RootContext, child: Child) =>
  ({ addElement }: EditFunctions) =>
    addElement(context, child, site.elementContainer)

export const performReleaseElement =
  (siteExploreAreaNode: ChildNodeContainer) =>
  ({ addElement, removeElement }: EditFunctions) => {
    const currentSnapshot = elementState.currentSnapshot.peek()
    // Remove the site explore area element
    removeElement(siteExploreAreaNode.context, siteExploreAreaNode.child.key)

    function releaseChildren(children: ChildNodeContainer[]) {
      for (const node of children) {
        if (isSiteExploreAreaElement(node.element)) {
          // We don't want to site explore area elements,
          // but rather release its children (for now anyway)
          releaseChildren(currentSnapshot.getChildrenOfNode(node))
        } else {
          const transform = node.globalMatrix.toArray()
          const newChild: Child = { ...node.child, key: newChildKey(), transform }
          addElement(siteExploreAreaNode.context, newChild, node.elementContainer)
        }
      }
    }

    // Release (add) all children of the site explore area element to the parent (proposal)
    const children = currentSnapshot.getChildrenOfNode(siteExploreAreaNode)
    releaseChildren(children)
  }
