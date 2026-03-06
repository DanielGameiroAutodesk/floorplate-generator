import { RotateIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import { toolAPI, type ToolCfg } from "src/core/toolsState"
import ToolbarButton from "src/integrations/toolbar/ToolbarButton/ToolbarButton"
import { Rotate } from "src/integrations/section-box/tooling/handling/Rotation"

export const rotateSectionBoxToolCfg: ToolCfg = {
  id: "sectionBoxRotate",
  tool: Rotate,
  toolbar: "topLevel",
  propertyPanel: "default",
}

export function SectionBoxToolbar() {
  return (
    <ToolbarButton
      icon={<RotateIcon />}
      onClick={() => {
        toolAPI.setTool(rotateSectionBoxToolCfg)
      }}
      label={(t) => t(($) => $.transform.rotate.name)}
      active={toolAPI.currentToolSignal.value.id === rotateSectionBoxToolCfg.id}
    />
  )
}
