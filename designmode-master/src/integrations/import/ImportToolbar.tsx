import ToolbarButton from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { ImportIcon } from "./ImportIcon"
import { useCallback } from "preact/hooks"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

export function ImportToolbar() {
  const openImport = useCallback(() => {
    Analytics.track(
      EventName.Open,
      {
        feature: "Import",
        feature_category: FeatureCategory.Library,
      },
      { method: "toolbar" },
    )
    window.dispatchEvent(new CustomEvent("forma/marketplace/open", { detail: { tab: "import" } }))
  }, [])

  return (
    <ToolbarButton
      label={(t) => t(($) => $.importToolbar.title)}
      icon={<ImportIcon />}
      onClick={openImport}
      active={false}
    />
  )
}
