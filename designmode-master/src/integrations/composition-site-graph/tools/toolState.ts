import { atom } from "recoil"

export type GraphToolState = "edge" | "selection" | "place-parcel"
export const graphToolState = atom<GraphToolState>({ key: "graph-tool-state", default: "selection" })
