import { BufferWidthInput } from "./BufferWidth"
import { Radius } from "./DefaultRadius"
import { signal } from "@preact/signals"
import type { TransportType } from "src/integrations/transportation/lib/transportationApi"
import { Analytics } from "src/core/analytics"
import { useEffect } from "preact/hooks"
import { EventName, FeatureCategory } from "@spacemakerai/webapp-analytics"

export const RADIUS_PRESETS = [
  {
    factor: 100,
    label: "Smooth",
  },
  {
    factor: 0.5,
    label: "Tight",
  },
]

export const DEFAULT_BUFFER_WIDTH_ROAD = 6
export const DEFAULT_BUFFER_WIDTH_RAIL = 4
export const SMOOTH_RADIUS = RADIUS_PRESETS[0].factor * DEFAULT_BUFFER_WIDTH_ROAD

const bufferWidthRoadSignal = signal<number>(DEFAULT_BUFFER_WIDTH_ROAD)
const bufferWidthRailSignal = signal<number>(DEFAULT_BUFFER_WIDTH_RAIL)
export const bufferWidthSignal = signal<number>(DEFAULT_BUFFER_WIDTH_ROAD)
export const defaultRadiusSignal = signal<number>(SMOOTH_RADIUS)
export const drawModeSignal = signal<"freeform" | "pick">("freeform")

export const DrawingProperties = ({ type }: { type: TransportType }) => {
  const currentBufferWidthSignal = type === "road" ? bufferWidthRoadSignal : bufferWidthRailSignal
  const width = currentBufferWidthSignal.value
  useEffect(() => {
    bufferWidthSignal.value = width
  }, [width])

  if (drawModeSignal.value !== "freeform") return null

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ marginTop: "10px", height: "35px" }} data-intercom-target="curved-road-pop-up">
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>{type === "road" ? "Road" : "Rails"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <BufferWidthInput
          width={currentBufferWidthSignal.value}
          onChange={(newVal) => (currentBufferWidthSignal.value = newVal)}
        />
        <Radius
          width={currentBufferWidthSignal.value}
          radius={defaultRadiusSignal.value}
          onChange={(radius) => {
            defaultRadiusSignal.value = radius
            const curveStyle = radius === SMOOTH_RADIUS ? "smooth" : "tight"
            Analytics.track(
              EventName.Select,
              {
                feature_category: FeatureCategory.DesignTool,
                feature: "transportation",
                sub_feature: "curve_style",
              },
              { curve_style: curveStyle },
            )
          }}
        />
      </div>
    </div>
  )
}
