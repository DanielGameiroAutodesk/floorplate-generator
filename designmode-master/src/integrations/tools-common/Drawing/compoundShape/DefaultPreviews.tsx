import type { Properties } from "@spacemakerai/element-types"
import type { Volume25DPreviewComponent } from "./DrawBox25D"
import { useState } from "react"
import { useEffect } from "preact/hooks"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { Shape } from "src/lib/three/Shape/types"
import { useVolumeShapePreview } from "src/integrations/volumeShapePreview/useVolumeShapePreview"

export const simpleVolume25DElementRenderer = (props: Properties): Volume25DPreviewComponent => {
  const DefaultPreview = ({
    shape,
    height,
    additionalProperties,
  }: {
    shape?: Shape
    height?: number
    additionalProperties?: Properties
  }) => {
    return <Volume25DPreview footprint={shape} props={{ ...props, ...additionalProperties }} height={height} />
  }
  return DefaultPreview
}
const Volume25DPreview = ({ footprint, height, props }: { footprint?: Shape; height?: number; props?: Properties }) => {
  const [_footPrint, setFootPrint] = useState<Shape>()
  const [_height, setHeight] = useState<number | undefined>()

  useEffect(() => {
    setHeight(height)
  }, [height])

  useEffect(() => {
    footprint && setFootPrint(ShapeUtils.closeEdgesOnShape(footprint))
  }, [footprint])

  useVolumeShapePreview("defaultPreview", { ...props, height: _height }, _footPrint)

  return null
}
