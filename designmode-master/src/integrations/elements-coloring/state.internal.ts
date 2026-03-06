import type { InternalPath } from "src/lib/element/path"
import { computed } from "@preact/signals"
import { explicitSignal, signalFamily } from "src/lib/signal"

export type ElementColorOverrides = Map<InternalPath, Uint8Array>
export type LayeredElementColorOverrides = Map<number, ElementColorOverrides>

export const [allColorOverrideSignal, setAllColorOverrideSignalValue] = explicitSignal<LayeredElementColorOverrides>(
  new Map(),
)

export const elementColorsPerRenderScopeSignalFamily = signalFamily<string, ElementColorOverrides>(new Map())

export function resetElementColorsPerRenderScopeSignalFamily(key: string) {
  const item = elementColorsPerRenderScopeSignalFamily(key)
  if (item.peek().size > 0) {
    item.value = new Map()
  }
}

export const [elementColorRenderScopeOrderSignal, setElementColorRenderScopeOrderSignalValue] = explicitSignal<
  string[]
>([])

export const activeColorOverrideSignal = computed<ElementColorOverrides>(() => {
  const analysisColorOverrides = allColorOverrideSignal.value

  const renderScopeOrder = elementColorRenderScopeOrderSignal.value

  const overrides = new Map()

  // Add overrides from render scopes in correct order, highest index in list wins
  for (const renderScope of renderScopeOrder) {
    const colorMap = elementColorsPerRenderScopeSignalFamily(renderScope).value
    for (let [path, color] of colorMap) {
      overrides.set(path, color)
    }
  }

  // Add overrides in order of layer index, highest index wins
  const layerIndicesSorted = Array.from(analysisColorOverrides.keys()).sort()
  for (const layerIndex of layerIndicesSorted) {
    const layerOverrides = analysisColorOverrides.get(layerIndex)!
    for (const [path, color] of layerOverrides.entries()) {
      overrides.set(path, color)
    }
  }

  return overrides
})
