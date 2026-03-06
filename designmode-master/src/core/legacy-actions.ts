import type { Child, FormaElement } from "@spacemakerai/element-types"
import type { KnownRepresentations } from "./elements/ElementRepresentations"
import type { InternalPath } from "src/lib/element/path"
import type { ElementContainer } from "./elements/ElementContainer"

type ActionType =
  | {
      type: "create"
      parentPath: InternalPath
      child: Omit<Child, "urn">
      element: FormaElement
      persisted: boolean
      container?: ElementContainer
    }
  | {
      type: "add"
      parentPath: InternalPath
      child: Omit<Child, "urn">
      element: FormaElement
      persisted: boolean
      container?: ElementContainer
    }
  | {
      type: "update"
      path: InternalPath
      child?: Omit<Child, "urn" | "key">
      element: FormaElement
      cloneGeometry?: boolean
      persisted: boolean
      container?: ElementContainer
    }
  | { type: "delete"; path: InternalPath }

export type Action<T extends ActionType["type"] = ActionType["type"]> = { type: T } & ActionType & {
    representations?: KnownRepresentations
  }
