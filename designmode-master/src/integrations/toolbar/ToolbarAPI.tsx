import type { I18nStringProvider } from "src/i18n"
import { explicitSignalWithReset } from "src/lib/signal"

export interface ToolbarAPI {
  /**
   * Opens the toolbar for a specific element
   * @param title the title of the toolbar grouped button
   * @param button the label of the button to display in the toolbar
   */
  displayTool: (title: I18nStringProvider, button?: I18nStringProvider) => void
  reset: () => void
}

const [titleDisplaySignal, setTitleDisplaySignalValue, resetTitleDisplaySignal] =
  explicitSignalWithReset<I18nStringProvider>(() => "")

const [buttonDisplaySignal, setButtonDisplaySignalValue, resetButtonDisplaySignal] =
  explicitSignalWithReset<I18nStringProvider>(() => "")

export { titleDisplaySignal, buttonDisplaySignal }

let timer: NodeJS.Timeout | undefined

export const toolbarApi: ToolbarAPI = {
  displayTool(title, button) {
    setTitleDisplaySignalValue(() => title)
    // We need to wait for the title to be displayed before displaying the button
    if (button) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setButtonDisplaySignalValue(() => button)
      }, 100)
    }
  },
  reset() {
    resetTitleDisplaySignal()
    resetButtonDisplaySignal()
    if (timer) clearTimeout(timer)
  },
}
