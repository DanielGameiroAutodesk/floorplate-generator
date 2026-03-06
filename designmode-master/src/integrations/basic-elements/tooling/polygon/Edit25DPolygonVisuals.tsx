import { useHideRenderable } from "src/integrations/basic-elements/tooling/useHideRenderable"
import { useVolumeShapePreview } from "src/integrations/volumeShapePreview/useVolumeShapePreview"
import type { Shape } from "src/lib/three/Shape/types"
import type { InternalPath } from "src/lib/element/path"
import type { FormaElement } from "@spacemakerai/element-types"

type Props = {
  path: InternalPath
  element: FormaElement
  shape?: Shape
  height?: number
}

export default function Edit25DPolygonVisuals({ path, shape, element, height }: Props) {
  useHideRenderable(path, !!shape)

  // TODO: rewrite the stuff below to use APIs
  useVolumeShapePreview("edit25DPolygonVisuals", { ...element?.properties, height }, shape, false)
  return null
}
