declare global {
  interface WindowEventMap {
    "forma/app-store/open": CustomEvent<{ source: "generators-toolbar" | string } | undefined>
  }
}

// Force this to be an ESM module (as there are no imports at time of writing).
export {}
