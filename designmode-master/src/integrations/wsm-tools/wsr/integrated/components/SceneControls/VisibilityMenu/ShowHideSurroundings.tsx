import sceneManager from "src/core/three/sceneManager"
import { isI3dsFocusModeActiveSignal } from "src/integrations/wsm-tools/wsr/api/EditWSMElementTool"
import { useTranslator } from "src/i18n"

export function ShowHideSurroundings() {
  const t = useTranslator()
  const handleToggle = () => {
    FormIt.GroupEdit.SetShowEditedGroupOnly(!FormIt.GroupEdit.GetShowEditedGroupOnly())
    sceneManager.render()
  }

  const on = !isI3dsFocusModeActiveSignal.value

  return (
    <forma-visibility-menu-item
      text={t(($) => $.ui.surroundings)}
      disabled={on}
      selected={on}
      onToggle={handleToggle}
      options={[
        {
          icon: (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <text x="4" y="12">
                H
              </text>
            </svg>
          ),
          selected: false,
          toolTip: "Shortcut",
          action: handleToggle,
        },
      ]}
    />
  )
}
