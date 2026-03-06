import { atom, DefaultValue, selector } from "recoil"
import { sessionStorageEffect } from "src/lib/storageEffect"

export const SIDEBAR_DEFAULT_STATE = { right: false, left: false }

const sidebarsCollapsedRootState = atom<{ left: boolean; right: boolean } | undefined>({
  key: "sidebarsCollapsed",
  default: undefined,
  effects: [sessionStorageEffect("sidebar-collapsed/v2")],
})

export const tempSidebarsCollapsed = atom<Partial<{ left: boolean; right: boolean }> | undefined>({
  key: "temp-sidebars-collapsed",
  default: undefined,
})

export const sidebarsCollapsedState = selector<{ left: boolean; right: boolean }>({
  key: "sidebarsCollapsedSelector",
  get: ({ get }) => {
    const root = get(sidebarsCollapsedRootState)
    const temp = get(tempSidebarsCollapsed)

    return {
      left: temp?.left ?? root?.left ?? SIDEBAR_DEFAULT_STATE.left,
      right: temp?.right ?? root?.right ?? SIDEBAR_DEFAULT_STATE.right,
    }
  },
  set: ({ reset, set }, newValue) => {
    reset(tempSidebarsCollapsed)
    if (newValue instanceof DefaultValue) {
      reset(sidebarsCollapsedRootState)
    } else {
      set(sidebarsCollapsedRootState, newValue)
    }
  },
  cachePolicy_UNSTABLE: { eviction: "most-recent" },
})
