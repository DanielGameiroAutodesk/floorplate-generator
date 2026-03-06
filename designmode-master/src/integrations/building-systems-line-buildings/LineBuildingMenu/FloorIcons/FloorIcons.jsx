import { FloorIcon } from "./FloorIcon.jsx"

import { getBoundingBoxOfPolygons } from "src/integrations/building-systems-common/geoHelpers.ts"

const StoryContainerStyle = `
  display: flex;
  align-items: center;
  justify-content: center;

  margin-bottom: 8px;
`

const FloorStory = ({ floorNumber, units, centerPoint, scale, viewBoxHeight, viewBoxWidth }) => {
  return (
    <div style={StoryContainerStyle}>
      {units && (
        <FloorIcon
          floorPlan={{ units, id: floorNumber }}
          centerPoint={centerPoint}
          scale={scale}
          strokeWidth={1}
          strokeColor={"#737F8C"}
          viewBoxHeight={viewBoxHeight}
          viewBoxWidth={viewBoxWidth}
        />
      )}
    </div>
  )
}

//

function getCenterPointAndScale(floors, viewBoxWidth = 100, padding = 12) {
  const allUnits = floors.flatMap((floor) => {
    return Object.values(floor.units)
  })
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygons(allUnits.map((unit) => unit.polygon))
  const centerX = (maxX + minX) / 2
  const centerY = (maxY + minY) / 2
  const centerPoint = { x: centerX, y: centerY }
  const length = maxX - minX
  let scale = (viewBoxWidth - padding) / length
  let viewBoxHeight = ((maxY - minY) / length) * viewBoxWidth
  if (viewBoxHeight > viewBoxWidth) {
    scale = (scale * viewBoxWidth) / viewBoxHeight
  }
  return { centerPoint, scale, viewBoxHeight: viewBoxHeight }
}

export const FloorIcons = ({ floors, width }) => {
  const floorNumbers = floors.map((_, i) => i)
  const viewBoxWidth = width
  const { centerPoint, scale, viewBoxHeight } = getCenterPointAndScale(floors, viewBoxWidth, 2)

  return (
    <div>
      {floorNumbers.reverse().map((floorNumber) => {
        const units = Object.values(floors[floorNumber].units)
        return (
          <FloorStory
            key={floorNumber}
            floorNumber={floorNumber}
            units={units}
            centerPoint={centerPoint}
            scale={scale}
            viewBoxHeight={viewBoxHeight}
            viewBoxWidth={viewBoxWidth}
          />
        )
      })}
    </div>
  )
}

export const SingleFloorIcon = ({ floor, width }) => {
  const { centerPoint, scale, viewBoxHeight } = getCenterPointAndScale([floor], width, 2)
  let units = Object.values(floor.units)
  return (
    units && (
      <FloorIcon
        floorPlan={{ units, id: "123" }}
        centerPoint={centerPoint}
        scale={scale}
        strokeWidth={0.5}
        strokeColor={"#737F8C"}
        viewBoxHeight={viewBoxHeight}
        viewBoxWidth={width}
      />
    )
  )
}

function getCenterPointAndScaleCappedHeight(floors, viewBoxWidth, viewBoxHeight, padding) {
  const allUnits = floors.flatMap((floor) => {
    return Object.values(floor.units)
  })
  const { minX, maxX, minY, maxY } = getBoundingBoxOfPolygons(allUnits.map((unit) => unit.polygon))
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

export const SingleFloorIconCappedHeight = ({ floors, selectedFloorNumber, width, height, padding = 0 }) => {
  const floor = floors[selectedFloorNumber]
  if (!floor) return <></>
  const { centerPoint, scale, viewBoxHeight } = getCenterPointAndScaleCappedHeight(floors, width, height, padding)
  let units = Object.values(floor.units)
  return (
    units && (
      <FloorIcon
        floorPlan={{ units, id: "123" }}
        centerPoint={centerPoint}
        scale={scale}
        strokeWidth={0.5}
        strokeColor={"#737F8C"}
        viewBoxHeight={viewBoxHeight}
        viewBoxWidth={width}
      />
    )
  )
}
