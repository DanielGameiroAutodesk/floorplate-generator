import { categoryToDefaultLineWidth } from "src/lib/three/Shape/shapeUtils"
import type { FormaElement } from "@spacemakerai/element-types"
import type { BasicFeature } from "src/lib/geometry/geometryTypes"

export function currentLineWidth(selected: { element: FormaElement; geojson: BasicFeature }[], isImperial: boolean) {
  const lineWidths = selected.map((info) => {
    const category = info.element.properties?.category
    const defaultWidth = categoryToDefaultLineWidth(isImperial, category)
    return (info.geojson.properties as any)?.lineWidth ?? defaultWidth
  })

  const uniqueLineWidths = new Set(lineWidths)
  if (uniqueLineWidths.size === 1) {
    return lineWidths[0]
  }
}
