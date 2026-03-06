export const TreeLineConfigProperty = "treeLineGenerator"

export type TreeLineConfig = {
  spacing: number
  offset: number
  height: number
  alignment: "top" | "bottom" | "center"
  placeOnRoof?: boolean
}
