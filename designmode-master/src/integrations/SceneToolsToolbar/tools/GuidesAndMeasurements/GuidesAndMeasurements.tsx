import styles from "src/integrations/SceneToolsToolbar/SceneToolsToolbar.module.pcss"
import { atom, useRecoilState } from "recoil"
import type { ToolCfg } from "src/core/toolsState"
import { exitCurrentTool, toolAPI } from "src/core/toolsState"
import {
  setUserDefinedSnapToExternalSignalValue,
  setUserDefinedSnapToGuidesSignalValue,
  userDefinedSnapToExternalSignal,
  userDefinedSnapToGuidesSignal,
} from "src/integrations/snapping/snappingPicker.state"
import { useTranslator } from "src/i18n"
import { ClickOutside } from "src/lib/components/ClickOutside2"
import { useHotkey } from "src/core/hotkeys"
import ElevationAtCursor from "src/integrations/tools-common/ElevationAtCursor/ElevationAtCursor"
import { CornerChevron } from "src/integrations/SceneToolsToolbar/tools/VisibilityMenu/VisibilityMenuAssets"
import { useInitFormaUnits } from "src/lib/forma-units"

export const measurementToolsOpenState = atom({
  key: "measurementToolsOpenState",
  default: false,
})

export default function GuidesAndMeasurements() {
  const t = useTranslator()
  const [open, setOpen] = useRecoilState(measurementToolsOpenState)

  return (
    <div>
      <weave-tooltip text={!open ? t(($) => $.snapping.guidesAndMeasurements) : ""}>
        <button onClick={() => setOpen(!open)} className={styles.SceneToolsButton}>
          <forma-guides-measurements-24 className={styles.SceneToolsIcon24}></forma-guides-measurements-24>
          <CornerChevron />
        </button>
      </weave-tooltip>
      {open && <Menu close={() => setOpen(false)} />}
    </div>
  )
}

const elevationAtCursorToolCfg: ToolCfg = {
  id: "elevationAtCursor",
  tool: ElevationAtCursor,
  toolbar: "topLevel",
  propertyPanel: "default",
}
const Menu = ({ close }: { close: () => void }) => {
  const t = useTranslator()
  useHotkey({
    description: (t) => t(($) => $.guides.closeMenu),
    keyCode: "Escape",
    callback: close,
    editAccessRequired: false,
  })
  useInitFormaUnits()

  return (
    <ClickOutside onClickOutside={close}>
      <weave-menu open={true} left={-200} minwidth={190} top={-155} noedit={true}>
        <weave-menu-item
          selected={toolAPI.currentToolSignal.value.id === elevationAtCursorToolCfg.id}
          onClick={() =>
            toolAPI.currentToolSignal.value.id === elevationAtCursorToolCfg.id
              ? exitCurrentTool()
              : toolAPI.setTool(elevationAtCursorToolCfg)
          }
        >
          {t(($) => $.snapping.cursorElevation)}
        </weave-menu-item>
        <weave-menu-item
          selected={userDefinedSnapToExternalSignal.value}
          onClick={() => setUserDefinedSnapToExternalSignalValue((value) => !value)}
        >
          {t(($) => $.snapping.snapToObjects)}
        </weave-menu-item>
        <weave-menu-item
          selected={userDefinedSnapToGuidesSignal.value}
          onClick={() => setUserDefinedSnapToGuidesSignalValue((value) => !value)}
        >
          {t(($) => $.snapping.snapToGuides)}
        </weave-menu-item>
      </weave-menu>
    </ClickOutside>
  )
}
