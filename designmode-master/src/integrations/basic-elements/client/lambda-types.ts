import type { Child } from "@spacemakerai/element-types"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"

export type PutElement = {
  id: string
  geojson: BasicFeature
  properties: { [key: string]: any } | null
  children?: Child[]
  metadata?: { [key: string]: any }
}
