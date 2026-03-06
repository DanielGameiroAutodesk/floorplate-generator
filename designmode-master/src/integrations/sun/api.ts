import { explicitSignal } from "src/lib/signal"
import type * as THREE from "three"

const [showShadowSignal, setShowShadowSignalValue] = explicitSignal<boolean>(true)

export type SunGroup = THREE.Group & {
  refs: { bulb: THREE.Mesh; light: THREE.DirectionalLight }
}

export enum SunDetails {
  name = "Sun",
}

const [sunDateSignal, setSunDateSignalValue] = explicitSignal<Date | undefined>(undefined)

const [sunGloveVisibleSignal, setSunGloveVisibleSignalValue] = explicitSignal(false)

export const SunApi = {
  showShadowSignal,
  setShowShadowSignalValue,
  sunDateSignal,
  setSunDateSignalValue,
  sunGloveVisibleSignal,
  setSunGloveVisibleSignalValue,
}
