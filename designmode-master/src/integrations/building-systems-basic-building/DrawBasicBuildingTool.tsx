import { drawApi } from "src/integrations/draw/DrawAPI"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { useRenderAPI } from "src/integrations/render-api/RenderAPI"
import { useCallback } from "react"
import { useEffect, useErrorBoundary, useMemo } from "preact/hooks"
import type { Shape } from "src/lib/three/Shape/types"
import BasicBuildingAPI from "./BasicBuildingAPI"
import { toMetersIfImperial } from "src/lib/measurementSystem"
import { captureException } from "@sentry/browser"
import { contextRootSignal } from "src/core/selection/selectionState"
import { exitCurrentTool } from "src/core/toolsState"
import { getTranslator } from "src/i18n"

import { useIsImperial } from "src/lib/unitSettings"

const useDefaultStoryHeight = () => {
  const imperialUnits = useIsImperial()
  return imperialUnits ? toMetersIfImperial(10, imperialUnits) : 3
}

const Preview = ({ shape, height }: { shape?: Shape; height?: number }) => {
  const PolygonPreview = useMemo(() => drawApi.simpleVolume25DElementRenderer({ color: "#ffffff" }), [])

  const renderAPI = useRenderAPI("basic-preview")
  const storyHeight = useDefaultStoryHeight()
  const footprintPreview = !shape || height === undefined || isNaN(height) || height === Infinity

  useMemo(() => {
    if (footprintPreview) return
    const { basicBuilding, transform } = BasicBuildingAPI.createBasicBuildingFromShape(
      shape.vertices,
      height,
      storyHeight,
    )
    for (const object of BasicBuildingAPI.makePreviewObjects(basicBuilding, transform)) {
      renderAPI.upsert(object)
    }
  }, [footprintPreview, shape, height, storyHeight, renderAPI])

  if (!shape) return null
  if (footprintPreview) return <PolygonPreview shape={shape} />
  return null
}

function DrawBasicBuildingToolInner() {
  const actionAPI = useActionAPI()

  const storyHeight = useDefaultStoryHeight()

  const onComplete = useCallback(
    (volume?: { shape: Shape; height: number }) => {
      if (!volume) {
        exitCurrentTool()
        return
      }
      const { shape, height } = volume
      BasicBuildingAPI.actions.createFromShape(shape, height, storyHeight, contextRootSignal.peek(), actionAPI)
      exitCurrentTool()
    },
    [actionAPI, storyHeight],
  )

  useEffect(() => {
    drawApi.get25DVolume(onComplete, Preview, undefined, storyHeight)
  }, [onComplete, storyHeight])

  return null
}

export default function DrawBasicBuildingTool() {
  useErrorBoundary((error, errorInfo) => {
    console.error("DrawBasicBuildingTool error: ", error)
    console.warn(errorInfo)
    captureException(error, { tags: { owner: "building-systems" } })
    const t = getTranslator()
    window.forma_toasts.push({ content: t(($) => $.errors.building.failedToDraw), status: "warning" })
    exitCurrentTool()
  })

  return <DrawBasicBuildingToolInner />
}
