import { getTranslator } from "src/i18n"

export default function invalid3dSketchOperationToast() {
  const t = getTranslator()
  window.forma_toasts.push({
    content: t(($) => $.sketch3D.invalidOperationToast),
    status: "warning",
  })
}
