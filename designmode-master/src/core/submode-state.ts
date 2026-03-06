import { explicitSignal } from "src/lib/signal"

export type Submode = "compare" | "viewAnalysis" | "lightMode"

const searchParams = new URLSearchParams(window.location.search)

function getInitialSubmode(): Submode | undefined {
  if (searchParams.has("compare")) {
    return "compare"
  } else if (searchParams.has("viewAnalysis")) {
    return "viewAnalysis"
  } else if (searchParams.has("light-mode")) {
    return "lightMode"
  }
  return
}

export const [submodeSignal, setSubmodeSignalValue] = explicitSignal<Submode | undefined>(getInitialSubmode())

declare global {
  interface Window {
    __SUBMODE_WITH_OWN_SCENE_ACTIVE__: boolean
  }
}
