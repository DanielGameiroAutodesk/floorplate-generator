import { Fragment } from "preact"
import { useEffect, useState } from "preact/hooks"

import { BackIcon, NextIcon, NavigatorCheckIcon, NavigatorCloseIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import { getFinishSelectionTools, type SelectionTool } from "src/integrations/wsm-tools/wsr/integrated/utils/tools"
import { FinishSelectionToolName } from "src/integrations/wsm-tools/wsr/integrated/utils/enums"

import styles from "./AdvancedModelingConfirmation.module.pcss"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil"
import ToolButton from "src/integrations/wsm-tools/wsr/integrated/components/Common/ToolButton"
import { guideTextAtom } from "src/integrations/GuideText/GuideText"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import { MessageListenerResource } from "@spacemakerai/web-sketch-renderer"
import { ResourceManager } from "@spacemakerai/web-sketch-renderer"
import type { EnableOptions, ToastStatus, ToolbarOptions } from "src/integrations/wsm-tools/wsr/integrated/types"
import { useTranslator, type I18nStringProvider } from "src/i18n"
import sceneManager from "src/core/three/sceneManager"
import { wsmActiveToolState, wsmIsAdvancedToolActiveSelector } from "src/integrations/wsm-tools/wsr/integrated/state"

const buttonIconsMap = {
  button_back: <BackIcon />,
  button_next: <NextIcon />,
  button_confirm: <NavigatorCheckIcon />,
  button_cancel: <NavigatorCloseIcon />,
}

// FormIt.ToolType is not initialized yet.
const getAdvancedModelingToolsLabelMap = (): Record<number, I18nStringProvider> => ({
  [FormIt.ToolType.JOIN]: (t) => t(($) => $.wsm.advancedModeling.union),
  [FormIt.ToolType.CUT]: (t) => t(($) => $.wsm.advancedModeling.subtract),
  [FormIt.ToolType.INTERSECT]: (t) => t(($) => $.wsm.advancedModeling.intersect),
  [FormIt.ToolType.SWEEP]: (t) => t(($) => $.wsm.advancedModeling.sweep),
  [FormIt.ToolType.COVER_EDGES]: (t) => t(($) => $.wsm.advancedModeling.cover),
  [FormIt.ToolType.LOFT_EDGES]: (t) => t(($) => $.wsm.advancedModeling.loft),
  [FormIt.ToolType.OFFSET_BODY]: (t) => t(($) => $.wsm.advancedModeling.offset),
  [FormIt.ToolType.SHELL_BODY]: (t) => t(($) => $.wsm.advancedModeling.shell),
  [FormIt.ToolType.BLEND]: (t) => t(($) => $.wsm.advancedModeling.fillet),
})

const AdvancedModelingConfirmation = () => {
  const t = useTranslator()
  const isFormItCoreReady = formitInitializedSignal.value
  const [toolbarOptions, setToolbarOptions] = useState<ToolbarOptions | null>()
  const [enableOptions, setEnableOptions] = useState<EnableOptions | null>()
  const setGuideText = useSetRecoilState(guideTextAtom)
  const [tools, setTools] = useState<SelectionTool[]>([])
  const messageHandler = getMessageHandler()
  const [wsmActiveTool, setWSMActiveTool] = useRecoilState(wsmActiveToolState)
  const isAdvancedModelingToolActive = useRecoilValue(wsmIsAdvancedToolActiveSelector)

  useEffect(() => {
    if (!isFormItCoreReady) return

    setTools(getFinishSelectionTools())
  }, [isFormItCoreReady])

  useEffect(() => {
    if (!isFormItCoreReady) return

    const messageListener = new MessageListenerResource(new ResourceManager(messageHandler), "Messages")

    // Enables confirmation toolbar
    messageListener.addMessageHandler(FormIt.Message.kShowSelectionToolbar, (payload: any) =>
      setToolbarOptions(payload),
    )

    // Changes the visibility of the buttons in the confirmation toolbar
    messageListener.addMessageHandler(FormIt.Message.kEnableSelectionToolbarButtons, (payload: ToolbarOptions) => {
      setEnableOptions(payload)
    })

    // Hides confirmation toolbar
    messageListener.addMessageHandler(FormIt.Message.kHideSelectionToolbar, () => {
      setToolbarOptions(null)
    })

    messageListener.addMessageHandler("FormIt.Message.kShowNotification", (payload: any) => {
      const statusMap: Record<number, ToastStatus> = {
        1: "success",
        2: "warning",
        3: "error",
        4: "primary",
      }
      const status = statusMap[payload.type] || "none"
      const message = payload.message.replaceAll(/<\/?[^>]+(>|$)/gi, "")
      window.forma_toasts.push({
        content: message,
        status,
        autoDismiss: payload.timeout !== null,
      })
    })

    messageListener.addMessageHandler(FormIt.Message.kToolRemoved, () => {
      const tt = FormIt.Tools.GetActiveToolType()
      if (tt == wsmActiveTool || (isAdvancedModelingToolActive && tt == FormIt.ToolType.FILTERED_SELECTION))
        setWSMActiveTool(FormIt.ToolType.NONE)
    })
    return () => {
      messageListener.dispose()
    }
  }, [isAdvancedModelingToolActive, isFormItCoreReady, messageHandler, setWSMActiveTool, wsmActiveTool])

  useEffect(() => {
    if (!toolbarOptions) return

    setTools((prevState: any) => {
      return prevState.map((tool: any) => {
        if (tool.name === FinishSelectionToolName.Confirm) {
          tool.enabled = enableOptions?.bFinishEnabled ?? toolbarOptions.bFinishEnabled
          tool.show = toolbarOptions.bShowFinishButton
        }
        if (tool.name === FinishSelectionToolName.Back) {
          tool.enabled = enableOptions?.bNextEnabled ?? toolbarOptions.bBackEnabled
          tool.show = toolbarOptions.bShowBackButton
        }
        if (tool.name === FinishSelectionToolName.Next) {
          tool.enabled = enableOptions?.bNextEnabled ?? toolbarOptions.bNextEnabled
          tool.show = toolbarOptions.bShowNextButton
        }
        return tool
      })
    })
  }, [toolbarOptions, enableOptions])

  const handleToolClick = (tool: SelectionTool) => {
    tool.handleClick()

    if ([FinishSelectionToolName.Cancel, FinishSelectionToolName.Confirm].includes(tool.name)) {
      setToolbarOptions(null)
      setEnableOptions(null)
    }
  }

  useEffect(() => {
    setGuideText(() => () => toolbarOptions?.message ?? "")

    return () => {
      setGuideText(undefined)
    }
  }, [toolbarOptions?.message, setGuideText])

  useEffect(() => {
    if (!toolbarOptions) return
    sceneManager.canvas.focus()
  }, [toolbarOptions])

  if (!toolbarOptions) return null

  const advancedModelingToolsLabelMap = getAdvancedModelingToolsLabelMap()

  return (
    <div className="forma-grid-main">
      <div className={styles.Container}>
        {tools.map((tool: SelectionTool) => {
          if (tool.show) {
            return (
              <Fragment key={tool.name}>
                <weave-tooltip text={tool.enabled && tool.toolTip ? t.getText(tool.toolTip) : ""} nub="up-center">
                  <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                    <div disabled={!tool.enabled}>
                      <ToolButton
                        disabled={!tool.enabled}
                        icon={buttonIconsMap[tool.icon as keyof typeof buttonIconsMap]}
                        onClick={() => handleToolClick(tool)}
                      />
                    </div>
                  </div>
                </weave-tooltip>
              </Fragment>
            )
          }
        })}
        <div className={styles.ToolName}>
          {advancedModelingToolsLabelMap[toolbarOptions.toolType]
            ? t.getText(advancedModelingToolsLabelMap[toolbarOptions.toolType])
            : ""}
        </div>
      </div>
    </div>
  )
}

export default AdvancedModelingConfirmation
