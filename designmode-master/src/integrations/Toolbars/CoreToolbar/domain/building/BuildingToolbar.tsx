import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { ToolbarGroupedButton } from "src/integrations/toolbar/ToolbarGroupedButton"
import BuildingIcon from "src/lib/components/icons/building/BuildingIcon"
import LineBuildingIcon from "src/lib/components/icons/building/LineBuildingIcon"
import LineBuildingIconTooltip from "src/lib/components/icons/building/LineBuildingIconTooltip"
import FreeFormBuildingIconTooltip from "src/lib/components/icons/building/FreeFormBuildingIconTooltip"
import { helpLink3dSketch, helpLinkDrawHousing, helpLinkDrawInDesignMode } from "src/lib/helpLinks"
import { useMemo } from "preact/compat"
import RowhouseIcon from "src/lib/components/icons/building/RowhouseIcon"
import HouseTooltipIllustration from "./HouseTooltipIllustration"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { useStart3DBuilding } from "src/integrations/wsm-tools/wsr/toolbars/Integrated3DSketchToolbar"
import Sketch3DIcon from "src/integrations/wsm-tools/assets/Sketch3DIcon"
import { useTranslator } from "src/i18n"
import toolTipImage3DSketch from "src/integrations/building-systems-site-study/toolbar/tooltips/edit-in-3d-sketch.gif"
import { toolAPI } from "src/core/toolsState"
import { LINE_BUILDING_TOOL_CFG } from "src/integrations/building-systems-line-buildings/DrawNewLineBuilding/DrawLineBuilding"
import DrawBasicBuildingTool from "src/integrations/building-systems-basic-building/DrawBasicBuildingTool"
import RowhouseTools from "src/integrations/composition-site-graph-parcel/rowhouse/RowhouseTools"
import BuildingRowHouseToolbar from "src/integrations/composition-site-graph-parcel/rowhouse/BuildingRowhouseToolbar"
import { NewCompositionPanel } from "src/integrations/composition-site-graph-parcel/rowhouse/propertyPanel/sideBar/CompositionPanel"
import { showCategory } from "src/core/categories"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { AnalyticsLegacy, AnalyticsTools, Analytics } from "src/core/analytics"

function createSetLineBuildingTool(method: "hotkey" | "toolbar") {
  return () => {
    showCategory("building", scenarioModeSignal.peek())
    toolAPI.setTool(LINE_BUILDING_TOOL_CFG)
    AnalyticsLegacy.trackSelectTool(AnalyticsTools.LineBuilding, method)
    Analytics.trackSelectTool("draw", "line_building", method, "building")
  }
}

export function createSetBasicBuildingTool(method: "hotkey" | "toolbar" | "area_metrics") {
  return () => {
    showCategory("building", scenarioModeSignal.peek())
    toolAPI.setTool({
      id: "basicbuildingTool",
      tool: DrawBasicBuildingTool,
      toolbar: "topLevel",
      propertyPanel: "default",
    })
    AnalyticsLegacy.trackSelectTool(AnalyticsTools.BasicBuilding, method)
    Analytics.trackSelectTool("draw", "volume25d", method, "building")
  }
}

function createSetRowhouseTool(method: "hotkey" | "toolbar") {
  return () => {
    showCategory("building", scenarioModeSignal.peek())
    toolAPI.setTool({
      id: "rowhouseTool",
      tool: RowhouseTools,
      toolbar: BuildingRowHouseToolbar,
      propertyPanel: NewCompositionPanel,
    })
    AnalyticsLegacy.trackSelectTool(AnalyticsTools.House, method)
    Analytics.trackSelectTool("draw", "row_house", method, "building")
  }
}

export const HOTKEY_LINE = "L"
export const HOTKEY_FLOORSTACK = "B"
export const HOTKEY_HOUSE = "E"
export const HOTKEY_3D = "3"

