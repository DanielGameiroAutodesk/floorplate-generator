import { drawApi, propertyPresets } from "src/integrations/draw/DrawAPI"
import { useOnCompleteLine } from "src/integrations/basic-elements/draw/onCompleteBasicElement"
import { useCallback } from "react"
import { HotkeyCategory, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { showCategory } from "src/core/categories"
import { Analytics, withSideEffect } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

export const HOTKEY_RAILS = "I"

export function createRailsHotkey(drawRails: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.transportation.railroads.hotkeyDescription),
    keyCode: HOTKEY_RAILS,
    callback: drawRails,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function useDrawRails() {
  const onComplete = useOnCompleteLine(propertyPresets.rails)
  return useCallback(() => {
    showCategory("rails", scenarioModeSignal.peek())
    drawApi.getLine(
      withSideEffect(onComplete, (shape) => {
        if (shape)
          Analytics.trackAddElement(
            EventName.Add,
            { feature_category: FeatureCategory.DesignTool, feature: "draw", object_type: "element" },
            { category: "rails", shape_type: "line" },
          )
      }),
      drawApi.simpleLineElementRenderer(propertyPresets.rails),
    )
  }, [onComplete])
}
