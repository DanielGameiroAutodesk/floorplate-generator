import type { ParkingParams, Polygon } from "./parkingGenerator/parking"
import { drawParkingSpots } from "./parkingGenerator/parking"
import { closePolygon, openPolygon, pointPointDistance } from "./helpers/geometry"

const FEET_TO_METER = 0.3048
function feetToMeter(feetLength: number) {
  return feetLength * FEET_TO_METER
}

export function getDefaultParkingParameters(imperialUnits: boolean): ParkingParams {
  return {
    laneWidth: imperialUnits ? feetToMeter(22) : 7,
    spotWidth: imperialUnits ? feetToMeter(8) : 2.5,
    spotLength: imperialUnits ? feetToMeter(16) : 5,
    spotAngle: 0,
    parkingRowsAngle: 0,
    columnWidth: imperialUnits ? feetToMeter(3) : 1,
    spotsPerColumn: 3,
    freeSides: [],
    bufferFromWall: imperialUnits ? feetToMeter(1) : 0.3,
  }
}

type HoleyPolygon = Polygon[]
export type ParkingContent = { polygon: HoleyPolygon; spots: Polygon[] }

function sortPolygonFromIndex(openPolygon: Polygon, index: number): Polygon {
  const numPoints = openPolygon.length
  const sortedPoly: Polygon = []
  for (let i = 0; i < numPoints; i++) {
    const modulatedIndex = (i + index) % numPoints
    sortedPoly.push(openPolygon[modulatedIndex])
  }
  return sortedPoly
}

function scoreIndex(openPolygon: Polygon, startIndex: number): number {
  const sorted = sortPolygonFromIndex(openPolygon, startIndex)
  const sides = sorted.map((p, idx) => [p, sorted[(idx + 1) % sorted.length]])
  const alpha = 0.8
  let weightedSum = 0
  sides.forEach((side, idx) => {
    const distance = pointPointDistance(side[0], side[1])
    const score = distance * alpha ** idx
    weightedSum += score
  })
  return weightedSum
}

function orderPolygonFromEdgeLengths(polygon: Polygon): Polygon {
  const open = openPolygon(polygon)
  let highestScore = -Infinity
  let startIndex = 0
  for (let i = 0; i < open.length; i++) {
    const score = scoreIndex(open, i)
    if (score > highestScore) {
      highestScore = score
      startIndex = i
    }
  }
  return closePolygon(sortPolygonFromIndex(open, startIndex))
}

export function generateParking(polygon: Polygon[], parameters: ParkingParams): ParkingContent {
  const orderedPoly = polygon.map(orderPolygonFromEdgeLengths)
  const [enclosingPolygon, ...blockingPolygons] = orderedPoly
  const spots = drawParkingSpots(enclosingPolygon, parameters, [], blockingPolygons)

  return { polygon, spots }
}
