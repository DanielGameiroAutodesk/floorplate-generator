// Prefer to place things in individual lib/integrations specific
// files instead of this.
//
// This file should ideally only hold internal designmode globals.

declare global {
  interface Window {
    globalSpinner: { start: () => void; stop: () => void }
    globalLoadingOverlay: { start: () => void; stop: () => void }
    globalCanvasScreenshotOverlay: { start: () => void; stop: () => void }
    __SCENE_INITIALIZED__: boolean
    FormItModule: any
  }
}

// Force this to be an ESM module (as there are no imports at time of writing).
export {}
