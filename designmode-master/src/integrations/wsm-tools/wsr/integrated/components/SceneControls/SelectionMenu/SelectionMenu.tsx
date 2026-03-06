import { useCallback, useEffect, useState } from "preact/hooks"
import { CheckIcon } from "src/integrations/wsm-tools/wsr/svg-icons"
import { useTranslator } from "src/i18n"

import styles from "./SelectionMenu.module.pcss"
import S from "src/integrations/wsm-tools/wsr/integrated/components/SceneControls/SceneControls.module.pcss"
import { useRecoilState } from "recoil"
import { formitInitializedSignal } from "src/integrations/wsm-tools/wsr/api/useInitialize"
import { selectionMenuOpenState } from "src/integrations/wsm-tools/wsr/integrated/state"
import type { SelectionItemProps } from "src/integrations/wsm-tools/wsr/integrated/types"
import { MessageListenerResource } from "@spacemakerai/web-sketch-renderer"
import { ResourceManager } from "@spacemakerai/web-sketch-renderer"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import { getSelectionFilters } from "src/integrations/wsm-tools/wsr/integrated/utils/selectionsFilters"
import { Analytics } from "src/core/analytics"
import { ClickOutside } from "src/lib/components/ClickOutside2"
import { getFormItCommandFromName, getShortcutFromCommandOrName } from "src/integrations/wsm-tools/wsr/toolMeta"

const SelectionMenu = () => {
  const t = useTranslator()
  const isFormItCoreReady = formitInitializedSignal.value
  const [isSelectionMenuOpen, setIsSelectionMenuOpen] = useRecoilState(selectionMenuOpenState)

  const [selectOptions, setSelectOptions] = useState<SelectionItemProps[]>(getSelectionFilters())

  const messageHandler = getMessageHandler()

  const handleSelectionChange = useCallback(() => {
    const filter = FormIt.Selection.GetObjectTypeFilter()
    setSelectOptions((prevState) => {
      return prevState.map((option: SelectionItemProps) => {
        const idKey = option.id as keyof typeof filter
        option.selected = filter[idKey] as boolean
        return option
      })
    })
  }, [])

  useEffect(() => {
    if (!isFormItCoreReady || !FormIt.Selection) {
      return
    }

    handleSelectionChange()
  }, [isFormItCoreReady, handleSelectionChange])

  useEffect(() => {
    if (!isFormItCoreReady) return

    const messageListener = new MessageListenerResource(new ResourceManager(messageHandler), "Messages")
    messageListener.addMessageHandler("FormIt.Message.kSelectionFilterChanged", () => {
      handleSelectionChange()
    })

    return () => {
      messageListener.dispose()
    }
  }, [handleSelectionChange, isFormItCoreReady, messageHandler])

  const selectOptionClickHandler = (id: string) => {
    setSelectOptions((prevState: SelectionItemProps[]) => [
      ...prevState.map((option: SelectionItemProps) => {
        if (option.id === id) {
          option.selected = !option.selected
          const filter = FormIt.Selection.GetObjectTypeFilter()
          const idKey = id as keyof typeof filter
          FormIt.Selection.SetObjectTypeFilter({
            ...filter,
            [id]: !filter[idKey],
          })
          const action = !filter[idKey] ? "Enabled" : "Disabled"
          Analytics.trackSelectTool("3dSketch", `Selection Type ${action} - ${id}`, "toolbar", "design-tool")
        }
        return option
      }),
    ])
  }

  const buildSelectionItem = () => {
    const selectionCommand = "Tools: Select"
    const selectionName = getFormItCommandFromName(selectionCommand)?.Name
    const selectionShortcut = getShortcutFromCommandOrName(selectionCommand)

    const handleSelectionClick = () => {
      window.FormIt.Commands.DoCommand(selectionCommand)
      Analytics.trackSelectTool("3dSketch", `${selectionName}`, "toolbar", "design-tool")
      setIsSelectionMenuOpen(false)
    }

    return (
      <div>
        <div className={S.MenuItem} onClick={handleSelectionClick}>
          <div className={styles.ItemContainer}>
            <div className={S.LabelContainer}>
              <span style={{ marginLeft: "3px" }}>{selectionName}</span>
            </div>
            <div className={S.Acronym}>{selectionShortcut}</div>
          </div>
        </div>
      </div>
    )
  }

  const buildLassoSelectionItem = () => {
    const lassoSelectionCommand = "Tools: Lasso Select"
    const lassoSelectName = getFormItCommandFromName(lassoSelectionCommand)?.Name
    const lassoSelectShortcut = getShortcutFromCommandOrName(lassoSelectionCommand)

    const handleLassoSelectionClick = () => {
      window.FormIt.Commands.DoCommand(lassoSelectionCommand)
      Analytics.trackSelectTool("3dSketch", `${lassoSelectName}`, "toolbar", "design-tool")
      setIsSelectionMenuOpen(false)
    }

    return (
      <div>
        <div className={S.MenuItem} onClick={handleLassoSelectionClick}>
          <div className={styles.ItemContainer}>
            <div className={S.LabelContainer}>
              <span style={{ marginLeft: "3px" }}>{lassoSelectName}</span>
            </div>
            <div className={S.Acronym}>{lassoSelectShortcut}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!isSelectionMenuOpen) return null

  return (
    <ClickOutside onClickOutside={() => setIsSelectionMenuOpen(false)}>
      <weave-menu open={true} left={-160} minwidth={191} top={-420} noedit={true}>
        <div className={S.MenuHeader}>{t(($) => $.wsm.selection.areaSelectionOptions)}</div>
        <div className={S.DividerContainer}>
          <div className={S.Divider} />
        </div>
        {selectOptions.map((option: SelectionItemProps) => (
          <div className={S.MenuItem} key={option.id} onClick={() => selectOptionClickHandler(option.id)}>
            <div className={styles.ItemContainer}>
              <div className={S.LabelContainer}>
                <div className={S.IconWrapper}>{option.selected && <CheckIcon />}</div>
                <span>{t.getText(option.label)}</span>
              </div>
              <div className={S.Acronym}>{option.acronym}</div>
            </div>
          </div>
        ))}
        <div className={S.DividerContainer}>
          <div className={S.Divider} />
        </div>
        <div className={S.MenuHeader}>{t(($) => $.wsm.selection.selectionTools)}</div>
        <div className={S.DividerContainer}>
          <div className={S.Divider} />
        </div>
        {buildSelectionItem()}
        {buildLassoSelectionItem()}
      </weave-menu>
    </ClickOutside>
  )
}

export default SelectionMenu
