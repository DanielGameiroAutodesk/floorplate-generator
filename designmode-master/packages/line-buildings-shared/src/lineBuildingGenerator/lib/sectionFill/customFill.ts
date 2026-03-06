import { dotProduct, getNormalizedVectorFromPointToPoint } from "../../../lineBuildingGenerator/lib/helpers/geometry.js"
import type { Vec2 } from "../../../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"
import type { Point } from "../../../lineBuildingGenerator/lib/lineBuilding9000/BuildingTypes.js"
import type { CornerSection, Section } from "../../../lineBuildingGenerator/lib/buildPolygons.js"
import type { CustomLayout } from "../../../LineBuildingTypes.js"
import type { Floor, Unit } from "./getSectionFill.js"
import type { CustomFeature } from "../../../lineBuildingGenerator/lib/graphBuilding3000.js"

/////
// Edges
///

function transformPolygonToSection(
  polygon: Vec2[],
  xStretch: number,
  yStretch: number,
  unitVec: Point,
  basePoint: Point,
) {
  return polygon
    .map((point) => {
      const x = point.x * xStretch
      const y = point.y * yStretch
      return { x, y }
    })
    .map((point) => {
      const x = unitVec[0] * point.x - unitVec[1] * point.y + basePoint[0]
      const y = unitVec[1] * point.x + unitVec[0] * point.y + basePoint[1]
      return { x, y }
    })
}

function fillSectionPartWithCustomLayout(section: Section, floors: Floor[]) {
  const { startWall, endWall } = section
  const [spu, spl] = startWall
  const [epu, epl] = endWall

  const xStretch = 1
  const yStretch = 1

  const unitVec = getNormalizedVectorFromPointToPoint(spu, epu)
  const leftVec = getNormalizedVectorFromPointToPoint(spl, spu)
  const rightVec = getNormalizedVectorFromPointToPoint(epl, epu)

  const isRect = Math.abs(dotProduct(leftVec, unitVec)) < 1e-2 && Math.abs(dotProduct(rightVec, unitVec)) < 1e-2

  if (isRect) {
    return floors.map((floor) => {
      const units = Object.values(floor.units || {}).map((unit) => {
        const polygon = transformPolygonToSection(unit.polygon, xStretch, yStretch, unitVec, spl)
        const holes = (unit.holes || []).map((hole) =>
          transformPolygonToSection(hole, xStretch, yStretch, unitVec, spl),
        )
        return { ...unit, polygon, holes }
      })
      return { ...floor, units }
    })
  }
  return floors.map((floor) => {
    const polygon = [spu, spl, epl, epu, spu].map((point) => {
      return { x: point[0], y: point[1] }
    })
    const unit = { polygon, holes: [], type: "LIVING_UNIT" }
    const units = [unit]
    return { ...floor, units }
  })
}

function flipCustomLayout(customLayout: CustomLayout, settings: CustomFeature["settings"]) {
  const flipX = !!settings?.flipX
  const flipY = !!settings?.flipY
  if (!flipX && !flipY) return customLayout
  if (customLayout.sectionType !== "Rectangle") return customLayout
  if (!customLayout?.length || !customLayout?.width) return customLayout

  const length = customLayout.length
  const width = customLayout.width

  const flippedFloors = customLayout.floors.map((floor) => {
    const flippedUnits: Record<string, Unit> = {}
    Object.entries(floor.units as Unit[]).map(([unitID, unit]) => {
      let polygon = unit.polygon.map((point) => {
        const x = flipX ? length - point.x : point.x
        const y = flipY ? width - point.y : point.y
        return { x, y }
      })
      if (flipY !== flipX) {
        polygon = polygon.reverse()
      }
      const holes = unit.holes
        .map((hole) =>
          hole
            .map((point) => {
              const x = flipX ? length - point.x : point.x
              const y = flipY ? width - point.y : point.y
              return { x, y }
            })
            .reverse(),
        )
        .map((hole) => {
          if (flipY !== flipX) {
            return hole.reverse()
          }
          return hole
        })
      flippedUnits[unitID] = { ...unit, polygon, holes }
    })
    return { ...floor, units: flippedUnits }
  })
  return { ...customLayout, floors: flippedFloors }
}

