import { memo } from "preact/compat"
import { PolygonWithHoles } from "./simpleSvgComponents.jsx"

const FloorPlanContainerStyle = `
  display: flex;
  background: transparent;
`

const UnitTypeColor = {
  CORE: "#888888",
  CORRIDOR: "#666666",
  GENERIC: "red",
  EXCLUDED_AREA: "blue",
}

const _FloorIcon = ({
  floorPlan,
  centerPoint,
  scale,
  viewBoxWidth,
  viewBoxHeight,
  strokeColor = "gray",
  strokeWidth = 0.5,
}) => {
  return (
    <div style={FloorPlanContainerStyle}>
      <svg
        width={viewBoxWidth}
        height={viewBoxHeight}
        viewBox={`-${viewBoxWidth / 2} -${viewBoxHeight / 2} ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {floorPlan.units.map((unit) => {
          const fillColor = UnitTypeColor[unit.type] || "white"
          return (
            <PolygonWithHoles
              key={unit.id}
              spacePolygon={unit.polygon}
              spaceHoles={unit.holes}
              id={unit.id}
              centerPosition={centerPoint}
              scale={scale}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
            />
          )
        })}
      </svg>
    </div>
  )
}

export const FloorIcon = memo(_FloorIcon)
