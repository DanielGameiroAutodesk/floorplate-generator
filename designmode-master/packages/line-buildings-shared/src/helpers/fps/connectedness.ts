import type { Vec2 } from "../../lineBuildingGenerator/lib/lineBuilding9000/graphLineHelpers.js"
import type { Unit } from "../../lineBuildingGenerator/lib/sectionFill/getSectionFill.js"
import { coordinateTransformPoints, getLineLength, makePolygonClockwise } from "./geoUtils.js"
import { findSurroundingPolygonOfConnectedGroupUnits } from "./groupPolygon.js"

function doPolygonsShareAnEdge(polygonOne: Vec2[], polygonTwo: Vec2[]) {
  const npd = 1e-3
  const n = polygonOne.length
  const m = polygonTwo.length
  for (let i = 0; i < n; i++) {
    const pointOne = polygonOne[i]
    const pointTwo = polygonOne[(i + 1) % n]
    const lineOne = [pointOne, pointTwo] as [Vec2, Vec2]
    const lineOneLength = getLineLength(lineOne)
    if (lineOneLength === 0) continue
    for (let j = 0; j < m; j++) {
      const pointThree = polygonTwo[j]
      const pointFour = polygonTwo[(j + 1) % m]
      const lineTwo = [pointThree, pointFour]
      const lineTwoLength = getLineLength([pointThree, pointFour])
      if (lineTwoLength === 0) continue
      const [{ x: s0, y: t0 }, { x: s1, y: t1 }] = coordinateTransformPoints(lineTwo, pointOne, lineOne)
      if (Math.abs(t0) > npd || Math.abs(t1) > npd) continue
      if (s1 > lineOneLength - npd || s0 < npd || s0 < s1) continue
      return true
    }
  }
  return false
}

function areUnitsDirectlyConnected(unitOne: Unit, unitTwo: Unit) {
  const outerPolyAndHolesOne = [unitOne.polygon, ...unitOne.holes.map((hole) => makePolygonClockwise(hole))]
  const outerPolyAndHolesTwo = [unitTwo.polygon, ...unitTwo.holes.map((hole) => makePolygonClockwise(hole))]
  for (let i = 0; i < outerPolyAndHolesOne.length; i++) {
    for (let j = 0; j < outerPolyAndHolesTwo.length; j++) {
      const polyOne = outerPolyAndHolesOne[i]
      const polyTwo = outerPolyAndHolesTwo[j]
      if (doPolygonsShareAnEdge(polyOne, polyTwo)) return true
    }
  }
  return false
}

function getUnitsConnectedNessGraph(units: Unit[]) {
  const connectednessGraph: Record<string, string[]> = {}
  const n = units.length
  units.forEach((unit) => {
    connectednessGraph[unit.id] = []
  })
  for (let i = 0; i < n - 1; i++) {
    const unitOne = units[i]
    for (let j = i + 1; j < n; j++) {
      const unitTwo = units[j]
      const unitsConnected = areUnitsDirectlyConnected(unitOne, unitTwo)
      if (unitsConnected) {
        connectednessGraph[unitOne.id].push(unitTwo.id)
        connectednessGraph[unitTwo.id].push(unitOne.id)
      }
    }
  }
  return connectednessGraph
}

export function findUnitsConnectedNessGroup(units: Unit[], unitID: string) {
  const connectednessGraph = getUnitsConnectedNessGraph(units)
  const group = { [unitID]: true }
  let p = [unitID]
  let c: string[] = []
  while (p.length > 0) {
    p.forEach((idP) => {
      connectednessGraph[idP].forEach((idC) => {
        if (!group[idC]) {
          group[idC] = true
          c.push(idC)
        }
      })
    })
    p = c
    c = []
  }
  return Object.keys(group)
}

export function findAllGroupsOfUnits(units: Unit[]) {
  const groups = []
  const usedUnitIDs: Record<string, boolean> = {}
  for (let unit of units) {
    if (usedUnitIDs[unit.id]) continue
    const unitIDsInGroup = findUnitsConnectedNessGroup(units, unit.id)
    unitIDsInGroup.forEach((unitID) => {
      usedUnitIDs[unitID] = true
    })
    const unitsInGroup = units.filter((unit) => unitIDsInGroup.some((unitID) => unit.id === unitID))
    const { polygonWithHoles } = findSurroundingPolygonOfConnectedGroupUnits(unitsInGroup)
    groups.push({
      units: unitsInGroup,
      polygon: polygonWithHoles.polygon,
      holes: polygonWithHoles.holes,
    })
  }
  return groups
}
