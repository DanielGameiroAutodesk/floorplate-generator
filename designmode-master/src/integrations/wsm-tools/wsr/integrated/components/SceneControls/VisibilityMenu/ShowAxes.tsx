import { signal } from "@preact/signals"
import { MessageListenerResource, ResourceManager } from "@spacemakerai/web-sketch-renderer"
import { useCallback, useEffect } from "preact/hooks"
import { getMessageHandler } from "src/integrations/wsm-tools/wsr/utils"
import { useTranslator } from "src/i18n"

export function ShowAxes() {
  const t = useTranslator()
  const axesVisibleSignal = signal<boolean>(FormIt.VisualStyles.GetShowAxes())
  const axesDisplayEnabledSignal = signal<boolean>(FormIt.VisualStyles.IsAxisDisplayEnabled())

  //let [axesVisible, setAxesVisible] = useState(FormIt.VisualStyles.GetShowAxes())
  //let [axesDisplayEnabled, setAxesDisplayEnabled] = useState(FormIt.VisualStyles.IsAxisDisplayEnabled())
  const messageHandler = getMessageHandler()

  // Toggle Axes display on/off
  const handleToggle = useCallback(() => {
    if (FormIt.VisualStyles.IsAxisDisplayEnabled()) {
      FormIt.VisualStyles.SetShowAxes(!FormIt.VisualStyles.GetShowAxes())
      //setAxesVisible(FormIt.VisualStyles.GetShowAxes())
      axesVisibleSignal.value = FormIt.VisualStyles.GetShowAxes()
    }
  }, [axesVisibleSignal])

  // Listen to kAxesVisibilityChanged messages and update the UI
  useEffect(() => {
    const messageListener = new MessageListenerResource(new ResourceManager(messageHandler), "Messages")
    messageListener.addMessageHandler("FormIt.Message.kAxesVisibilityChanged", () => {
      //setAxesVisible(FormIt.VisualStyles.GetShowAxes())
      axesVisibleSignal.value = FormIt.VisualStyles.GetShowAxes()
      //setAxesDisplayEnabled(FormIt.VisualStyles.IsAxisDisplayEnabled())
      axesDisplayEnabledSignal.value = FormIt.VisualStyles.IsAxisDisplayEnabled()
    })

    return () => {
      // disopose of message listener on onMount
      messageListener.dispose()
    }
  }, [axesVisibleSignal, axesDisplayEnabledSignal, messageHandler])

  return (
    <>
      {axesDisplayEnabledSignal.value && (
        <forma-visibility-menu-item
          text={t(($) => $.ui.xyzAxes)}
          selected={axesVisibleSignal.value === true}
          onToggle={handleToggle}
          options={[
            {
              icon: (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <text x="0" y="12">
                    DZ
                  </text>
                </svg>
              ),
              selected: false,
              toolTip: "Shortcut",
              action: handleToggle,
            },
          ]}
        />
      )}
    </>
  )
}
