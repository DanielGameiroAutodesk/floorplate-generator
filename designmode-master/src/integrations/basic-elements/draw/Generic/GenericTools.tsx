import type { ToolConfig } from "src/integrations/toolbar/ToolbarGroupedButton"
import { ToolbarGroupedButton } from "src/integrations/toolbar/ToolbarGroupedButton"
import { useMemo } from "preact/compat"
import { drawApi, propertyPresets } from "src/integrations/draw/DrawAPI"
import SurfaceIcon from "./icons/SurfaceIcon"
import VolumeIcon from "./icons/VolumeIcon"
import GenericVolumeTooltipIcon from "./icons/GenericVolumeTooltipIcon"
import GenericSurfaceTooltipIcon from "./icons/GenericSurfaceTooltipIcon"
import GenericLineTooltipIcon from "./icons/GenericLineTooltipIcon"
import { helpLinkDrawInDesignMode } from "src/lib/helpLinks"
import LineIcon from "./icons/LineIcon"
import {
  useOnCompleteExtrudedPolygon,
  useOnCompleteLine,
  useOnCompletePolygon,
} from "src/integrations/basic-elements/draw/onCompleteBasicElement"
import { useCallback } from "preact/hooks"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { AnalyticsLegacy, AnalyticsTools, Analytics, withSideEffect } from "src/core/analytics"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { showCategory } from "src/core/categories"
import { EventName } from "@spacemakerai/webapp-analytics"
import { dispatchGenericElementEvent } from "src/core/events/genericEvents"

const properties2D = propertyPresets.generic2D
const propertiesLine = propertyPresets.generic2DLine
const properties25D = propertyPresets.generic25D

export function useDrawGenericSurface() {
  const onComplete2D = useOnCompletePolygon(properties2D)
  return useCallback(() => {
    showCategory("generic", scenarioModeSignal.peek())
    drawApi.getPolygon(
      withSideEffect(onComplete2D, (shape) => {
        if (shape) {
          dispatchGenericElementEvent("surface", EventName.Add)
        }
      }),
      drawApi.simplePolygonElementRenderer(properties2D),
    )
  }, [onComplete2D])
}

export function useDrawGenericVolume() {
  const onComplete25D = useOnCompleteExtrudedPolygon(properties25D)
  return useCallback(() => {
    showCategory("generic", scenarioModeSignal.peek())
    drawApi.get25DVolume(
      withSideEffect(onComplete25D, (shape) => {
        if (shape) {
          dispatchGenericElementEvent("volume", EventName.Add)
        }
      }),
      drawApi.simpleVolume25DElementRenderer(properties25D),
    )
  }, [onComplete25D])
}

export const VOLUME_HOTKEY = "O"
export const SURFACE_HOTKEY = "U"
export const GENERIC_LINE_HOTKEY = "N"

export function createGenericVolumeHotkey(drawGenericVolume: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.basicElements.generic.volume.draw),
    callback: drawGenericVolume,
    category: HotkeyCategory.Tools,
    keyCode: VOLUME_HOTKEY,
    editAccessRequired: true,
  }
}

export function createGenericSurfaceHotkey(drawGenericSurface: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.basicElements.generic.surface.draw),
    callback: drawGenericSurface,
    category: HotkeyCategory.Tools,
    keyCode: SURFACE_HOTKEY,
    editAccessRequired: true,
  }
}

export function createGenericLineHotkey(drawGenericLine: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.basicElements.generic.line.draw),
    callback: drawGenericLine,
    category: HotkeyCategory.Tools,
    keyCode: GENERIC_LINE_HOTKEY,
    editAccessRequired: true,
  }
}

export function useDrawGenericLine() {
  const onCompleteLine = useOnCompleteLine(propertiesLine)
  return useCallback(() => {
    showCategory("generic", scenarioModeSignal.peek())
    drawApi.getLine(
      withSideEffect(onCompleteLine, (shape) => {
        if (shape) {
          dispatchGenericElementEvent("line", EventName.Add)
        }
      }),
      drawApi.simpleLineElementRenderer(propertyPresets.generic2DLine),
    )
  }, [onCompleteLine])
}

