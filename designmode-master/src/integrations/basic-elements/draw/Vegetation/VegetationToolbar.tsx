import { EventName } from "@spacemakerai/webapp-analytics"
import { useCallback, useMemo } from "preact/compat"
import { Analytics, AnalyticsLegacy, AnalyticsTools, withSideEffect } from "src/core/analytics"
import { dispatchVegetationEvent } from "src/core/events/vegetationEvents"
import { showCategory } from "src/core/categories"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { toolAPI } from "src/core/toolsState"
import { useOnCompleteLine, useOnCompletePolygon } from "src/integrations/basic-elements/draw/onCompleteBasicElement"
import { drawApi, propertyPresets } from "src/integrations/draw/DrawAPI"
import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { ToolbarGroupedButton } from "src/integrations/toolbar/ToolbarGroupedButton"
import { helpLinkDrawInDesignMode, helpLinkTerrainPads } from "src/lib/helpLinks"
import AreaTreesTooltip from "./icons/AreaTreesTooltip"
import BuildingPadsIcon from "./icons/BuildingPadsIcon"
import TreeIcon from "./icons/TreeIcon"
import TreeLineTooltip from "./icons/TreeLineTooltip"
import { TerrainPadPropertyPanel } from "src/integrations/terrainPadsExperimental/components/TerrainPadPropertyPanel"
import { DrawPadsTool } from "src/integrations/terrainPadsExperimental/components/DrawPadsTool"
import TerrainToolTipAnimation from "./icons/terrain-tooltip.gif"
import { elementState } from "src/core/elements/ElementState"
import { useTranslator } from "src/i18n"

export const HOTKEY_TREE_LINE = "V"
export const HOTKEY_TREE_AREA = "A"

export function useDrawTreeLine() {
  const completeTreeLine = useOnCompleteLine(propertyPresets.tree_line)
  return useCallback(() => {
    showCategory("vegetation", scenarioModeSignal.peek())
    drawApi.getLine(
      withSideEffect(completeTreeLine, (line) => {
        if (line) {
          dispatchVegetationEvent("tree_line", EventName.Add)
        }
      }),
      drawApi.simpleLineElementRenderer(propertyPresets.tree_line),
    )
  }, [completeTreeLine])
}

export function useDrawTreeArea() {
  const completeTreeArea = useOnCompletePolygon(propertyPresets.tree_area)
  return useCallback(() => {
    showCategory("vegetation", scenarioModeSignal.peek())
    drawApi.getPolygon(
      withSideEffect(completeTreeArea, (shape) => {
        if (shape) {
          dispatchVegetationEvent("tree_area", EventName.Add)
        }
      }),
      drawApi.simplePolygonElementRenderer(propertyPresets.tree_area),
    )
  }, [completeTreeArea])
}

export function createTreeLineHotkey(drawTreeLine: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.vegetation.treeLine.hotkeyDescription),
    keyCode: HOTKEY_TREE_LINE,
    callback: drawTreeLine,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function createTreeAreaHotkey(drawTreeArea: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.vegetation.areaWithTrees.hotkeyDescription),
    keyCode: HOTKEY_TREE_AREA,
    callback: drawTreeArea,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export const VegetationToolbar = () => {
  const t = useTranslator()
  const drawTreeLine = useDrawTreeLine()
  const drawTreeArea = useDrawTreeArea()
  const currentTerrain = elementState.currentTerrainSignal.value
  const treeLineHotkey = useMemo(
    () =>
      createTreeLineHotkey(() => {
        drawTreeLine()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Vegetation, "hotkey")
        Analytics.trackSelectTool("draw", "line", "hotkey", "vegetation")
      }),
    [drawTreeLine],
  )
  useHotkey(treeLineHotkey)

  const treeAreaHotkey = useMemo(
    () =>
      createTreeAreaHotkey(() => {
        drawTreeArea()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Vegetation, "hotkey")
        Analytics.trackSelectTool("draw", "polygon", "hotkey", "vegetation")
      }),
    [drawTreeArea],
  )
  useHotkey(treeAreaHotkey)

  const tools: ToolConfig[] = [
    {
      label: (t) => t(($) => $.vegetation.treeLine.name),
      icon: TreeIcon,
      shortCut: HOTKEY_TREE_LINE,
      onClick: () => {
        drawTreeLine()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Vegetation, "toolbar", { subTool: "treeLine" })
        Analytics.trackSelectTool("draw", "line", "hotkey", "vegetation")
      },
      expandedTooltip: {
        title: (t) => t(($) => $.vegetation.treeLine.name),
        bodyText: (t) => t(($) => $.vegetation.treeLine.tooltip),
        icon: <TreeLineTooltip />,
        helpUrl: helpLinkDrawInDesignMode,
      },
    },
    {
      label: (t) => t(($) => $.vegetation.areaWithTrees.name),
      icon: TreeIcon,
      shortCut: HOTKEY_TREE_AREA,
      onClick: () => {
        drawTreeArea()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Vegetation, "toolbar", { subTool: "treeArea" })
        Analytics.trackSelectTool("draw", "polygon", "hotkey", "vegetation")
      },
      expandedTooltip: {
        title: (t) => t(($) => $.vegetation.areaWithTrees.name),
        bodyText: (t) => t(($) => $.vegetation.areaWithTrees.tooltip),
        icon: <AreaTreesTooltip />,
        helpUrl: helpLinkDrawInDesignMode,
      },
    },
  ]

  const terrainPadsButton: ToolConfig = {
    label: (t) => t(($) => $.terrain.pad.name),
    icon: BuildingPadsIcon,
    onClick: () => {
      toolAPI.setTool({
        id: "terrain-pads",
        tool: () => <DrawPadsTool />,
        propertyPanel: () => <TerrainPadPropertyPanel />,
        toolbar: "topLevel",
      })
    },
    expandedTooltip: {
      title: (t) => t(($) => $.terrain.pad.name),
      bodyText: (t) => t(($) => $.terrain.pad.tooltip),
      icon: (
        <img
          src={TerrainToolTipAnimation}
          alt={t(($) => $.terrain.pad.tooltip)}
          height="110"
          width="196"
          loading="lazy"
        />
      ),
      helpUrl: helpLinkTerrainPads,
    },
  }
  const configs = currentTerrain ? [terrainPadsButton, ...tools] : tools
  return (
    <ToolbarGroupedButton
      id={"vegetation-toolbar"}
      title={(t) => t(($) => $.vegetation.landscapingTitle)}
      configs={configs}
    />
  )
}
