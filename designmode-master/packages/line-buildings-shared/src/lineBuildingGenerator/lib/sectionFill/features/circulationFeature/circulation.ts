import { v4 as uuid } from "uuid"

import { getBlockDistanceForSimpleCorner, getCirculationCorner } from "./circulationCorner.js"
import type { CornerSection, Section } from "../../../buildPolygons.js"
import type { Point } from "../../../lineBuilding9000/BuildingTypes.js"
import {
  dotProduct,
  getVectorFromPointToPoint,
  movePointAlongVector,
  simpleUnitVector,
} from "../../../helpers/geometry.js"
import type { LineBuildingParameters } from "../../../../../lineBuildingParameters.js"
import type { Unit } from "../../getSectionFill.js"
import type { Graph } from "../../../../../shapeHelpers.js"

export type Alignment = "center" | "left" | "right"
function getPolygonsWithTypesCenter(section: Section, corridorWidth: number) {
  const { startWall, endWall } = section
  const unit = simpleUnitVector(startWall[1], endWall[1])
  const normal = [unit[1], -unit[0]] as Point

  const startVec = getVectorFromPointToPoint(startWall[0], startWall[1])
  const width = dotProduct(normal, startVec)

  const distanceOne = 0.5 * width - 0.5 * corridorWidth
  const distanceTwo = 0.5 * width + 0.5 * corridorWidth

  const startUnit = simpleUnitVector(startWall[1], startWall[0])
  const endUnit = simpleUnitVector(endWall[1], endWall[0])

  const distanceOneStart = (-1 / dotProduct(normal, startUnit)) * distanceOne
  const distanceOneEnd = (-1 / dotProduct(normal, endUnit)) * distanceOne

  const distanceTwoStart = (-1 / dotProduct(normal, startUnit)) * distanceTwo
  const distanceTwoEnd = (-1 / dotProduct(normal, endUnit)) * distanceTwo

  const pOneStart = movePointAlongVector(startWall[1], startUnit, distanceOneStart)
  const pOneEnd = movePointAlongVector(endWall[1], endUnit, distanceOneEnd)

  const pTwoStart = movePointAlongVector(startWall[1], startUnit, distanceTwoStart)
  const pTwoEnd = movePointAlongVector(endWall[1], endUnit, distanceTwoEnd)

  const polyOne = [startWall[0], pTwoStart, pTwoEnd, endWall[0], startWall[0]]
  const polyTwo = [pTwoStart, pOneStart, pOneEnd, pTwoEnd, pTwoStart]
  const polyThree = [pOneStart, startWall[1], endWall[1], pOneEnd, pOneStart]

  return [
    { polygon: polyOne, type: "LIVING_UNIT" },
    { polygon: polyTwo, type: "CORRIDOR" },
    { polygon: polyThree, type: "LIVING_UNIT" },
  ]
}

function getPolygonsWithTypesLeft(section: Section, corridorWidth: number) {
  const { startWall, endWall } = section
  const unit = simpleUnitVector(startWall[1], endWall[1])
  const normal = [unit[1], -unit[0]] as Point

  const startVec = getVectorFromPointToPoint(startWall[0], startWall[1])
  const width = dotProduct(normal, startVec)

  const distanceOne = width - corridorWidth

  const startUnit = simpleUnitVector(startWall[1], startWall[0])
  const endUnit = simpleUnitVector(endWall[1], endWall[0])

  const distanceOneStart = (-1 / dotProduct(normal, startUnit)) * distanceOne
  const distanceOneEnd = (-1 / dotProduct(normal, endUnit)) * distanceOne

  const pOneStart = movePointAlongVector(startWall[1], startUnit, distanceOneStart)
  const pOneEnd = movePointAlongVector(endWall[1], endUnit, distanceOneEnd)

  const polyOne = [startWall[0], pOneStart, pOneEnd, endWall[0], startWall[0]]
  const polyTwo = [pOneStart, startWall[1], endWall[1], pOneEnd, pOneStart]

  return [
    { polygon: polyOne, type: "CORRIDOR" },
    { polygon: polyTwo, type: "LIVING_UNIT" },
  ]
}

