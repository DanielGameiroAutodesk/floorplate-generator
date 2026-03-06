import { useEffect, useState } from "preact/hooks"
import { useTranslator } from "src/i18n"
import { getMainToolBarToolsByGroupName } from "src/integrations/wsm-tools/wsr/integrated/utils/tools"

import { ClickOutside } from "src/lib/components/ClickOutside2"
import { useRecoilState, useSetRecoilState } from "recoil"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { guidesMeasurementMenuOpenState, isButtonClickedState } from "src/integrations/wsm-tools/wsr/integrated/state"
import S from "src/integrations/wsm-tools/wsr/integrated/components/SceneControls/SceneControls.module.pcss"
import Styled from "./GuidesAndMeasurement.module.pcss"

const commands = {
  setAxes: "Edit: Set Axes",
  resetAxes: "Edit: Reset Axes",
}

const GuidesAndMeasurementMenu = () => {
  const t = useTranslator()
  const [measureTools, setMeasureTools] = useState<FormIt.ToolInfo[]>([])
  const isFormItCoreReady = formitInitializedSignal.value
  const [isGuidesMeasurementMenuOpen, setIsGuidesMeasurementMenuOpen] = useRecoilState(guidesMeasurementMenuOpenState)
  const setIsButtonClickedState = useSetRecoilState(isButtonClickedState)

  useEffect(() => {
    if (!isFormItCoreReady) return

    const tools = getMainToolBarToolsByGroupName("MeasureMenu")

    setMeasureTools(tools)
  }, [isFormItCoreReady])

  if (!isGuidesMeasurementMenuOpen) return null

  const handleOnClick = () => {
    FormIt.Commands.DoCommand(commands.setAxes)
    setIsGuidesMeasurementMenuOpen(false)
  }

  const handleOnReset = (e: KeyboardEvent | MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    FormIt.Commands.DoCommand(commands.resetAxes)
    setIsGuidesMeasurementMenuOpen(false)
  }

  const startTool = (tool: FormIt.ToolInfo) => {
    FormIt.Tools.StartTool(tool.ToolType)
    setIsButtonClickedState(true)
  }

  return (
    <ClickOutside onClickOutside={() => setIsGuidesMeasurementMenuOpen(false)}>
      <weave-menu open={true} left={-170} minwidth={236} top={-232} noedit={true}>
        <div className={S.MenuHeader}>{t(($) => $.wsm.guidesAndMeasurements.menuTitle)}</div>
        <div className={S.DividerContainer}>
          <div className={S.Divider} />
        </div>
        {measureTools.map((tool) => (
          <div
            className={S.MenuItem}
            key={tool.Name}
            onClick={() => {
              startTool(tool)
              setIsGuidesMeasurementMenuOpen(false)
            }}
          >
            <div className={S.LabelContainer}>
              <span>
                {
                  <span>
                    {tool.ToolType === FormIt.ToolType.LINEAR_MEASURE
                      ? t(($) => $.wsm.guidesAndMeasurements.measureDistance)
                      : t(($) => $.wsm.guidesAndMeasurements.measureAngle)}
                  </span>
                }
              </span>
            </div>
            <div className={S.Acronym}>{tool.ToolType === FormIt.ToolType.LINEAR_MEASURE ? "ME" : "MA"}</div>
          </div>
        ))}
        <div className={S.MenuItem} onClick={handleOnClick}>
          <div className={S.LabelContainer}>{<span>{t(($) => $.wsm.axes.set)}</span>}</div>
          <div className={Styled.ActionContainer}>
            <div className={S.Acronym}>{"SZ"}</div>
          </div>
        </div>
        <div className={S.MenuItem} onClick={handleOnReset}>
          <div className={S.LabelContainer}>{<span>{t(($) => $.wsm.axes.reset)}</span>}</div>
          <div className={Styled.ActionContainer}>
            <div className={S.Acronym}>{"RZ"}</div>
          </div>
        </div>
      </weave-menu>
    </ClickOutside>
  )
}

export default GuidesAndMeasurementMenu
