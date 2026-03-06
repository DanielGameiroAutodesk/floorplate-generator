import type { AtomEffect } from "recoil"
import { atom, atomFamily, selectorFamily } from "recoil"
import get from "lodash/get"
import merge from "lodash/merge"
import unset from "lodash/unset"
import type { InternalPath } from "src/lib/element/path"
import type { AnalysisType } from "./analysis-state"
import { PROJECT_ID } from "src/core/project/project"

export type ElementColorOverrides = Map<InternalPath, Uint8Array>
export type AnalysisColorOverrides = Map<number, ElementColorOverrides>

export const analysisColorOverridesState = atom<AnalysisColorOverrides>({ key: "colorOverride", default: new Map() })

function localStorageEffect<T>(key: string, analysisType: AnalysisType | null): AtomEffect<T> {
  return ({ onSet, setSelf }) => {
    if (analysisType === null) return

    const userInfoString = sessionStorage.getItem("forma-userinfo")
    const { sub } = userInfoString ? JSON.parse(userInfoString) : ""

    const storedItem = localStorage.getItem(key)
    if (storedItem != null) {
      const parsedItem = JSON.parse(storedItem)
      const setting = get(parsedItem, `${sub}.${PROJECT_ID}.${analysisType}`)
      if (setting) setSelf(setting)
    }

    onSet((newValue, _, isReset) => {
      const storedItem = localStorage.getItem(key)
      const item = storedItem ? JSON.parse(storedItem) : {}

      if (isReset) {
        unset(item, `${sub}.${PROJECT_ID}.${analysisType}`)
        localStorage.setItem(key, JSON.stringify(item))
      } else {
        const newItem = merge(item, {
          [sub]: {
            [PROJECT_ID]: {
              [analysisType]: newValue,
            },
          },
        })
        localStorage.setItem(key, JSON.stringify(newItem))
      }
    })
  }
}

export const showAnalysisColorState = atomFamily<boolean, AnalysisType | null>({
  key: "showAnalysisColorState",
  default: true,
  effects: (analysisType) => [localStorageEffect("show-analysis-color-visibility-menu-v2", analysisType)],
})

export const selectedAnalysisColorsOpacityState = atomFamily<number, AnalysisType | null>({
  key: "selectedAnalysisColorOpacityState",
  default: 1.0,
  effects: (analysisType) => [localStorageEffect("analysis-opacity-visibility-menu-v2", analysisType)],
})

export const analysisColorsOpacityState = selectorFamily<number, AnalysisType | null>({
  key: "analysisColorOpacityState",
  get:
    (analysisType) =>
    ({ get }) => {
      const showAnalysisColor = get(showAnalysisColorState(analysisType))
      return showAnalysisColor ? get(selectedAnalysisColorsOpacityState(analysisType)) : 0
    },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})
