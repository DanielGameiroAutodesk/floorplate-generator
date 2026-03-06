import { memo } from "preact/compat"
import { useMemo } from "preact/hooks"
import { Matrix4, Vector3 } from "three"
import { ShapeUtils } from "src/lib/three/Shape/shapeUtils"
import { getSideNormal, isValidSides, pushPullSide } from "./PushPullSides"
import type { SectionBox } from "src/integrations/section-box/tooling/sectionBox"

const PushPullPreview = ({
  distance,
  sectionBox,
  surface,
  height,
  previewSectionBox,
}: {
  sectionBox: SectionBox
  surface: "roof" | number
  distance?: number
  height?: number
  previewSectionBox: (shape: SectionBox) => void
}) => {
  const { height: originalHeight, elevation } = sectionBox.properties
  const normal = useMemo(() => {
    if (surface === "roof") return new Vector3(0, 0, 1)
    return getSideNormal(sectionBox, surface, new Matrix4())
  }, [sectionBox, surface])
  const footPrint = useMemo(() => {
    return ShapeUtils.shapeFromCoordinates(sectionBox.geometry.coordinates, elevation)
  }, [elevation, sectionBox.geometry.coordinates])

  const previewShape = useMemo(() => {
    const newFootPrint = surface === "roof" ? footPrint : pushPullSide(footPrint, surface, normal, distance ?? 0)
    if (!isValidSides(newFootPrint)) return
    return newFootPrint
  }, [distance, footPrint, normal, surface])

  const previewHeight = height ?? originalHeight

  if (!previewShape) return null

  const polygon: SectionBox = {
    ...sectionBox,
    geometry: {
      type: "Polygon",
      coordinates: ShapeUtils.coordinatesFromShape(previewShape),
    },
    properties: {
      ...sectionBox.properties,
      height: previewHeight,
    },
  }
  previewSectionBox(polygon)

  return null
}

export default memo(PushPullPreview)
