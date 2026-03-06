import type { Properties } from "@spacemakerai/element-types"
import type { Shape } from "src/lib/three/Shape/types"
import { useEffect, useMemo } from "react"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { Geometry25D } from "src/lib/three/Geometry25D"
import type { BufferGeometry } from "three"
import { Color, Matrix4 } from "three"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { calculateEdgesGeometry, edgesPositionFromBox3, setGeometryColor } from "src/lib/three/geometryUtils"
import { getRenderingSpecForElement } from "src/integrations/renderables/renderable"
import { DEFAULT_COLOR_3D } from "src/lib/three/defaultRenderingProperties"

export const useVolumeShapePreview = (id: string, props: Properties, shape?: Shape, forceFaint = false) => {
  const geom = useMemo(() => {
    if (!shape || shape.vertices.length < 3) return

    const coordinates = ShapeUtils.coordinatesFromShape(shape)
    const height = props.height || 0.0001 //Actual 0 height makes the preview look weird
    const box = {
      coordinates,
      height,
      elevation: shape.vertices.reduce((lowest, cur) => Math.min(cur.z, lowest), Number.MAX_SAFE_INTEGER),
    }
    return new Geometry25D(box)
  }, [shape, props])
  useVolumeGeometryPreview(id, props, geom, forceFaint)
}
const useVolumeGeometryPreview = (
  id: string,
  props: Properties = {},
  geometry?: BufferGeometry,
  renderFaint = false,
  occludeSnapping = false,
) => {
  const renderApi = useRenderAPI(id, occludeSnapping)

  useEffect(() => {
    if (!geometry) return
    const name = id
    const spec = getRenderingSpecForElement(geometry, { properties: props })
    setGeometryColor(new Color(props.color ?? DEFAULT_COLOR_3D), geometry)
    const chosenMode = renderFaint ? "faint" : "normal"
    renderApi.upsert({
      id: name,
      transform: new Matrix4().toArray(),
      mode: chosenMode,
      spec,
      geometryData: {
        position: new Float32Array(geometry.getAttribute("position").array),
        color: new Uint8Array(geometry.getAttribute("color").array),
        normal: new Float32Array(geometry.getAttribute("normal").array),
      },
    })

    let outlines = calculateEdgesGeometry(geometry)
    if (!outlines) {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      outlines = edgesPositionFromBox3(geometry.boundingBox)
    }

    renderApi.upsert({
      id: name + "-outline",
      transform: new Matrix4().toArray(),
      mode: chosenMode,
      spec: props.category === "constraints" ? "constraintOutline" : "basicLines",
      geometryData: {
        position: outlines,
      },
    })
  }, [props, geometry, renderFaint, renderApi, id])

  // }, [props, geometry, renderFaint, volumePreview])
}
