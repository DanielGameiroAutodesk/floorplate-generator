import { useEffect } from "preact/hooks"
import { useRecoilState, useRecoilValue } from "recoil"
import {
  setShowTerrainSignalValue,
  setTerrainMaterialSignalValue,
  showTerrainSignal,
  terrainMaterialSignal,
} from "src/core/terrain/terrain-state"
import {
  analysisColorsOpacityState,
  selectedAnalysisColorsOpacityState,
  showAnalysisColorState,
} from "src/integrations/analyses/analysis-colors-state"
import useFeatureFlag, { URLFlag } from "src/lib/featureToggling"
import { BuildingVisibilitySettings } from "src/integrations/building-systems-basic-building/BuildingVisibilitySettings"
import type { AnalysisType } from "src/integrations/analyses/analysis-state"
import { activeAnalysisSignal } from "src/integrations/analyses/analysis-state"
import { withLazyLoadScriptPlaceholder } from "src/lib/useLazyLoadScript"
import type { TerrainMaterial } from "src/core/terrain/terrain-types"
import { DebugSnappingVisibilityMenu } from "src/integrations/snapping/DebugSnapping"
import { SunApi } from "src/integrations/sun/api"
import { projectSignal } from "src/core/project/project"

const ACTIVE_OPACITY_MENU_ANALYSIS: AnalysisType[] = ["wind", "noise"]

type VisibilityMenuItemOptionType = {
  icon: JSX.Element
  selected: boolean
  toolTip?: string
  action: () => void
}

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "forma-visibility-menu": HTMLAttributes<HTMLElement> & {
        analysisToggle?: {
          showAnalysisColors: boolean
          selectedAnalysisColorsOpacity: number
          setSelectedAnalysisColorsOpacity: (newOpacity: number) => void
          onToggleAnalysisColors: (showAnalysisColors: boolean) => void
        }
        transitToggle?: {
          showTransit: boolean
          onToggleTransit: (showTransit: boolean) => void
        }
        terrainToggle?: {
          showTerrain: boolean
          terrainMode: TerrainMaterial
          supportedTerrainModes?: TerrainMaterial[]
          onToggleTerrain: (showTerrain: boolean) => void
          onTerrainModeChange: (mode: TerrainMaterial) => void
        }
        shadowToggle?: {
          showShadows: boolean
          timezone: string
          lat: number
          long: number
          sunDate: Date
          onToggleShadows: (showShadows: boolean) => void
          onSunDateChange: (newDate: Date) => void
          onShadowMenuChangeVisibility: (visible: boolean) => void
        }
      }
      "forma-visibility-menu-item": HTMLAttributes<HTMLElement> & {
        text: string
        selected?: boolean
        options?: VisibilityMenuItemOptionType[]
        onToggle: () => void
      }
    }
  }
}

const defaultSunDate = new Date()
defaultSunDate.setMonth(5)
defaultSunDate.setDate(21)
defaultSunDate.setHours(13)
defaultSunDate.setMinutes(42)
defaultSunDate.setTime(defaultSunDate.getTime() - defaultSunDate.getTimezoneOffset() * 60 * 1000)

const VisibilityMenuPlaceholder = () => (
  <div style="padding: 6px">
    <forma-eye-24 style="display: block; width: 24px; height: 24px; color: var(--icon-color-medium);"></forma-eye-24>
  </div>
)

export const VisibilityMenu = withLazyLoadScriptPlaceholder(
  "/web-components/forma-visibility-menu/forma-visibility-menu.js",
  "site-design",
  VisibilityMenuPlaceholder,
)(() => {
  const activeAnalysis = activeAnalysisSignal.value
  const [showAnalysisColors, setShowAnalysisColors] = useRecoilState(showAnalysisColorState(activeAnalysis))
  const [selectedAnalysisColorsOpacity, setSelectedAnalysisColorsOpacity] = useRecoilState(
    selectedAnalysisColorsOpacityState(activeAnalysis),
  )
  const analysisColorsOpacity = useRecoilValue(analysisColorsOpacityState(activeAnalysis))
  const analysisToggleEnabled = activeAnalysis != null && ACTIVE_OPACITY_MENU_ANALYSIS.includes(activeAnalysis)

  const showTerrain = showTerrainSignal.value
  const terrainMaterial = terrainMaterialSignal.value

  const debug = useFeatureFlag(URLFlag.Debug)

  const projectData = projectSignal.value

  useEffect(() => {
    if (analysisColorsOpacity === 0) setShowAnalysisColors(false)
  }, [analysisColorsOpacity, setShowAnalysisColors])

  const sunDate = SunApi.sunDateSignal.value

  useEffect(() => {
    // initialize sun position
    if (sunDate === undefined && projectData?.geoLocation) {
      // create new Date object at default date's time, in timezone specified in projectData.timezone
      const getOffset = (timeZone = "UTC", date = new Date()) => {
        const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }))
        const tzDate = new Date(date.toLocaleString("en-US", { timeZone }))
        return (tzDate.getTime() - utcDate.getTime()) / 60_000
      }
      const offset = getOffset(projectData.timezone, defaultSunDate)
      const newDate = new Date(defaultSunDate.getTime() - offset * 60 * 1000)
      SunApi.setSunDateSignalValue(newDate)
      SunApi.setShowShadowSignalValue(true)
    }
  }, [sunDate, projectData])

  if (!projectData?.geoLocation) return null
  if (!sunDate) return null

  return (
    <forma-visibility-menu
      data-intercom-target="visibility-menu"
      analysisToggle={
        analysisToggleEnabled
          ? {
              showAnalysisColors,
              selectedAnalysisColorsOpacity,
              setSelectedAnalysisColorsOpacity,
              onToggleAnalysisColors: setShowAnalysisColors,
            }
          : undefined
      }
      terrainToggle={{
        showTerrain,
        terrainMode: terrainMaterial,
        onToggleTerrain: setShowTerrainSignalValue,
        onTerrainModeChange: setTerrainMaterialSignalValue,
      }}
      shadowToggle={{
        showShadows: SunApi.showShadowSignal.value,
        timezone: projectData.timezone,
        lat: projectData.geoLocation[0],
        long: projectData.geoLocation[1],
        sunDate,
        onToggleShadows: SunApi.setShowShadowSignalValue,
        onSunDateChange: SunApi.setSunDateSignalValue,
        onShadowMenuChangeVisibility: SunApi.setSunGloveVisibleSignalValue,
      }}
    >
      <BuildingVisibilitySettings />
      {debug && <DebugSnappingVisibilityMenu />}
    </forma-visibility-menu>
  )
})
