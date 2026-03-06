import type { SpaceUnits, SpaceUnit } from "./matchingFloorPlansInBuildings"
import { filterZeroEdgesAndAngles } from "src/integrations/building-systems-basic-building/lib/geometry/geometry"
import type { PointXY, PolygonXY } from "src/lib/geometry/polygonXY"

type Wall = [PointXY, PointXY]

function getWallsFromPolygon(polygon: PolygonXY) {
  const walls: Wall[] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % n]
    walls.push([p0, p1])
  }
  return walls
}
function getWallsFromUnits(units: SpaceUnit[]): Record<string, Wall[]> {
  const walls: Record<string, Wall[]> = {}
  units.forEach((unit) => {
    const type = (unit.program || "undefined") + JSON.stringify(unit.properties)
    if (walls[type] === undefined) walls[type] = []
    walls[type].push(...getWallsFromPolygon(unit.polygon))
    unit.holes.forEach((hole: any) => {
      walls[type].push(...getWallsFromPolygon(hole))
    })
  })
  return walls
}

// type TemplateUnit = { type: string; id: string; polygon: PolygonXY; holes: PolygonXY[] }
function compareUnits(unitsOne: SpaceUnit[], unitsTwo: SpaceUnit[]) {
  const wallsOne = getWallsFromUnits(unitsOne)
  const wallsTwo = getWallsFromUnits(unitsTwo)

  if (Object.keys(wallsOne).length !== Object.keys(wallsTwo).length) return false
  for (const type of Object.keys(wallsOne)) {
    if (wallsTwo[type] === undefined) return false
    if (wallsTwo[type].length !== wallsOne[type].length) return false
  }

  Object.keys(wallsOne).forEach((type) => {
    wallsOne[type].sort((wallOne, wallsTwo) => {
      return wallOne[0].x - wallsTwo[0].x
    })
  })
  Object.keys(wallsTwo).forEach((type) => {
    wallsTwo[type].sort((wallOne, wallsTwo) => {
      return wallOne[0].x - wallsTwo[0].x
    })
  })

  for (const type of Object.keys(wallsOne)) {
    const n = wallsOne[type].length
    let lowerJ = 0
    for (let i = 0; i < n; i++) {
      const wallOne = wallsOne[type][i]
      let wallMatch = false
      for (let j = lowerJ; j < n; j++) {
        const wallTwo = wallsTwo[type][j]

        const [p0, p1] = wallOne
        const [p2, p3] = wallTwo

        if (p0.x > p2.x + 1) lowerJ = j
        if (p0.x < p2.x - 1) break

        const a = (p0.x - p2.x) ** 2 + (p0.y - p2.y) ** 2
        const b = (p1.x - p3.x) ** 2 + (p1.y - p3.y) ** 2
        if (a < 1e-4 && b < 1e-4) {
          wallMatch = true
          break
        }
      }
      if (!wallMatch) return false
    }
  }
  return true
}

export function doFloorPlansInBuildingMatch(floorPlanOne: SpaceUnits, floorPlanTwo: SpaceUnits) {
  if (floorPlanOne.length !== floorPlanTwo.length) return false

  const unitsOne: SpaceUnit[] = floorPlanOne.map((spaceUnit) => {
    const polygon = filterZeroEdgesAndAngles(spaceUnit.polygon)
    const holes = spaceUnit.holes.map((hole) => filterZeroEdgesAndAngles(hole))
    return { ...spaceUnit, polygon, holes }
  })
  const unitsTwo: SpaceUnit[] = floorPlanTwo.map((spaceUnit) => {
    const polygon = filterZeroEdgesAndAngles(spaceUnit.polygon)
    const holes = spaceUnit.holes.map((hole) => filterZeroEdgesAndAngles(hole))
    return { ...spaceUnit, polygon, holes }
  })

  return compareUnits(unitsOne, unitsTwo)
}