function getPolygonsWithTypesRight(section: Section, corridorWidth: number) {
  const { startWall, endWall } = section
  const unit = simpleUnitVector(startWall[1], endWall[1])
  const normal = [unit[1], -unit[0]] as Point

  const distanceOne = corridorWidth

  const startUnit = simpleUnitVector(startWall[1], startWall[0])
  const endUnit = simpleUnitVector(endWall[1], endWall[0])

  const distanceOneStart = (-1 / dotProduct(normal, startUnit)) * distanceOne
  const distanceOneEnd = (-1 / dotProduct(normal, endUnit)) * distanceOne

  const pOneStart = movePointAlongVector(startWall[1], startUnit, distanceOneStart)
  const pOneEnd = movePointAlongVector(endWall[1], endUnit, distanceOneEnd)

  const polyOne = [startWall[0], pOneStart, pOneEnd, endWall[0], startWall[0]]
  const polyTwo = [pOneStart, startWall[1], endWall[1], pOneEnd, pOneStart]

  return [
    { polygon: polyOne, type: "LIVING_UNIT" },
    { polygon: polyTwo, type: "CORRIDOR" },
  ]
}

function getPolygonsWithTypes(section: Section, corridorWidth: number, corridorAlignment: Alignment) {
  if (corridorAlignment === "left") return getPolygonsWithTypesLeft(section, corridorWidth)
  if (corridorAlignment === "right") return getPolygonsWithTypesRight(section, corridorWidth)
  return getPolygonsWithTypesCenter(section, corridorWidth)
}

function fillEdgeSection(
  section: Section,
  settings: LineBuildingParameters,
  corridorWidth: number,
  corridorAlignment: Alignment,
) {
  const polygonsAndTypes = getPolygonsWithTypes(section, corridorWidth, corridorAlignment)

  const { numberOfFloors, floorHeight } = settings
  const { startWall, endWall } = section
  const footPrint = [...startWall, endWall[1], endWall[0], startWall[0]]
  const floors = []
  for (let i = 0; i < numberOfFloors; i++) {
    const units = polygonsAndTypes.map((polygonAndType) => {
      const polygon = polygonAndType.polygon.map((point) => {
        return { x: point[0], y: point[1] }
      })
      const type = polygonAndType.type

      return { polygon, holes: [], type, id: uuid() }
    })

    const height = floorHeight
    const floorID = uuid()
    const floor = { units, height, id: floorID }
    floors.push(floor)
  }

  return { floors, footPrint }
}

export function rectangleCirculationToFloorPlan(length: number, width: number, feature: any) {
  const corridorWidth = feature?.settings?.corridorWidth?.value || 2
  const corridorAlignment = feature?.settings?.corridorAlignment?.value || "center"

  const startWall = [
    [0, width],
    [0, 0],
  ]
  const endWall = [
    [length, width],
    [length, 0],
  ]

  const section = { startWall, endWall } as Section
  const polygonsAndTypes = getPolygonsWithTypes(section, corridorWidth, corridorAlignment)

  const units = polygonsAndTypes.map((polygonWithType) => {
    const { polygon, type } = polygonWithType
    return { polygon: polygon.map(([x, y]) => ({ x, y })), holes: [], type, id: Math.random().toString(16).slice(2) }
  })

  const outerShapePolygon = [
    [0, 0],
    [length, 0],
    [length, width],
    [0, width],
    [0, 0],
  ]
  const outerShape = { polygon: outerShapePolygon.map(([x, y]) => ({ x, y })), holes: [] }
  const floor = {
    outerShape,
    name: "middleFloor",
    units: units.reduce(
      (acc, u) => {
        acc[u.id] = u
        return acc
      },
      {} as Record<string, Unit>,
    ),
  }
  return [floor]
}

export function fillEdgeSectionWithCirculation({
  section,
  settings,
  feature,
}: {
  section: Section
  settings: LineBuildingParameters
  feature: any
}) {
  const corridorWidth = feature?.settings?.corridorWidth?.value || 2
  const corridorAlignment = feature?.settings?.corridorAlignment?.value || "center"

  return fillEdgeSection(section, settings, corridorWidth, corridorAlignment)
}

//////
// Corner
///

