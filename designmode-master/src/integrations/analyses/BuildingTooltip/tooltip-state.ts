import { atom } from "recoil"
import type { InternalPath } from "src/lib/element/path"

export const tooltipState = atom<Map<InternalPath, string>>({
  key: "tooltipState",
  default: new Map(),
})
