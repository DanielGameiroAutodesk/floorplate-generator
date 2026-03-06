import { atom } from "recoil"

export type RowhouseToolState = "line" | "placeSingleRowHouse"

export const rowhouseToolState = atom<RowhouseToolState>({
  key: "rowhouseToolState",
  default: "line",
})
