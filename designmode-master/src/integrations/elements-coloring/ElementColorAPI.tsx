import { useCallback, useEffect, useMemo } from "preact/hooks"
import memoize from "lodash/memoize"
import type { InternalPath } from "src/lib/element/path"
import {
  allColorOverrideSignal,
  elementColorRenderScopeOrderSignal,
  elementColorsPerRenderScopeSignalFamily,
  resetElementColorsPerRenderScopeSignalFamily,
  setAllColorOverrideSignalValue,
  setElementColorRenderScopeOrderSignalValue,
} from "./state.internal"
import { Color } from "three"

export const LAYER_BASE = 0
export const LAYER_AREA_SELECTION = 10

/**
 * API for setting custom color overrides for all elements in the scene.
 */
export interface ElementColorAPI {
  /**
   * Set the color overrides for the given paths.
   *
   * The color is given as a hex #RRGGBB sRGB string.
   *
   * @param colors the colors to override
   */
  setColors(this: void, colors: Map<InternalPath, string>): void

  /**
   * Clear the color overrides for the given paths.
   *
   * @param paths the paths to clear
   */
  clearColors(this: void, paths: InternalPath[]): void

  /**
   * Clear all color overrides.
   *
   * This is called automatically when the API is unmounted.
   */
  clearAll(this: void): void
}

/**
 * Create an API for setting custom color overrides for all elements in the scene.
 *
 * The API is scoped to a specific layer. The default layer is LAYER_BASE.
 * A layer is the way to let multiple components set color overrides without
 * interfering with each other. For example, the area selection tool uses
 * LAYER_AREA_SELECTION to set color overrides for the selected area.
 *
 * The layer with the highest index is rendered on top of the other layers.
 *
 * @param layerIndex the layer index to use
 * @returns
 */
export function useElementColorAPI(layerIndex: number = LAYER_BASE): ElementColorAPI {
  const clearAll = useCallback(() => {
    const newOverrides = new Map(allColorOverrideSignal.peek())
    newOverrides.delete(layerIndex)
    setAllColorOverrideSignalValue(newOverrides)
  }, [layerIndex])

  const setColors = useCallback(
    (colors: Map<InternalPath, string>) => {
      if (!colors) {
        return
      }

      const newOverrides = new Map(allColorOverrideSignal.peek())

      const layerOverrides = newOverrides.get(layerIndex) || new Map<InternalPath, Uint8Array>()

      for (let [path, color] of colors) {
        layerOverrides.set(path, hexStringToUint8(color))
      }

      newOverrides.set(layerIndex, layerOverrides)
      setAllColorOverrideSignalValue(newOverrides)
    },
    [layerIndex],
  )

  const clearColors = useCallback(
    (paths: InternalPath[]) => {
      const newOverrides = new Map(allColorOverrideSignal.peek())

      const layerOverrides = newOverrides.get(layerIndex) || new Map<InternalPath, Uint8Array>()

      for (let path of paths) {
        layerOverrides.delete(path)
      }

      newOverrides.set(layerIndex, layerOverrides)

      setAllColorOverrideSignalValue(newOverrides)
    },
    [layerIndex],
  )

  const api = useMemo(() => {
    return { setColors, clearColors, clearAll }
  }, [setColors, clearColors, clearAll])

  useEffect(() => {
    return () => api.clearAll()
  }, [api])

  return api
}

/**
 * Create an API for setting custom color overrides for all elements in the scene.
 *
 * The API is connected to a render scope.
 *
 * When coloring elements, the colors are rendered in the order the render scope was added
 * TODO: determine if this prioritization of colors is best
 *
 * @param renderScope the render scope to use
 */
export function createElementColorV2Api(renderScope: string): [ElementColorAPI, cleanup: () => void] {
  function clearAll() {
    resetElementColorsPerRenderScopeSignalFamily(renderScope)
    const renderScopeOrder = elementColorRenderScopeOrderSignal.peek()
    setElementColorRenderScopeOrderSignalValue(renderScopeOrder.filter((rs) => rs !== renderScope))
  }

  function setColors(colors: Map<InternalPath, string>) {
    if (!colors) {
      return
    }
    const elementColorsMap = new Map(elementColorsPerRenderScopeSignalFamily(renderScope).peek())
    for (let [path, color] of colors) {
      elementColorsMap.set(path, hexStringToUint8(color))
    }
    elementColorsPerRenderScopeSignalFamily(renderScope).value = elementColorsMap
    const oldOrder = elementColorRenderScopeOrderSignal.peek()
    setElementColorRenderScopeOrderSignalValue([...oldOrder.filter((rs) => rs !== renderScope), renderScope])
  }

  function clearColors(paths: InternalPath[]) {
    const elementColorsMap = new Map(elementColorsPerRenderScopeSignalFamily(renderScope).peek())
    for (let path of paths) {
      elementColorsMap.delete(path)
    }
    elementColorsPerRenderScopeSignalFamily(renderScope).value = elementColorsMap
  }

  const api: ElementColorAPI = { setColors, clearColors, clearAll }
  return [api, clearAll]
}

const hexStringToUint8 = memoize((hex: string) => {
  const hexHasAlpha = hex.length === 9
  const colorArray = Uint8Array.from(new Color(hex.slice(0, 7)), (v) => v * 255)
  return hexHasAlpha ? new Uint8Array([...colorArray, hexTo255(hex.slice(7, 9))]) : colorArray
})

function hexTo255(hex: string) {
  const decimalValue = parseInt(hex, 16)
  const scaledValue = (decimalValue / 0xff) * 255
  return Math.round(Math.min(Math.max(scaledValue, 0), 255))
}
