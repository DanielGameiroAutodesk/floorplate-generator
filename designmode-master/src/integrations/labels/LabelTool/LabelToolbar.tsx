import Label24px from "src/integrations/labels/Icons/Label24px"
import ToolbarButton, { ToolbarCloseButton } from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { labelToolConfigBase } from "./LabelTool"
import type { ToolCfg } from "src/core/toolsState"
import { toolAPI } from "src/core/toolsState"
import LabelProperties from "src/integrations/labels/PropertyPanel/LabelPropertiesContainer"
import LabelTooltipIcon from "src/integrations/labels/Icons/LabelTooltipIcon"
import { MAX_LINES } from "src/integrations/labels/constants"
import { useMemo } from "preact/compat"
import { HotkeyCategory, useHotkey, type HotkeyKeyRegistration } from "src/core/hotkeys"
import FormaToolbarDivider from "src/lib/components/FormaToolbarDivider"
import { AnalyticsLegacy, AnalyticsTools, Analytics } from "src/core/analytics"

export const labelToolCfg: ToolCfg = {
  ...labelToolConfigBase,
  propertyPanel: LabelProperties,
}

function createSetLabelTool(method: "hotkey" | "toolbar") {
  return () => {
    toolAPI.setTool(labelToolCfg)
    AnalyticsLegacy.trackSelectTool(AnalyticsTools.Label, method)
    Analytics.trackSelectTool("add_label", undefined, method)
  }
}

export const LABEL_HOTKEY = "L"

export function createLabelToolHotkey(startLabelTool: () => void): HotkeyKeyRegistration {
  return {
    description: (t) => t(($) => $.labels.addLabelButton),
    keyCode: LABEL_HOTKEY,
    editAccessRequired: true,
    callback: startLabelTool,
    shift: true,
    ctrl: false,
    alt: false,
    meta: false,
    category: HotkeyCategory.General,
  }
}

export function LabelToolbar() {
  const hotkey = useMemo(() => {
    return createLabelToolHotkey(createSetLabelTool("hotkey"))
  }, [])

  useHotkey(hotkey)

  return (
    <ToolbarButton
      label={(t) => t(($) => $.labels.label)}
      icon={<Label24px />}
      shortCut={"⇧L"}
      onClick={createSetLabelTool("toolbar")}
      expandedTooltip={{
        title: (t) => t(($) => $.labels.label),
        bodyText: (t) => t(($) => $.labels.description, { count: MAX_LINES }),
        icon: LabelTooltipIcon(),
        shortcut: "⇧L",
        helpUrl: "https://help.autodeskforma.com/en/articles/8975049",
        position: "bottom",
      }}
    />
  )
}

const NO_OP = () => {}
export function LabelToolbarActive() {
  return (
    <>
      <ToolbarButton label={(t) => t(($) => $.labels.label)} icon={<Label24px />} onClick={NO_OP} active />
      <FormaToolbarDivider direction="vertical" />
      <ToolbarCloseButton />
    </>
  )
}
