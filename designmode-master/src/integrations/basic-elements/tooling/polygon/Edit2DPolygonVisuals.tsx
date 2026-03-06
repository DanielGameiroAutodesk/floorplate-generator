import { useHideRenderable } from "src/integrations/basic-elements/tooling/useHideRenderable"
import use2DPolygonVisual from "src/integrations/tools-common/Drawing/shapeTool/visuals/use2DPolygonVisual"
import type { InternalPath } from "src/lib/element/path"
import type { Shape } from "src/lib/three/Shape/types"
import type { FormaElement } from "@spacemakerai/element-types"

type Props = {
  path: InternalPath
  element: FormaElement
  shape?: Shape
}

export default function Edit2DPolygonVisuals({ path, shape, element }: Props) {
  useHideRenderable(path, !!shape)
  // TODO: Rewrite to use2DPolygonVisual to use a 'renderAPI'
  use2DPolygonVisual(shape, element.properties)

  return null
}
