import type { InternalPath } from "src/lib/element/path"
import type { Child } from "@spacemakerai/element-types"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"
import type { BasicElementProperties } from "src/integrations/basic-elements/BasicElementProperties"

export type BasicActionOptions = {
  overrideBatchId?: string
  key?: string
}

export type BasicAction = BasicCreateAction | BasicUpdateAction

export type BasicCreateAction = {
  type: "basic-create"
  parentPath: InternalPath
  child: Omit<Child, "urn">
  feature: BasicFeature | undefined
  properties: BasicElementProperties
  options?: BasicActionOptions
}

export type BasicUpdateAction = {
  type: "basic-update"
  path: InternalPath
  properties?: Partial<BasicElementProperties> // Will be spread on top of existing properties
  feature?: BasicFeature // If not set, use the previous feature for this element
  options?: BasicActionOptions
  child?: Omit<Child, "urn" | "key">
}
