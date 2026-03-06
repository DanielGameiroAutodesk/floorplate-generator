import { graphToLineData } from "./graphLineHelpers.js"
import type { Graph, GraphVertex } from "../../../shapeHelpers.js"
import type { LineBuildingParameters } from "../../../lineBuildingParameters.js"
import { splitLineInNonCollapsedLines } from "./blockingDistance.js"
import { getFootPrint, type FootPrint } from "./buildingBands.js"
import type { SimpleBuilding, SimpleFloor } from "../../../simpleBuilding.js"
import { polygonWithHolesXyToPolygon } from "./geoHelpers.js"
import { bufferLine } from "./bufferLine.js"
import { getCirculationBuilding } from "./circulation.js"

function getSimpleBuildings(footPrint: FootPrint, floorHeight: number, numberOfFloors: number): SimpleBuilding[] {
  const polygonWithHoles = polygonWithHolesXyToPolygon(footPrint)
  const outerShapes = [polygonWithHoles]

  const floors: SimpleFloor[] = []
  for (let i = 0; i < numberOfFloors; i++) {
    const floor = { outerShapes, height: floorHeight, content: undefined }
    floors.push(floor)
  }
  const simpleBuilding = { floors }
  return [simpleBuilding]
}

function getEmptyBuilding(
  line: GraphVertex[],
  width: number,
  floorHeight: number,
  numberOfFloors: number,
  closedLine: boolean,
) {
  const leftLine = bufferLine(line, 0.5 * width, closedLine)
  const rightLine = bufferLine(line, -0.5 * width, closedLine)

  const footPrint = getFootPrint(leftLine, rightLine, closedLine)
  return getSimpleBuildings(footPrint, floorHeight, numberOfFloors)
}

export function getLineBuilding9000(graph: Graph, parameters: LineBuildingParameters): SimpleBuilding[] {
  const lineData = graphToLineData(graph)
  const { width, floorHeight, numberOfFloors, feature } = parameters
  const splitLines = splitLineInNonCollapsedLines(lineData.line, width, lineData.closedLine)
  return splitLines.flatMap(({ line, closed }) => {
    if (feature?.name === "Circulation") {
      return getCirculationBuilding({
        line: line,
        width,
        floorHeight,
        numberOfFloors,
        closedLine: closed,
        feature,
      }) satisfies SimpleBuilding[]
    }
    return getEmptyBuilding(line, width, floorHeight, numberOfFloors, closed)
  })
}
