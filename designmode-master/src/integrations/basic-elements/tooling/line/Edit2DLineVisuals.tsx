import { useHideRenderable } from "src/integrations/basic-elements/tooling/useHideRenderable"
import use2DLineVisual from "src/integrations/tools-common/Drawing/shapeTool/visuals/use2DLineVisual"
import type { InternalPath } from "src/lib/element/path"
import type { Shape } from "src/lib/three/Shape/types"
import type { FormaElement } from "@spacemakerai/element-types"
import type { Feature } from "geojson"

type Props = {
  path: InternalPath
  shape?: Shape
  element: FormaElement
  geojson: Feature
}

export default function Edit2DLineVisuals({ path, shape, element, geojson }: Props) {
  useHideRenderable(path, !!shape)

  // TODO: Rewrite to use a 'renderAPI'
  use2DLineVisual(shape, element.properties, geojson.properties)

  return null
}