function getOuterShapeOfCornerBake({
  startLeg,
  endLeg,
  angle,
  width,
}: {
  startLeg: number
  endLeg: number
  angle: number
  width: number
}) {
  // angle >= 0
  const blockDist = 2 * getBlockDistanceForSimpleCorner(width, angle)

  const outerShape = []
  let p = { x: 0, y: 0 }
  outerShape.push(p)

  {
    const x = p.x + startLeg + blockDist
    const y = p.y
    p = { x, y }
    outerShape.push(p)
  }
  {
    const x = p.x + (endLeg + blockDist) * Math.cos(angle)
    const y = p.y + (endLeg + blockDist) * Math.sin(angle)
    p = { x, y }
    outerShape.push(p)
  }
  {
    const x = p.x + width * Math.cos(angle + Math.PI / 2)
    const y = p.y + width * Math.sin(angle + +Math.PI / 2)
    p = { x, y }
    outerShape.push(p)
  }

  if (endLeg > 0) {
    const x = p.x + endLeg * Math.cos(angle + Math.PI)
    const y = p.y + endLeg * Math.sin(angle + +Math.PI)
    p = { x, y }
    outerShape.push(p)
  }

  if (startLeg > 0) {
    const x = p.x - startLeg
    const y = p.y
    p = { x, y }
    outerShape.push(p)
  }
  return outerShape
}

export function CornerCirculationToFloorPlan({
  startLeg,
  endLeg,
  angle,
  width,
  feature,
  corridorAlignment,
}: {
  startLeg: number
  endLeg: number
  angle: number
  width: number
  feature: any
  corridorAlignment: Alignment
}) {
  const corridorWidth = feature?.settings?.corridorWidth?.value || 2
  // const corridorAlignment = feature?.settings?.corridorAlignment?.value || "center"

  const blockDist = getBlockDistanceForSimpleCorner(width, angle)

  const y0 = 0.5 * width
  const x1 = startLeg + blockDist
  const y1 = y0

  const x2 = x1 + (endLeg + blockDist) * Math.cos(angle)
  const y2 = y1 + (endLeg + blockDist) * Math.sin(angle)

  const prevVertex = { x: 0, y: y0 }
  const vertex = { x: x1, y: y1 }
  const nextVertex = { x: x2, y: y2 }

  const groundPolygons = getCirculationCorner({
    prevVertex,
    nextVertex,
    cornerVertex: vertex,
    width,
    corridorAlignment,
    corridorWidth,
    startLeg: startLeg,
    endLeg: endLeg,
  })

  const units = groundPolygons.map((polygonWithType) => {
    const { polygon, type } = polygonWithType
    return { polygon: polygon, holes: [], type, id: Math.random().toString(16).slice(2) }
  })

  const outerShapePolygon = getOuterShapeOfCornerBake({ startLeg, endLeg, angle, width })

  const outerShape = { polygon: outerShapePolygon, holes: [] }
  const floor = {
    outerShape,
    name: "middleFloor",
    units: units.reduce(
      (acc, u) => {
        acc[u.id] = u
        return acc
      },
      {} as Record<string, Unit>,
    ),
  }
  return [floor]
}

export function fillCornerSectionWithCirculation({
  section,
  settings,
  feature,
  subGraph,
}: {
  section: CornerSection
  settings: LineBuildingParameters
  feature: any
  subGraph: Graph
}) {
  const vertex = section.vertex
  const prevEdge = Object.values(subGraph.edges).find((edge) => edge.end === vertex.id)
  const nextEdge = Object.values(subGraph.edges).find((edge) => edge.start === vertex.id)
  const prevVertex = subGraph.vertices[prevEdge!.start]
  const nextVertex = subGraph.vertices[nextEdge!.end]

  const width = settings.width
  const corridorAlignment = feature.settings?.corridorAlignment?.value || "center"
  const corridorWidth = feature?.settings?.corridorWidth?.value || 2

  const { startLeg, endLeg } = section

  const groundPolygons = getCirculationCorner({
    prevVertex,
    nextVertex,
    cornerVertex: vertex,
    width,
    corridorAlignment,
    corridorWidth,
    startLeg: startLeg,
    endLeg: endLeg,
  })

  const { numberOfFloors, floorHeight } = settings
  const footPrint = [...section.exteriorPolygon, section.exteriorPolygon[0]]
  const floors = []
  for (let i = 0; i < numberOfFloors; i++) {
    const units = groundPolygons.map((polygonAndType) => {
      const { polygon, holes, type } = polygonAndType
      return { polygon, holes, type, id: uuid() }
    })
    const floorID = uuid()
    const floor = { units, height: floorHeight, id: floorID }
    floors.push(floor)
  }

  return { floors, footPrint }
}
