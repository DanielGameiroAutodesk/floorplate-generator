import { computed } from "@preact/signals"
import { explicitSignal, signalFamily } from "src/lib/signal"

interface ColorbarAPI {
  add: ({
    colors,
    unit,
    labelPosition,
    labels,
    isInteractive,
  }: {
    colors: string[]
    unit?: string | undefined
    labelPosition?: LabelPosition | undefined
    labels?: string[] | undefined
    isInteractive: boolean
  }) => void
  remove: () => void
  getRenderScope: () => string
  onRangeFilterChange: (callback: (rangeFilter: { lowerIndex: number; upperIndex: number }) => void) => () => void
}

const [colorbarRenderScopesAddedOrderSignal, setColorbarRenderScopesAddedOrderSignalValue] = explicitSignal<string[]>(
  [],
)

export const activeColorbarRenderScopeSignal = computed<string>(() => {
  const colorbarRenderScopesOrdered = colorbarRenderScopesAddedOrderSignal.value
  return colorbarRenderScopesOrdered[0] || ""
})

export const colorbarDefinitionSignalFamily = signalFamily<string, ColorbarDefinition | undefined>(undefined)

export type ColorbarDefinition = {
  colors: string[]
  isInteractive: boolean
  rangeFilter: { lowerIndex: number; upperIndex: number }
  unit?: string | undefined
  labelPosition?: LabelPosition | undefined
  labels?: string[] | undefined
}

export type LabelPosition = "center" | "edge"

export function createColorbarApi(renderScope: string): [ColorbarAPI, cleanup: () => void] {
  const colorbarDefinitionSignal = colorbarDefinitionSignalFamily(renderScope)
  const api: ColorbarAPI = {
    add: ({
      colors,
      isInteractive,
      unit,
      labelPosition,
      labels,
    }: {
      colors: string[]
      isInteractive: boolean
      unit?: string | undefined
      labelPosition?: LabelPosition | undefined
      labels?: string[] | undefined
    }) => {
      colorbarDefinitionSignal.value = {
        colors,
        isInteractive,
        unit,
        labelPosition,
        labels,
        rangeFilter: { lowerIndex: 0, upperIndex: colors.length },
      }
      setColorbarRenderScopesAddedOrderSignalValue((current) => [renderScope, ...current])
    },
    remove: () => {
      setColorbarRenderScopesAddedOrderSignalValue((current) => current.filter((scope) => scope !== renderScope))
      colorbarDefinitionSignal.value = undefined
    },
    getRenderScope: () => renderScope,
    onRangeFilterChange: (callback: (rangeFilter: { lowerIndex: number; upperIndex: number }) => void) => {
      return colorbarDefinitionSignal.subscribe((definition) => {
        if (definition) {
          callback(definition.rangeFilter)
        }
      })
    },
  }

  return [api, api.remove]
}
