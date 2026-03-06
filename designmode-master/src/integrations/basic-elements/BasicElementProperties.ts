import type { Properties } from "@spacemakerai/element-types"
import type { TreeAreaConfig } from "./trees/area/TreeAreaGenerator"
import type { TreeLineConfig } from "./trees/lines/TreeLinesGenerator"

export type BasicElementProperties = Properties & {
  color: string
  name?: string
  opacity?: number
  connected?: boolean
  treePlacerGenerator?: TreeAreaConfig & { id: string }
  treeLineGenerator?: TreeLineConfig & { id: string }
  stroke?: {
    color: string
    dashed: boolean
  }
}
