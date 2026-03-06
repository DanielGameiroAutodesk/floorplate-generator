import type { LinePreviewComponent } from "src/integrations/draw/DrawAPI"
import { drawApi, propertyPresets } from "src/integrations/draw/DrawAPI"
import { useOnCompleteLine } from "src/integrations/basic-elements/draw/onCompleteBasicElement"
import { useCallback, useMemo } from "react"
import { atom, useRecoilValue } from "recoil"
import type { Properties } from "@spacemakerai/element-types"
import { HotkeyCategory, type HotkeyKeyRegistration } from "src/core/hotkeys"
import { scenarioModeSignal } from "src/core/selection/selectionState"
import { showCategory } from "src/core/categories"
import { Analytics, withSideEffect } from "src/core/analytics"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

const currentRoadProps = atom<Properties>({
  key: "currentRoadProps",
  default: propertyPresets.road,
})

export const HOTKEY_ROADS = "T"

export function createRoadHotkey(drawRoad: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.transportation.roads.hotkeyDescription),
    keyCode: HOTKEY_ROADS,
    callback: drawRoad,
    editAccessRequired: true,
    category: HotkeyCategory.Tools,
  }
}

export function useDrawRoad() {
  const onComplete = useOnCompleteLine(propertyPresets.road)
  return useCallback(() => {
    showCategory("road", scenarioModeSignal.peek())
    drawApi.getLine(
      withSideEffect(onComplete, (shape) => {
        if (shape)
          Analytics.trackAddElement(
            EventName.Add,
            { feature_category: FeatureCategory.DesignTool, feature: "draw", object_type: "element" },
            { category: "road", shape_type: "line" },
          )
      }),
      RoadPreview,
    )
  }, [onComplete])
}

export const RoadPreview: LinePreviewComponent = ({ shape }) => {
  const currentProps = useRecoilValue(currentRoadProps)

  const Renderer = useMemo(() => {
    return drawApi.simpleLineElementRenderer(currentProps)
  }, [currentProps])

  return <Renderer shape={shape} />
}
