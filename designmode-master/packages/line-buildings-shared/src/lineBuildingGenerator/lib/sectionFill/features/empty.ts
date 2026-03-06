import { v4 as uuid } from "uuid"

import type { Point } from "../../lineBuilding9000/BuildingTypes.js"
import type { CornerSection, Section } from "../../buildPolygons.js"
import type { LineBuildingParameters } from "../../../../lineBuildingParameters.js"

function getFloorsFromFootprint(numberOfFloors: number, footPrint: Point[], floorHeight: number) {
  const floors = []
  for (let i = 0; i < numberOfFloors; i++) {
    const polygon = footPrint.map((point) => {
      return { x: point[0], y: point[1] }
    })
    const floor = { outerShapes: [{ polygon, holes: [] }], height: floorHeight, id: uuid() }
    floors.push(floor)
  }
  return floors
}

export function fillEdgeSectionWithEmpty(section: Section, settings: LineBuildingParameters) {
  const { numberOfFloors, floorHeight } = settings
  const { startWall, endWall } = section
  const footPrint = [...startWall, endWall[1], endWall[0], startWall[0]]
  const floors = getFloorsFromFootprint(numberOfFloors, footPrint, floorHeight)

  return { floors, footPrint }
}

export function fillCornerWithEmpty(cornerSection: CornerSection, settings: LineBuildingParameters) {
  const { numberOfFloors, floorHeight } = settings
  const footPrint = [...cornerSection.exteriorPolygon, cornerSection.exteriorPolygon[0]]

  const floors = getFloorsFromFootprint(numberOfFloors, footPrint, floorHeight)
  return { floors, footPrint }
}
