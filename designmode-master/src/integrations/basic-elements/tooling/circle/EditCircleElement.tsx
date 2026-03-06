import { useCallback } from "preact/hooks"
import { useMemo } from "preact/compat"
import { Vector3 } from "three"
import { circleFrom2Points } from "src/lib/three/Shape/shapeFunctions"
import type { InternalPath } from "src/lib/element/path"
import { useActionAPI } from "src/integrations/legacy-actions/ActionAPI"
import { shapeToPolygonFeature } from "src/lib/three/Shape/shapeUtils"
import type { Segment } from "src/lib/geometry/geometryTypes"
import type { FormaElement } from "@spacemakerai/element-types"
import type { Feature } from "geojson"
import { useState } from "react"
import { AnalyticsUtils } from "src/core/analytics"
import { LineSegmentTool } from "src/integrations/tools-common/Drawing/basicShape/LineSegmentTool"
import Edit2DCircleVisuals from "./Edit2DCircleVisuals"
import Edit25DCircleVisuals from "./Edit25DCircleVisuals"
import { BasicElementAPI } from "src/integrations/basic-elements/api/BasicElementAPI"
import { ShapeToolMoveMode } from "src/integrations/tools-common/Drawing/shapeTool/ShapeToolConfig"
import { isDefined } from "src/lib/array"
import { elementState } from "src/core/elements/ElementState"
import { exitCurrentTool } from "src/core/toolsState"
import { terrainSignal } from "src/core/terrain/new-terrain-state"

type Props = {
  path: InternalPath
  element: FormaElement
  geojson: Feature
  dimension: "2D" | "2.5D"
}

export default function EditBasicCircleElement({ path, element, geojson, dimension }: Props) {
  const node = elementState.currentSnapshot.value.getNodeOrThrow(path)
  const { elevationAt } = terrainSignal.value
  const ActionAPI = useActionAPI()

  const worldMatrix = node.globalMatrix

  const initialSegment = useMemo(() => {
    const circleDefinition: Segment = element.properties?.circleDefinition
    if (!circleDefinition) return undefined
    return circleDefinition.map(([x, y, z]) => {
      const elevation = geojson.properties?.elevation
      const point = new Vector3(x, y, elevation || z).applyMatrix4(worldMatrix)
      if (!isDefined(elevation)) {
        point.setZ(elevationAt(point.x, point.y))
      }
      return point.toArray()
    }) as Segment
  }, [element.properties?.circleDefinition, geojson.properties?.elevation, worldMatrix, elevationAt])
  const [segment, setSegment] = useState(initialSegment)

  const onComplete = useCallback(
    ([center, radial]: Segment) => {
      const centerVec3 = new Vector3(...center)
      const radialVec3 = new Vector3(...radial)
      if (centerVec3.distanceTo(radialVec3) < 0.01) {
        console.warn("Discarding edit, segment was less than 0.01m long.")
        exitCurrentTool()
        return
      }

      // Convert values from tool (world) space to element space
      const adjust = worldMatrix.clone().invert()
      const localCenter = new Vector3().fromArray(center).applyMatrix4(adjust).toArray()
      const localRadial = new Vector3().fromArray(radial).applyMatrix4(adjust).toArray()
      const localCircleDefinition = [localCenter, localRadial]

      const circleShape = circleFrom2Points(localCenter, localRadial)
      const feature = shapeToPolygonFeature(circleShape)
      feature.properties = { ...geojson.properties, ...feature.properties }

      const actions = BasicElementAPI.basicActionsToCoreActions([
        BasicElementAPI.update(path, { circleDefinition: localCircleDefinition }, feature),
      ])

      ActionAPI.apply(`Element - Edit Circle ${dimension}`, actions, {
        numElements: 1,
        eventType: "update",
        elementCategory: element.properties?.category ?? "",
        tool: `editCircle${dimension}`,
        inScenario: AnalyticsUtils.trackedInScenarioFlag([node.isInBase]),
      })

      exitCurrentTool()
    },
    [worldMatrix, geojson.properties, path, ActionAPI, dimension, element.properties?.category, node],
  )

  return (
    <>
      {dimension === "2D" && (
        <Edit2DCircleVisuals segment={segment} element={element} path={path} elevationAt={elevationAt} />
      )}
      {dimension === "2.5D" && (
        <Edit25DCircleVisuals segment={segment} element={element} path={path} height={geojson.properties?.height} />
      )}
      <LineSegmentTool
        onCancel={exitCurrentTool}
        onComplete={onComplete}
        initialDefinition={initialSegment}
        previewRenderers={({ lineSegment }) => {
          setSegment(lineSegment)
          return null
        }}
        moveMode={dimension === "2D" ? ShapeToolMoveMode.TERRAIN : ShapeToolMoveMode.HORIZONTAL}
      />
    </>
  )
}
