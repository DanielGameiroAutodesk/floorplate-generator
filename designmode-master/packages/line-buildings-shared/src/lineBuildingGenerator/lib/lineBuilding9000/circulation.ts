import type { GraphVertex } from "../../../shapeHelpers.js"
import { bufferLine } from "./bufferLine.js"
import { getFootPrint } from "./buildingBands.js"
import type { PolygonWithHoles, SimpleUnit } from "./BuildingTypes.js"
import { polygonWithHolesXyToPolygon } from "./geoHelpers.js"
import type { SimpleBuilding } from "../../../simpleBuilding.js"

function getSimpleBuildings({
  outerShapes,
  units,
  floorHeight,
  numberOfFloors,
}: {
  outerShapes: PolygonWithHoles[]
  units: SimpleUnit[]
  floorHeight: number
  numberOfFloors: number
}): SimpleBuilding[] {
  const floors: SimpleBuilding["floors"] = []
  for (let i = 0; i < numberOfFloors; i++) {
    floors.push({ outerShapes, height: floorHeight, content: { type: "floorPlan", units } })
  }
  const simpleBuilding = { floors }
  return [simpleBuilding]
}

function getBands(width: number, corridorWidth: number, corridorAlignment: "left" | "right" | "center") {
  if (corridorAlignment === "left") {
    const ts = [0.5 * width, 0.5 * width - corridorWidth, -0.5 * width]
    const types = ["CORRIDOR", "LIVING_UNIT"]
    return { ts, types }
  }
  if (corridorAlignment === "right") {
    const ts = [0.5 * width, -0.5 * width + corridorWidth, -0.5 * width]
    const types = ["LIVING_UNIT", "CORRIDOR"]
    return { ts, types }
  }
  const ts = [0.5 * width, 0.5 * corridorWidth, -0.5 * corridorWidth, -0.5 * width]
  const types = ["LIVING_UNIT", "CORRIDOR", "LIVING_UNIT"]
  return { ts, types }
}

export function getCirculationBuilding({
  line,
  width,
  floorHeight,
  numberOfFloors,
  closedLine,
  feature,
}: {
  line: GraphVertex[]
  width: number
  floorHeight: number
  numberOfFloors: number
  closedLine: boolean
  feature: any
}): SimpleBuilding[] {
  const corridorWidth = feature.settings.corridorWidth.value
  const corridorAlignment = feature.settings.corridorAlignment.value

  const { ts, types } = getBands(width, corridorWidth, corridorAlignment)
  const lineBands = ts.map((t) => {
    return bufferLine(line, t, closedLine)
  })

  const units = []
  for (let i = 0; i < ts.length - 1; i++) {
    const lineOne = lineBands[i]
    const lineTwo = lineBands[i + 1]
    const footPrint = getFootPrint(lineOne, lineTwo, closedLine)
    const type = types[i] as SimpleUnit["type"]
    const polygonWithHoles = polygonWithHolesXyToPolygon(footPrint)
    const unit = { ...polygonWithHoles, type }
    units.push(unit)
  }
  const outerShapes = []
  {
    const lineOne = lineBands[0]
    const lineTwo = lineBands[lineBands.length - 1]
    const footPrint = getFootPrint(lineOne, lineTwo, closedLine)
    const polygonWithHoles = polygonWithHolesXyToPolygon(footPrint)
    outerShapes.push(polygonWithHoles)
  }
  return getSimpleBuildings({ outerShapes, units, floorHeight, numberOfFloors })
}
