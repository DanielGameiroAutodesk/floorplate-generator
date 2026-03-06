export function dispatchIsLoadingEvent(analysisType: string, isLoading: boolean): void {
  window.dispatchEvent(
    new CustomEvent("forma-analysis-loadingstate-changed", {
      detail: { analysisType, isLoading },
    }),
  )
}

export function dispatchOpenAreaSelectEvent(): void {
  window.dispatchEvent(new Event("forma/analysis-menu/area-select-open"))
}

export function addToast(options: {
  content: { text: string; url?: string; linkText?: string }
  status: "primary" | "error"
  autoDismiss?: boolean
}): void {
  window.dispatchEvent(
    new CustomEvent("forma-toast-add", {
      detail: options,
    }),
  )
}
