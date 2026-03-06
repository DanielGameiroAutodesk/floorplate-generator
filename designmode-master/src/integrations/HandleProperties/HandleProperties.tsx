import { RadialCircleFootprintProperties } from "./RadialCircleFootprintProperties"
import RectangleProperties, { isRectangular } from "./RectangleProperties"
import { useMemo } from "preact/compat"
import { ExtrusionProperties } from "./ExtrusionProperties"
import { LineWidthProperty } from "./LineWidthProperty"
import type { BasicFeaturePathInfo } from "src/core/selection/selected-basic-features"
import { useSelectedPathInfoState } from "src/core/selection/selected-basic-features"
import { basicElementPresets } from "src/integrations/basic-elements/basicElementPresets"
import ChildNameProperty from "./ChildNameProperty"
import RoadProperties from "src/integrations/noise/roads/RoadProperties"
import RailTrafficProperties from "src/integrations/noise/rails/RailProperties"
import { AreaProperty } from "./AreaProperty"
import { LengthProperty } from "./LengthProperty"

import { parseUrn } from "src/lib/element/urn"

const NAME_CHANGEABLE_CATEGORIES = [basicElementPresets.site_limit.category, basicElementPresets.zone.category]

export const HandleProperties = () => {
  const selected: BasicFeaturePathInfo[] = useSelectedPathInfoState()
  const extrusion = useMemo(() => selected.every((e) => (e.geojson?.properties as any)?.height), [selected])
  const linewidth = useMemo(
    () =>
      selected.every((e) => e.geojson?.geometry.type === "LineString" && parseUrn(e.element.urn).system === "basic"),
    [selected],
  )
  const rectangle = useMemo(() => selected.every((e) => isRectangular(e.geojson)), [selected])
  const circle = useMemo(() => selected.every((e) => e.element.properties?.circleDefinition), [selected])
  const name = useMemo(
    () => selected.every((e) => NAME_CHANGEABLE_CATEGORIES.includes(e.element.properties?.category || "")),
    [selected],
  )
  const roads = useMemo(
    () =>
      selected.every((e) => e.element.properties?.category === "road" && parseUrn(e.element.urn).system === "basic"),
    [selected],
  )
  const rails = useMemo(
    () =>
      selected.every((e) => e.element.properties?.category === "rails" && parseUrn(e.element.urn).system === "basic"),
    [selected],
  )
  const isGenericLine = useMemo(
    () =>
      selected.every(
        (e) =>
          e.geojson?.geometry.type === "LineString" &&
          !e.element.properties?.category &&
          parseUrn(e.element.urn).system === "basic",
      ),
    [selected],
  )
  const isTreeLine = useMemo(() => selected.every((s) => s.element.properties?.category === "tree_line"), [selected])

  if (selected.length === 0) return null

  if (isTreeLine) {
    return (
      <>
        <LengthProperty />
      </>
    )
  }

  if (isGenericLine) {
    return (
      <>
        <LengthProperty />
        <LineWidthProperty selected={selected} />
      </>
    )
  }

  return (
    <>
      {name && <ChildNameProperty selected={selected} />}
      {circle && <RadialCircleFootprintProperties selected={selected} />}
      {rectangle && <RectangleProperties selected={selected} />}
      {extrusion && <ExtrusionProperties selected={selected} />}
      {linewidth && <LineWidthProperty selected={selected} />}
      {roads && <RoadProperties />}
      {rails && <RailTrafficProperties />}
      <AreaProperty />
    </>
  )
}
