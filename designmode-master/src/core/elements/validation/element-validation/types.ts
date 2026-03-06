import type { InternalPath } from "src/lib/element/path"
import type { Urn } from "@spacemakerai/element-types"

export type MissingElementError = {
  type: "MISSING_ELEMENT"
  path: InternalPath
  urn: Urn
}
export type DuplicatePathError = {
  type: "DUPLICATE_KEY_AT_SAME_LEVEL"
  path: InternalPath
}
export type MissingBase = {
  type: "MISSING_BASE"
  reason: "NO_FLAG" | "NO_BASE_ELEMENT"
}
export type ElementsValidationError = MissingElementError | DuplicatePathError | MissingBase
