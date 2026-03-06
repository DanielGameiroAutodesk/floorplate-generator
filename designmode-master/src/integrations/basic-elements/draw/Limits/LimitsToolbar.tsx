import SiteLimitTooltipIcon from "./icons/SiteLimitTooltipIcon"
import ZoneTooltipIcon from "./icons/ZoneTooltipIcon"
import ConstraintTooltipIcon from "./icons/ConstraintTooltipIcon"
import { helpLinkDrawInDesignMode } from "src/lib/helpLinks"
import { useCallback, useMemo } from "preact/compat"
import { drawApi, propertyPresets } from "src/integrations/draw/DrawAPI"
import {
  useOnCompleteExtrudedPolygon,
  useOnCompletePolygon,
} from "src/integrations/basic-elements/draw/onCompleteBasicElement"
import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { ToolbarGroupedButton } from "src/integrations/toolbar/ToolbarGroupedButton"
import SiteLimitIcon from "./icons/SiteLimitIcon"
import ZoneIcon from "./icons/ZoneIcon"
import { ConstraintsIconLarge } from "./icons/ConstraintsIcon"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { AnalyticsLegacy, AnalyticsTools, Analytics, withSideEffect } from "src/core/analytics"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { showCategory } from "src/core/categories"
import { EventName } from "@spacemakerai/webapp-analytics"
import { elementState } from "src/core/elements/ElementState"
import { dispatchLimitEvent } from "src/core/events/limitEvents"

export const HOTKEY_SITE_LIMIT = "S"
export const HOTKEY_ZONE = "Z"
export const HOTKEY_CONSTRAINTS = "C"

export function createSiteLimitHotkey(drawSiteLimit: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.limits.siteLimit.hotkeyDescription),
    keyCode: HOTKEY_SITE_LIMIT,
    callback: drawSiteLimit,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function createZoneHotkey(drawZone: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.limits.zone.hotkeyDescription),
    keyCode: HOTKEY_ZONE,
    callback: drawZone,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function createConstraintHotkey(drawConstraint: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.limits.constraint.hotkeyDescription),
    keyCode: HOTKEY_CONSTRAINTS,
    callback: drawConstraint,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function useDrawSiteLimit(options?: { siteLimitEnabled: boolean }) {
  const completeSiteLimit = useOnCompletePolygon(propertyPresets.site_limit)

  return useCallback(() => {
    showCategory("site_limit", scenarioModeSignal.peek())
    drawApi.getPolygon(
      withSideEffect(completeSiteLimit, (shape) => {
        if (shape)
          dispatchLimitEvent("site_limit", EventName.Add, {
            siteLimitEnabled: options?.siteLimitEnabled || false,
          })
      }),
      drawApi.simplePolygonElementRenderer(propertyPresets.site_limit),
    )
  }, [completeSiteLimit, options])
}

export function useDrawZone() {
  const completeZone = useOnCompletePolygon(propertyPresets.zone)

  return useCallback(() => {
    showCategory("zone", scenarioModeSignal.peek())
    drawApi.getPolygon(
      withSideEffect(completeZone, (shape) => {
        if (shape) {
          dispatchLimitEvent("zone", EventName.Add)
        }
      }),
      drawApi.simplePolygonElementRenderer(propertyPresets.zone),
    )
  }, [completeZone])
}

export function useDrawConstraint() {
  const completeConstraint = useOnCompleteExtrudedPolygon(propertyPresets.constraints)

  return useCallback(() => {
    showCategory("constraints", scenarioModeSignal.peek())
    drawApi.get25DVolume(
      withSideEffect(completeConstraint, (volume) => {
        if (volume) dispatchLimitEvent("constraint", EventName.Add)
      }),
      drawApi.simpleVolume25DElementRenderer(propertyPresets.constraints),
    )
  }, [completeConstraint])
}

export const LimitsToolbar = () => {
  const topLevelNodes = elementState.currentProposalSignal.value.getToplevelNodes()
  const hasSiteLimit = topLevelNodes.some((node) => node.element.properties?.category === "site_limit")

  const siteLimitEnabled = Boolean(!hasSiteLimit)

  const drawSiteLimit = useDrawSiteLimit({ siteLimitEnabled })

  const drawZone = useDrawZone()
  const drawConstraint = useDrawConstraint()

  const sitelimitHotkey = useMemo(
    () =>
      createSiteLimitHotkey(() => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.SiteLimit, "hotkey")
        Analytics.trackSelectTool("draw", "polygon", "hotkey", "site_limit")
        drawSiteLimit()
      }),
    [drawSiteLimit],
  )
  useHotkey(sitelimitHotkey)

  const zoneHotkey = useMemo(
    () =>
      createZoneHotkey(() => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Zone, "hotkey")
        Analytics.trackSelectTool("draw", "polygon", "hotkey", "zone")
        drawZone()
      }),
    [drawZone],
  )
  useHotkey(zoneHotkey)

  const constraintsHotkey = useMemo(
    () =>
      createConstraintHotkey(() => {
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.Constraints, "hotkey")
        Analytics.trackSelectTool("draw", "volume25d", "hotkey", "constraint")
        drawConstraint()
      }),
    [drawConstraint],
  )
  useHotkey(constraintsHotkey)

  const limitTools = useMemo((): ToolConfig[] => {
    return [
      {
        label: (t) => t(($) => $.limits.siteLimit.name),
        icon: SiteLimitIcon,
        shortCut: HOTKEY_SITE_LIMIT,
        onClick: () => {
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.SiteLimit, "toolbar")
          Analytics.trackSelectTool("draw", "polygon", "toolbar", "site_limit")
          drawSiteLimit()
        },
        expandedTooltip: {
          title: (t) => t(($) => $.limits.siteLimit.name),
          bodyText: (t) => t(($) => $.limits.siteLimit.tooltip),
          icon: <SiteLimitTooltipIcon />,
          helpUrl:
            "https://help.autodeskforma.com/en/articles/7959393-how-to-add-a-site-limit-and-what-it-impacts-in-forma",
        },
      },
      {
        label: (t) => t(($) => $.limits.zone.name),
        icon: ZoneIcon,
        shortCut: HOTKEY_ZONE,
        onClick: () => {
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.Zone, "toolbar")
          Analytics.trackSelectTool("draw", "polygon", "toolbar", "zone")
          drawZone()
        },
        expandedTooltip: {
          title: (t) => t(($) => $.limits.zone.name),
          bodyText: (t) => t(($) => $.limits.zone.tooltip),
          icon: <ZoneTooltipIcon />,
          helpUrl: helpLinkDrawInDesignMode,
        },
      },
      {
        label: (t) => t(($) => $.limits.constraint.name),
        icon: ConstraintsIconLarge,
        shortCut: HOTKEY_CONSTRAINTS,
        onClick: () => {
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.Constraints, "toolbar")
          Analytics.trackSelectTool("draw", "volume25d", "toolbar", "constraint")
          drawConstraint()
        },
        expandedTooltip: {
          title: (t) => t(($) => $.limits.constraint.name),
          bodyText: (t) => t(($) => $.limits.constraint.tooltip),
          icon: <ConstraintTooltipIcon />,
          helpUrl: helpLinkDrawInDesignMode,
        },
      },
    ]
  }, [drawSiteLimit, drawZone, drawConstraint])

  return <ToolbarGroupedButton id={"limits-toolbar"} title={(t) => t(($) => $.limits.title)} configs={limitTools} />
}
