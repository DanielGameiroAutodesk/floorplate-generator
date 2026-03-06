import useEditIn3DSketch from "src/integrations/3dsketch/useEditIn3DSketch"
import { setContextMenuPositionSignalValue } from "src/core/context-menu-state"
import { useTranslator } from "src/i18n"

const EditIn3DSketchMenu = () => {
  const t = useTranslator()
  const handleOnClick = useEditIn3DSketch("context_menu")
  return (
    <>
      <forma-context-menu-item
        text={t(($) => $.wsm.actions.editIn)}
        onClick={() => {
          handleOnClick()
          setContextMenuPositionSignalValue(undefined)
        }}
        shortcut-mac={"↵"}
        shortcut-win={"Enter"}
      />
      <forma-context-menu-divider />
    </>
  )
}

export default EditIn3DSketchMenu
