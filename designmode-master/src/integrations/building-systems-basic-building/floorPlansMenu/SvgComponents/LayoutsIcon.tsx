import type { SpaceUnits } from "src/integrations/building-systems-basic-building/floorPlansMenu/floorPlans/matchingFloorPlansInBuildings"
import { getBoundingBoxOfPolygons } from "src/integrations/building-systems-common/geoHelpers"
import { useMemo } from "preact/compat"
import { PolygonWithHolesSVG } from "./SvgPolygon"
import { UNIT_PROGRAM_COLORS } from "src/lib/visualizationSettings"
import type { PointXY } from "src/lib/geometry/polygonXY"

const FloorPlanContainerStyle = `
  display: flex;
  background: transparent;
`

const spaceToViewBoxCoordinate = (spacePosition: PointXY, centerPosition: PointXY, scale: number) => {
  const x = (spacePosition.x - centerPosition.x) * scale
  const y = -(spacePosition.y - centerPosition.y) * scale

  return { x, y }
}

const FloorIcon = ({
  spaceUnits,
  centerPoint,
  scale,
  viewBoxWidth,
  viewBoxHeight,
  strokeColor = "gray",
  strokeWidth = 0.5,
}: {
  spaceUnits: SpaceUnits
  centerPoint: PointXY
  scale: number
  viewBoxWidth: number
  viewBoxHeight: number
  strokeColor: string
  strokeWidth: number
}) => {
  const mappedFloor = useMemo(() => {
    return spaceUnits.map((spaceUnit) => {
      const polygon = spaceUnit.polygon.map((point) => spaceToViewBoxCoordinate(point, centerPoint, scale))
      const holes = spaceUnit.holes.map((hole) =>
        hole.map((point) => spaceToViewBoxCoordinate(point, centerPoint, scale)),
      )
      return { ...spaceUnit, polygon, holes }
    })
  }, [centerPoint, spaceUnits, scale])
  return (
    <div style={FloorPlanContainerStyle}>
      <svg
        width={viewBoxWidth}
        height={viewBoxHeight}
        viewBox={`-${viewBoxWidth / 2} -${viewBoxHeight / 2} ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {mappedFloor.map((spaceUnit, index) => {
          if (spaceUnit.id === "") {
            console.error("Space unit id is empty")
          }
          const fillColor =
            spaceUnit.program !== undefined ? UNIT_PROGRAM_COLORS[spaceUnit.program] || "white" : "white"
          return (
            <PolygonWithHolesSVG
              key={spaceUnit.id === "" ? index : spaceUnit.id}
              polygon={spaceUnit.polygon}
              holes={spaceUnit.holes}
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

function getCenterPointAndScale(spaceUnits: SpaceUnits, viewBoxWidth: number, viewBoxHeight: number, padding: number) {
  const allPolygons = spaceUnits.map((spaceUnit) => {
    return spaceUnit.polygon
  })
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygons(allPolygons)
  const centerX = (maxX + minX) / 2
  const centerY = (maxY + minY) / 2
  const centerPoint = { x: centerX, y: centerY }
  const xLength = maxX - minX
  const yLength = maxY - minY

  let scaleX = (viewBoxWidth - padding) / xLength
  let scaleY = (viewBoxHeight - padding) / yLength

  const scale = Math.min(scaleX, scaleY)
  return { centerPoint, scale, viewBoxHeight: viewBoxHeight }
}

////
// Layout Icon
////

const IconStyle = (
  background: string = "rgba(128, 128, 128, 0.1)",
  borderColor: string = "rgba(128, 128, 128, 0.0)",
) => `
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${background};
  border: 1px solid ${borderColor};
`
export const LayoutIcon = ({
  spaceUnits,
  width = 28,
  height = 28,
  background,
  borderColor,
}: {
  spaceUnits: SpaceUnits
  width: number
  height: number
  background?: string
  borderColor?: string
}) => {
  const { centerPoint, scale, viewBoxHeight } = getCenterPointAndScale(spaceUnits, width, height, 0)
  return (
    <div style={IconStyle(background, borderColor)}>
      <FloorIcon
        spaceUnits={spaceUnits}
        centerPoint={centerPoint}
        scale={scale}
        strokeWidth={0.5}
        strokeColor={"#737F8C"}
        viewBoxHeight={viewBoxHeight}
        viewBoxWidth={width}
      />
    </div>
  )
}
