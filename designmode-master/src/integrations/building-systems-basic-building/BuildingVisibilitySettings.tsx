import { useCallback } from "react"
import { useVisualizationAPI } from "src/integrations/renderables/VisualizationAPI"
import type { VisualizationSettings } from "src/lib/visualizationSettings"
import { Analytics } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"
import { useTranslator } from "src/i18n"

const functionIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2H15V8H8V2Z" fill="#CBE29D" />
    <path d="M1 2H8V8H1V2Z" fill="#FFEAA5" />
    <path d="M1 8H8V14H1V8Z" fill="#D8DCFF" />
    <path d="M8 8H15V14H8V8Z" fill="#FE9F90" />
    <rect x="0.5" y="1.5" width="15" height="13" rx="0.5" stroke="#808080" />
  </svg>
)

const typesIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2H15V8H8V2Z" fill="#C5C5C5" />
    <path d="M1 2H8V8H1V2Z" fill="#DDDDDD" />
    <path d="M1 8H8V14H1V8Z" fill="#FFFFFF" />
    <path d="M8 8H15V14H8V8Z" fill="#F3F3F3" />
    <rect x="0.5" y="1.5" width="15" height="13" rx="0.5" stroke="#808080" />
  </svg>
)

const areasIcon = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2H15V8H8V2Z" fill="#FFECE3" />
    <path d="M1 2H8V8H1V2Z" fill="#A4A8C7" />
    <path d="M1 8H8V14H1V8Z" fill="#B9C9CB" />
    <path d="M8 8H15V14H8V8Z" fill="#D4D8CB" />
    <rect x="0.5" y="1.5" width="15" height="13" rx="0.5" stroke="#808080" />
  </svg>
)

let prevMode: "functions" | "areas" | "types" = "functions"

export function BuildingVisibilitySettings() {
  const visualizationAPI = useVisualizationAPI()
  const mode = visualizationAPI.settings.buildings.mode

  const setMode = useCallback(
    (mode: "functions" | "off" | "areas" | "types") => {
      if (mode !== "off") prevMode = mode
      visualizationAPI.updateSettings((s: VisualizationSettings) =>
        mode !== s.buildings.mode
          ? {
              ...s,
              buildings: { ...s.buildings, mode: mode },
            }
          : s,
      )
      Analytics.track(
        EventName.Update,
        {
          feature_category: FeatureCategory.DisplaySetting,
          feature: "building_colors",
        },
        { mode },
      )
    },
    [visualizationAPI],
  )
  const t = useTranslator()

  return (
    <forma-visibility-menu-item
      text={t(($) => $.building.buildingColorsLabel)}
      onToggle={() => setMode(mode === "off" ? prevMode : "off")}
      selected={mode !== "off"}
      options={[
        {
          icon: functionIcon,
          selected: mode === "functions",
          toolTip: "Functions",
          action: () => setMode(mode === "functions" ? "off" : "functions"),
        },
        {
          icon: typesIcon,
          selected: mode === "types",
          toolTip: "Unit types",
          action: () => setMode(mode === "types" ? "off" : "types"),
        },
        {
          icon: areasIcon,
          selected: mode === "areas",
          toolTip: "Unit areas",
          action: () => setMode(mode === "areas" ? "off" : "areas"),
        },
      ]}
    />
  )
}
