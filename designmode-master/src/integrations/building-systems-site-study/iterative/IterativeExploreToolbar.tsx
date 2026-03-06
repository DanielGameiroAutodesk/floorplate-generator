import { useErrorBoundary } from "preact/hooks"
import { captureException } from "@sentry/browser"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

import { toolAPI } from "src/core/toolsState"
import SiteAutomationIcon from "src/lib/components/icons/building/SiteAutomationIcon"
import { Analytics } from "src/core/analytics"
import { getTranslator } from "src/i18n/index"

import ToolbarButton from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import IterativeExploreTooltipIcon from "src/integrations/building-systems-site-study/toolbar/tooltips/IterativeExploreTooltipIcon"

import { ITERATIVE_EXPLORE_FEATURE_NAME } from "./constants"
import { initIterativeExploreCreateToolCfg } from "./explore-tool"

export function IterativeExploreToolbar() {
  const [error] = useErrorBoundary((error, errorInfo) => {
    console.error("IterativeExploreToolbar error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "site-design", feature: "iterative-explore" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.siteStudy.errorOccurred), status: "warning" })
  })
  if (error) return null

  return (
    <ToolbarButton
      icon={<SiteAutomationIcon />}
      label={(t) => t(($) => $.automation.explore.siteAutomation)}
      onClick={() => {
        toolAPI.setTool(initIterativeExploreCreateToolCfg())
        Analytics.track(
          EventName.Select,
          {
            feature_category: FeatureCategory.DesignTool,
            feature: ITERATIVE_EXPLORE_FEATURE_NAME,
            sub_feature: "create_tool",
          },
          { method: "toolbar" },
        )
      }}
      expandedTooltip={{
        title: (t) => t(($) => $.automation.explore.siteAutomation),
        bodyText: (t) => t(($) => $.automation.explore.iterativeExplanation),
        icon: IterativeExploreTooltipIcon(),
        helpUrl:
          "https://help.autodeskforma.com/en/articles/10456412-how-to-quickly-explore-the-potential-of-your-site",
        position: "bottom",
      }}
    />
  )
}
