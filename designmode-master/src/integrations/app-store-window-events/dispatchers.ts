export function dispatchOpenAppStore(source?: "generators-toolbar") {
  if (source == null) {
    window.dispatchEvent(new CustomEvent("forma/app-store/open"))
  } else {
    window.dispatchEvent(new CustomEvent("forma/app-store/open", { detail: { source } }))
  }
}
