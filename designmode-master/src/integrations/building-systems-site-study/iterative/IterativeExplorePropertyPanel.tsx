import { useCallback } from "preact/compat"
import { useSignal } from "@preact/signals"
import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import { getTranslator } from "src/i18n/index"
import { selectedNodesSignal, selectionSetSignal } from "src/core/selection/selectionState"
import { elementState } from "src/core/elements/ElementState"
import { canEditProposalSignal } from "src/core/edit-access-state"
import { toolAPI } from "src/core/toolsState"
import { Analytics } from "src/core/analytics"

import { initIterativeExploreEditToolCfg, performReleaseElement, performUpdateElement } from "./explore-tool"
import { isSiteExploreAreaElement } from "./site-explore-area"
import { EditPropertyPanel } from "./PropertyPanel"
import { ITERATIVE_EXPLORE_FEATURE_NAME } from "./constants"
import type { IterativeExploreState } from "./explore-tool-state"

export function IterativeExplorePropertyPanel() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("IterativeExplorePropertyPanel error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })

  const node = selectedNodesSignal.value[0]
  const path = Array.from(selectionSetSignal.value.values())[0]

  const graphEditorSignal = useSignal<IterativeExploreState>({ type: "property-panel" })

  const initGridTool = useCallback(() => {
    Analytics.track(EventName.Select, {
      feature_category: FeatureCategory.DesignTool,
      feature: ITERATIVE_EXPLORE_FEATURE_NAME,
      sub_feature: "grid_position",
    })
    toolAPI.setTool(initIterativeExploreEditToolCfg(path, { type: "set-grid-position" }))
  }, [path])

  if (error) return null
  if (!node) return null
  if (!path) return null
  if (!isSiteExploreAreaElement(node.element)) return null

  if (!canEditProposalSignal.value) {
    return <EditPropertyPanel path={path} graphEditorSignal={graphEditorSignal} initGridTool={initGridTool} />
  }

  return (
    <EditPropertyPanel
      path={path}
      onRelease={() => {
        elementState.edit(performReleaseElement(node))
      }}
      onChange={(area) => {
        elementState.edit(performUpdateElement(area, node))
      }}
      graphEditorSignal={graphEditorSignal}
      initGridTool={initGridTool}
    />
  )
}
