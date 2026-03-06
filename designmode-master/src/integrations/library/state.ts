import { atom } from "recoil"
import type { LibraryItem } from "./api"

export const libraryItemsState = atom<LibraryItem[]>({
  key: "libraryItems",
  default: [],
})
