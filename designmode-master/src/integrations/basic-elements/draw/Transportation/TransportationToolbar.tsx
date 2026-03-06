import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { ToolbarGroupedButton } from "src/integrations/toolbar/ToolbarGroupedButton"
import { createRoadHotkey, HOTKEY_ROADS } from "./roads"
import { createRailsHotkey, HOTKEY_RAILS, useDrawRails } from "./rails"
import { useDrawRoadsWithGraph } from "src/integrations/composition-site-graph/tools/DrawRoadWithGraph"
import { RoadIconLarge } from "./icons/RoadIcon"
import RoadsTooltipIcon from "./icons/RoadsTooltipIcon"
import { helpLinkDrawInDesignMode, helpLinkTransportation } from "src/lib/helpLinks"
import { useMemo } from "preact/compat"
import { RailsIconLarge } from "./icons/RailsIcon"
import RailRoadsTooltipIcon from "./icons/RailRoadsTooltipIcon"
import { AnalyticsLegacy, AnalyticsTools, Analytics } from "src/core/analytics"
import { useHotkey } from "src/core/hotkeys"
import { createCurvedTransportationTool } from "src/integrations/transportation/tools/DrawTransportCurve"

export const TransportationToolbar = () => {
  const site = false //useFeatureFlag(URLFlag.SiteGraph)

  if (site) {
    return <GraphTransportation />
  }

  return <TransportationToolbarCurrent />
}

//TODO: Remove
function GraphTransportation() {
  const drawRails = useDrawRails()
  const railsToolbarButton: ToolConfig = useMemo(() => {
    return {
      label: (t) => t(($) => $.transportation.railroads.name),
      icon: RailsIconLarge,
      onClick: drawRails,
      expandedTooltip: {
        title: (t) => t(($) => $.transportation.railroads.name),
        bodyText: (t) => t(($) => $.transportation.railroads.tooltip),
        icon: <RailRoadsTooltipIcon />,
        helpUrl: helpLinkDrawInDesignMode,
      },
      shortCut: HOTKEY_RAILS,
    }
  }, [drawRails])
  const roadsWithGraph = useDrawRoadsWithGraph()
  return (
    <ToolbarGroupedButton
      id={"graph-transportation-toolbar"}
      title={(t) => t(($) => $.transportation.title)}
      configs={[roadsWithGraph, railsToolbarButton]}
    />
  )
}

function TransportationToolbarCurrent() {
  const curvedRoadsButton: ToolConfig = useMemo(() => {
    return {
      label: (t) => t(($) => $.transportation.roads.toolButton),
      icon: RoadIconLarge,
      onClick: () => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Road, "toolbar")
        Analytics.trackSelectTool("draw", "curve", "toolbar", "road")
        createCurvedTransportationTool("road")
      },
      expandedTooltip: {
        title: (t) => t(($) => $.transportation.roads.name),
        bodyText: (t) => t(($) => $.transportation.roads.tooltip),
        icon: <RoadsTooltipIcon />,
        helpUrl: helpLinkTransportation,
      },
      shortCut: HOTKEY_ROADS,
    }
  }, [])

  const curvedRailsButton = useMemo<ToolConfig>(() => {
    return {
      label: (t) => t(($) => $.transportation.railroads.toolButton),
      icon: RailsIconLarge,
      onClick: () => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Rails, "toolbar")
        Analytics.trackSelectTool("draw", "curve", "toolbar", "rail")
        createCurvedTransportationTool("rail")
      },
      expandedTooltip: {
        title: (t) => t(($) => $.transportation.railroads.name),
        bodyText: (t) => t(($) => $.transportation.railroads.tooltip),
        icon: <RailRoadsTooltipIcon />,
        helpUrl: helpLinkTransportation,
      },
      shortCut: HOTKEY_RAILS,
    }
  }, [])

  const roadsHotkey = useMemo(
    () =>
      createRoadHotkey(() => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Road, "hotkey")
        Analytics.trackSelectTool("draw", "curve", "hotkey", "road")
        createCurvedTransportationTool("road")
      }),
    [],
  )
  const railsHotkey = useMemo(
    () =>
      createRailsHotkey(() => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Rails, "hotkey")
        Analytics.trackSelectTool("draw", "curve", "hotkey", "rail")
        createCurvedTransportationTool("rail")
      }),
    [],
  )

  useHotkey(roadsHotkey)
  useHotkey(railsHotkey)

  const configs = [curvedRoadsButton, curvedRailsButton]
  return (
    <ToolbarGroupedButton
      id={"transportation-toolbar"}
      title={(t) => t(($) => $.transportation.title)}
      configs={configs}
    />
  )
}
