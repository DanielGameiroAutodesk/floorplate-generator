import type { FormaElement } from "@spacemakerai/element-types"
import type { BufferGeometry } from "three"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"

export type TreeElements = { element: FormaElement; feature: BasicFeature; geometry: BufferGeometry }
export type TreeElementVariant = { trunk: TreeElements; crown: TreeElements }
