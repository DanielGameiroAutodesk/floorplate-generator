import { default as WebGL } from "three/addons/capabilities/WebGL.js"
import { getTranslator, isLocaleLoadedSignal } from "./i18n"
import { effect } from "@preact/signals"

if (!WebGL.isWebGLAvailable()) {
  effect(() => {
    // Wait for locale to be loaded to show the toast in the correct language.
    if (!isLocaleLoadedSignal.value) return
    const t = getTranslator()
    window.forma_toasts.push({
      content: {
        text: t(($) => $.webgl.notSupported.text),
        linkText: t(($) => $.webgl.notSupported.linkText),
        url: t(($) => $.webgl.notSupported.url),
      },
      status: "error",
      autoDismiss: false,
    })
  })
}
