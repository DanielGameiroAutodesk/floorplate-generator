import { selectedNodesSignal } from "src/core/selection/selectionState"
import transportationApi from "src/integrations/transportation/lib/transportationApi"
import { BufferWidthEdit } from "./BufferWidth"
import RoadTrafficProperties from "./RoadTrafficProperties"
import RailTrafficProperties from "./RailTrafficProperties"
import { useMemo } from "preact/hooks"

export const EditProperties = () => {
  const selected = selectedNodesSignal.value
  const isOnlyTransportCurvesSelected =
    selected.every((e) => transportationApi.isTransportationElement(e.element)) && selected.length > 0
  const selectedTransportCurves = selected.filter((e) => transportationApi.isTransportationElement(e.element))
  const categoriesSet = useMemo(() => {
    const categories = selectedTransportCurves.map((e) => e.element.properties?.category)
    return new Set(categories.filter((c) => c) as string[])
  }, [selectedTransportCurves])

  if (!isOnlyTransportCurvesSelected) return null
  const category = categoriesSet.size === 1 ? categoriesSet.values().next().value : null

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ marginTop: "10px", height: "35px" }} data-intercom-target="curved-road-pop-up">
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>{category === "road" ? "Road" : "Rails"}</span>
      </div>
      <BufferWidthEdit selected={selectedTransportCurves} />
      {category === "road" && <RoadTrafficProperties selectedRoadNodes={selectedTransportCurves} />}
      {category === "rails" && <RailTrafficProperties selectedRailNodes={selectedTransportCurves} />}
    </div>
  )
}
