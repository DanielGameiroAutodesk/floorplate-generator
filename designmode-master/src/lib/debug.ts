import { URLFlag } from "./featureToggling"

export const isDebugEnabled = new URLSearchParams(window.location.search).has(URLFlag.Debug)