export function fillEdgeSectionWithCustomLayout(
  section: Section,
  customLayout: CustomLayout,
  settings: CustomFeature["settings"],
) {
  const flippedCustomLayout = flipCustomLayout(customLayout, settings)
  let floors = flippedCustomLayout.floors
  floors = fillSectionPartWithCustomLayout(section, floors)
  const { startWall, endWall } = section
  const footPrint = [...startWall, endWall[1], endWall[0], startWall[0]]
  return { floors, footPrint }
}

//////
/// Corner sections

function transformPolygonToCornerSection(polygon: Vec2[], unitVec: Point, basePoint: Point, flip: boolean) {
  return polygon.map((point) => {
    if (flip) {
      const x = unitVec[0] * point.x + unitVec[1] * point.y + basePoint[0]
      const y = unitVec[1] * point.x - unitVec[0] * point.y + basePoint[1]
      return { x, y }
    }
    const x = unitVec[0] * point.x - unitVec[1] * point.y + basePoint[0]
    const y = unitVec[1] * point.x + unitVec[0] * point.y + basePoint[1]
    return { x, y }
  })
}

function getUnitVecAndBasePointForCornerTransform(cornerSection: CornerSection) {
  const { startLeg, endLeg, angle } = cornerSection
  if (endLeg > startLeg && angle >= 0) {
    const { endLegUnitVec, endLegLowerPoint } = cornerSection
    const unitVec = [-endLegUnitVec.x, -endLegUnitVec.y] as Point
    const basePoint = [endLegLowerPoint.x, endLegLowerPoint.y] as Point
    return { unitVec, basePoint, flip: true }
  }
  if (endLeg > startLeg && angle < 0) {
    const { endLegUnitVec, endLegUpperPoint } = cornerSection
    const unitVec = [-endLegUnitVec.x, -endLegUnitVec.y] as Point
    const basePoint = [endLegUpperPoint.x, endLegUpperPoint.y] as Point
    return { unitVec, basePoint, flip: false }
  }
  if (startLeg >= endLeg && angle < 0) {
    const { startLegUnitVec, startLegUpperPoint } = cornerSection
    const unitVec = [startLegUnitVec.x, startLegUnitVec.y] as Point
    const basePoint = [startLegUpperPoint.x, startLegUpperPoint.y] as Point
    return { unitVec, basePoint, flip: true }
  }

  const startLegUnitVec = cornerSection.startLegUnitVec
  const startLegLowerPoint = cornerSection.startLegLowerPoint
  const unitVec = [startLegUnitVec.x, startLegUnitVec.y] as Point
  const basePoint = [startLegLowerPoint.x, startLegLowerPoint.y] as Point

  return { unitVec, basePoint, flip: false }
}

function fillCornerSectionWithCustomFloors(cornerSection: CornerSection, customFloors: Floor[]) {
  const { unitVec, basePoint, flip } = getUnitVecAndBasePointForCornerTransform(cornerSection)

  return customFloors.map((floor) => {
    const units = Object.values(floor.units as Unit[]).map((unit) => {
      const polygon = transformPolygonToCornerSection(unit.polygon, unitVec, basePoint, flip)
      const holes = (unit.holes || []).map((hole) => transformPolygonToCornerSection(hole, unitVec, basePoint, flip))
      return { ...unit, polygon, holes }
    })
    return { ...floor, units }
  })
}

export function fillCornerSectionWithCustomLayout({
  cornerSection,
  customLayout,
}: {
  cornerSection: CornerSection
  customLayout: CustomLayout
}) {
  const footPrint = [...cornerSection.exteriorPolygon, cornerSection.exteriorPolygon[0]]
  const floors = fillCornerSectionWithCustomFloors(cornerSection, customLayout.floors)
  return { floors, footPrint }
}
