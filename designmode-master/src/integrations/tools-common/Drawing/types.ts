import type { GroundPolygonMode } from "./basicShape/DrawGroundPolygon"
import type { InternalPath } from "src/lib/element/path"

export type ShapeCreationMetaData =
  | {
      method: Exclude<GroundPolygonMode, "pick">
    }
  | {
      method: "pick"
      pickedElement: InternalPath
    }
