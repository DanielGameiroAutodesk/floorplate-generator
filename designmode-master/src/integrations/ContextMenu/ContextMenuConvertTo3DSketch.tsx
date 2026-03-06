import useEditIn3DSketch from "src/integrations/3dsketch/useEditIn3DSketch"
import { setContextMenuPositionSignalValue } from "src/core/context-menu-state"
import { useTranslator } from "src/i18n"

const ContextMenuConvertTo3DSketch = () => {
  const t = useTranslator()
  const handleOnClick = useEditIn3DSketch("context_menu")
  return (
    <forma-context-menu-item
      text={t(($) => $.wsm.convert.title)}
      onClick={() => {
        handleOnClick()
        setContextMenuPositionSignalValue(undefined)
      }}
      shortcut-mac={""}
      shortcut-win={""}
    />
  )
}

export default ContextMenuConvertTo3DSketch
