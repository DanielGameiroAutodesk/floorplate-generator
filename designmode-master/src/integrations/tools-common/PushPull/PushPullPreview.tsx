import { memo } from "preact/compat"
import { useMemo } from "preact/hooks"
import { Matrix4, Vector3 } from "three"
import { getWallNormal, isValidWalls, pushPullWall } from "./PushPullWalls"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import type { Properties } from "@spacemakerai/element-types"
import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { useVolumeShapePreview } from "src/integrations/volumeShapePreview/useVolumeShapePreview"

const PushPullPreview = ({
  distance,
  feature,
  transform,
  surface,
  height,
  elementProperties,
}: {
  feature: ExtrudedPolygonFeature
  transform: Matrix4
  surface: "roof" | number
  distance?: number
  height?: number
  elementProperties?: Properties
}) => {
  const { height: originalHeight, elevation } = feature.properties
  const normal = useMemo(() => {
    if (surface === "roof") return new Vector3(0, 0, 1)
    return getWallNormal(feature, surface, new Matrix4().extractRotation(transform))
  }, [feature, surface, transform])
  const footPrint = useMemo(() => {
    return ShapeUtils.shapeFromCoordinates(feature.geometry.coordinates, elevation, transform)
  }, [elevation, feature.geometry.coordinates, transform])

  const previewShape = useMemo(() => {
    const newFootPrint = surface === "roof" ? footPrint : pushPullWall(footPrint, surface, normal, distance ?? 0)
    if (!isValidWalls(newFootPrint)) return
    return newFootPrint
  }, [distance, footPrint, normal, surface])

  const isPushBack = surface === "roof" ? originalHeight > (height ?? originalHeight) : (distance ?? 0) < 0
  const previewHeight = height ?? originalHeight

  useVolumeShapePreview(
    "solid",
    { ...elementProperties, height: isPushBack ? previewHeight : originalHeight },
    isPushBack ? previewShape : footPrint,
    false,
  )
  useVolumeShapePreview(
    "faint",
    { ...elementProperties, height: isPushBack ? originalHeight : previewHeight },
    isPushBack ? footPrint : previewShape,
    true,
  )

  return null
}

export default memo(PushPullPreview)
