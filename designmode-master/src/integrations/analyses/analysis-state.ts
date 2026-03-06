import { signal } from "@preact/signals"
import { atom } from "recoil"

export type AnalysisType =
  | "sky-component"
  | "wind"
  | "sun"
  | "solar-panel"
  | "area-metrics"
  | "microclimate"
  | "noise"
  | "embodied-carbon"
  | `analyses-extensions:${string}:${number}`

export const activeAnalysisSignal = signal<AnalysisType | null>(null)

export const requestedAnalysisState = atom<AnalysisType | null>({ key: "requestedAnalysisState", default: null })