export const GenericTools = () => {
  const drawGenericSurface = useDrawGenericSurface()
  const drawGenericVolume = useDrawGenericVolume()
  const drawGenericLine = useDrawGenericLine()

  const drawVolumeHotkey = useMemo(
    () =>
      createGenericVolumeHotkey(() => {
        drawGenericVolume()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.GenericVolume, "hotkey")
        Analytics.trackSelectTool("draw", "volume25d", "hotkey", "generic")
      }),
    [drawGenericVolume],
  )
  useHotkey(drawVolumeHotkey)

  const drawSurfaceHotkey = useMemo(
    () =>
      createGenericSurfaceHotkey(() => {
        drawGenericSurface()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.GenericSurface, "hotkey")
        Analytics.trackSelectTool("draw", "polygon", "hotkey", "generic")
      }),
    [drawGenericSurface],
  )
  useHotkey(drawSurfaceHotkey)

  const drawLineHotkey = useMemo(
    () =>
      createGenericLineHotkey(() => {
        drawGenericLine()
        AnalyticsLegacy.trackSelectTool(AnalyticsTools.GenericLine, "hotkey")
        Analytics.trackSelectTool("draw", "line", "hotkey", "generic")
      }),
    [drawGenericLine],
  )
  useHotkey(drawLineHotkey)

  const configs: ToolConfig[] = useMemo(() => {
    return [
      {
        label: (t) => t(($) => $.basicElements.generic.volume.name),
        onClick: () => {
          drawGenericVolume()
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.GenericVolume, "toolbar")
          Analytics.trackSelectTool("draw", "volume25d", "hotkey", "generic")
        },
        icon: VolumeIcon,
        expandedTooltip: {
          title: (t) => t(($) => $.basicElements.generic.volume.name),
          bodyText: (t) => t(($) => $.basicElements.generic.volume.tooltip),
          icon: <GenericVolumeTooltipIcon />,
          helpUrl: helpLinkDrawInDesignMode,
        },
        shortCut: VOLUME_HOTKEY,
      },
      {
        label: (t) => t(($) => $.basicElements.generic.surface.name),
        onClick: () => {
          drawGenericSurface()
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.GenericSurface, "toolbar")
          Analytics.trackSelectTool("draw", "polygon", "toolbar", "generic")
        },
        icon: SurfaceIcon,
        expandedTooltip: {
          title: (t) => t(($) => $.basicElements.generic.surface.name),
          bodyText: (t) => t(($) => $.basicElements.generic.surface.tooltip),
          icon: <GenericSurfaceTooltipIcon />,
          helpUrl: helpLinkDrawInDesignMode,
        },
        shortCut: SURFACE_HOTKEY,
      },

      {
        label: (t) => t(($) => $.basicElements.generic.line.name),
        icon: LineIcon,
        onClick: () => {
          drawGenericLine()
          AnalyticsLegacy.trackSelectTool(AnalyticsTools.GenericLine, "toolbar")
          Analytics.trackSelectTool("draw", "line", "toolbar", "generic")
        },
        expandedTooltip: {
          title: (t) => t(($) => $.basicElements.generic.line.name),
          bodyText: (t) => t(($) => $.basicElements.generic.line.tooltip),
          icon: <GenericLineTooltipIcon />,
          helpUrl: helpLinkDrawInDesignMode,
        },
        shortCut: GENERIC_LINE_HOTKEY,
      },
    ]
  }, [drawGenericVolume, drawGenericSurface, drawGenericLine])
  return (
    <>
      <ToolbarGroupedButton
        id={"generic-toolbar"}
        configs={configs}
        title={(t) => t(($) => $.basicElements.generic.title)}
      />
    </>
  )
}
