import { useMemo } from "preact/hooks"
import sceneManager from "src/core/three/sceneManager"
import { useObjectLifecycle } from "src/core/three/useObjectLifecycle"
import { buildRenderablesFromGeojson } from "src/integrations/renderables/buildRenderablesFromGeojson"
import type { GeoJsonProperties } from "geojson"
import RenderGroup from "src/integrations/renderables/RenderGroup"
import { useEffect } from "preact/compat"
import type { Properties } from "@spacemakerai/element-types"
import type { Shape } from "src/lib/three/Shape/types"
import { categoryToDefaultLineWidth, shapeToBasicLine } from "src/lib/three/Shape/shapeUtils"
import { DEFAULT_COLOR_2D, DEFAULT_OPACITY_2D } from "src/lib/three/defaultRenderingProperties"
import { useIsImperial } from "src/lib/unitSettings"

export default function use2DLineVisual(
  shape: Shape | undefined,
  elementProperties?: Properties,
  geojsonProperties?: GeoJsonProperties,
) {
  const rendergroup = useMemo(() => new RenderGroup("2D Line Visuals"), [])
  const isImperial = useIsImperial()

  useEffect(() => {
    if (!shape) return
    const category = elementProperties?.category ?? "generic"
    const previewColor = elementProperties?.color ?? DEFAULT_COLOR_2D
    const previewOpacity = elementProperties?.opacity ?? DEFAULT_OPACITY_2D
    const lineWidth = geojsonProperties?.lineWidth ?? categoryToDefaultLineWidth(isImperial, category)

    const renderables = buildRenderablesFromGeojson(
      shapeToBasicLine(shape, { lineWidth }),
      category,
      undefined,
      previewColor,
      previewOpacity,
      "__editing__",
      undefined,
      isImperial,
      elementProperties,
    )
    rendergroup.update(renderables)
    sceneManager.render(false, true)
  }, [shape, rendergroup, elementProperties, isImperial, geojsonProperties?.lineWidth])

  useObjectLifecycle(rendergroup, true, sceneManager.overlay.scene, true)
}