export function createLineBuildingHotkey(startLine: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.building.types.line.draw),
    keyCode: HOTKEY_LINE,
    callback: startLine,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function createBasicBuildingHotkey(startBuilding: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.building.types.basic.draw),
    keyCode: HOTKEY_FLOORSTACK,
    callback: startBuilding,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function createRowhouseHotkey(startRowHouse: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.hotkeys.drawHouse),
    keyCode: HOTKEY_HOUSE,
    callback: startRowHouse,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function create3dBuildingHotkey(startBuilding: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.wsm.buildingType.draw),
    keyCode: HOTKEY_3D,
    callback: startBuilding,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export const BuildingToolbar = () => {
  const t = useTranslator()

  const lineHotkey = useMemo(() => {
    return createLineBuildingHotkey(createSetLineBuildingTool("hotkey"))
  }, [])

  useHotkey(lineHotkey)
  const freeformHotkey = useMemo(() => {
    return createBasicBuildingHotkey(createSetBasicBuildingTool("hotkey"))
  }, [])

  useHotkey(freeformHotkey)
  const houseHotkey = useMemo(() => {
    return createRowhouseHotkey(createSetRowhouseTool("hotkey"))
  }, [])

  useHotkey(houseHotkey)

  const start3DBuilding = useStart3DBuilding()
  const sketch3dHotkey = useMemo(() => {
    return create3dBuildingHotkey(() => start3DBuilding("hotkey"))
  }, [start3DBuilding])
  useHotkey(sketch3dHotkey)

  const tools: ToolConfig[] = useMemo<ToolConfig[]>(
    () => [
      {
        label: (t) => t(($) => $.building.types.line.name),
        icon: LineBuildingIcon,
        shortCut: HOTKEY_LINE,
        onClick: createSetLineBuildingTool("toolbar"),
        expandedTooltip: {
          title: (t) => t(($) => $.building.types.line.name),
          bodyText: (t) => t(($) => $.building.types.line.tooltip),
          icon: <LineBuildingIconTooltip />,
          helpUrl: helpLinkDrawInDesignMode,
        },
      },
      {
        label: (t) => t(($) => $.building.types.basic.name),
        icon: BuildingIcon,
        shortCut: HOTKEY_FLOORSTACK,
        onClick: createSetBasicBuildingTool("toolbar"),
        expandedTooltip: {
          title: (t) => t(($) => $.building.types.basic.name),
          bodyText: (t) => t(($) => $.building.types.basic.tooltip),
          icon: <FreeFormBuildingIconTooltip />,
          helpUrl: helpLinkDrawInDesignMode,
        },
      },
      {
        label: (t) => t(($) => $.wsm.buildingType.name),
        icon: () => <Sketch3DIcon showFloorLine={true} />,
        shortCut: HOTKEY_3D,
        onClick: () => start3DBuilding("toolbar"),
        expandedTooltip: {
          title: (t) => t(($) => $.wsm.buildingType.name),
          bodyText: (t) => t(($) => $.wsm.tooltips.building),
          icon: (
            <img
              src={toolTipImage3DSketch}
              alt={t(($) => $.wsm.actions.launch)}
              height="110"
              width="196"
              loading="lazy"
            />
          ),
          helpUrl: helpLink3dSketch,
        },
      },
      {
        label: (t) => t(($) => $.rowhouse.name),
        icon: RowhouseIcon,
        shortCut: HOTKEY_HOUSE,
        onClick: createSetRowhouseTool("toolbar"),
        expandedTooltip: {
          title: (t) => t(($) => $.rowhouse.name),
          bodyText: (t) => t(($) => $.rowhouse.tooltip),
          icon: <HouseTooltipIllustration />,
          helpUrl: helpLinkDrawHousing,
        },
      },
    ],
    [start3DBuilding, t],
  )

  return (
    <ToolbarGroupedButton id={"building-toolbar"} title={(t) => t(($) => $.building.toolbar.title)} configs={tools} />
  )
}
