import { isClockwise } from "./helpers/geometry.js"
import type { Corner, Edges, Floor } from "./sectionFill/getSectionFill.js"

import { closePolygonIfNotClosed } from "../../helpers/geoHelpers.js"
import type { SimpleBuilding, SimpleFloor } from "../../simpleBuilding.js"
import type { LineBuildingParameters } from "../../lineBuildingParameters.js"
import { findAllGroupsOfUnits } from "../../helpers/fps/connectedness.js"

function getSectionProp(edgeVertexID: string, i: number, propName: string, parameters: any) {
  const sectionID = edgeVertexID + "::" + i
  const sectionProps = (parameters?.sectionProps || {})[sectionID]
  return sectionProps?.[propName] || parameters[propName]
}

function setFloorHeightAndElevation(_floors: any, floorHeight: number) {
  return _floors.map((floor: any, i: number) => {
    const elevation = i * floorHeight
    return { ...floor, height: floorHeight, elevation }
  })
}

function setNumberOfFloors(floors: any, numberOfFloors: number) {
  const middleFloorIndex = floors.findIndex((floor: any) => floor.name === "middleFloor")
  const bottomFloorIndex = floors.findIndex((floor: any) => floor.name === "bottomFloor")
  const topFloorIndex = floors.findIndex((floor: any) => floor.name === "topFloor")

  const duplicationIndex =
    middleFloorIndex !== -1 ? middleFloorIndex : Math.min(floors.length - 1, Math.max(0, floors.length - 2))

  if (numberOfFloors > floors.length) {
    return [
      ...floors.slice(0, duplicationIndex),
      ...Array(numberOfFloors - floors.length)
        .fill(0)
        .map(() => {
          return floors[duplicationIndex]
        }),
      ...floors.slice(duplicationIndex),
    ]
  }

  if (numberOfFloors < floors.length) {
    if (numberOfFloors === 1 && bottomFloorIndex !== -1) {
      return [floors[bottomFloorIndex]]
    }
    if (numberOfFloors === 1 && topFloorIndex !== -1) {
      return [floors[topFloorIndex]]
    }
    if (numberOfFloors === 2 && bottomFloorIndex !== -1 && topFloorIndex !== -1) {
      return [floors[bottomFloorIndex], floors[topFloorIndex]]
    }

    if (numberOfFloors === 1) {
      return [floors[0]]
    }
    if (numberOfFloors === 2) {
      return [floors[0], floors[floors.length - 1]]
    }

    return [floors[0], ...floors.slice(1, numberOfFloors - 1), floors[floors.length - 1]]
  }
  return floors
}

function removeDuplicatedPoints(ring: [number, number][]) {
  return ring.filter((point, i) => {
    if (i === 0) return true
    const prevPoint = ring[i - 1]
    return prevPoint[0] !== point[0] || prevPoint[1] !== point[1]
  })
}

function toClosedPolygonRing(poly: any, clockWise: boolean = false) {
  let closedRing = closePolygonIfNotClosed(
    poly.map((point: any) => {
      return [point.x, point.y]
    }),
  )
  closedRing = removeDuplicatedPoints(closedRing)
  const isCw = isClockwise(closedRing)
  if (isCw !== clockWise) closedRing.reverse()
  return closedRing
}

function floorOfUnitsToSimpleFloor(floor: Floor): SimpleFloor {
  const { outerShapes: floorOuterShapes, units, height } = floor
  if (!units) {
    return {
      outerShapes: floorOuterShapes!.map(({ polygon, holes }) => ({
        polygon: toClosedPolygonRing(polygon),
        holes: holes.map((h) => toClosedPolygonRing(h, true)),
      })),
      height,
      content: undefined,
    }
  }
  const simpleUnits = Object.values(units).flatMap((unit: any) => {
    return {
      polygon: toClosedPolygonRing(unit.polygon),
      holes: unit.holes.map((h: any) => toClosedPolygonRing(h, true)),
      type: unit.type,
      id: unit.id,
      color: "#223399",
    }
  })
  const outerShapes = findAllGroupsOfUnits(units).map((group) => {
    return {
      polygon: toClosedPolygonRing(group.polygon),
      holes: group.holes.map((p) => toClosedPolygonRing(p, true)),
    }
  })
  return { outerShapes, height, content: { type: "floorPlan", units: simpleUnits } }
}

export function getSimpleBuildingFromBuildingCustomBySection(
  customLayoutFill: {
    edges: Record<string, Edges>
    corners: Record<string, Corner>
  },
  parameters: LineBuildingParameters,
): SimpleBuilding[] {
  const { floorHeight } = parameters

  const simpleBuildings: SimpleBuilding[] = []

  Object.values(customLayoutFill.edges).forEach((edgeData) => {
    const { sections, edgeID } = edgeData
    sections.forEach((section, i) => {
      const numberOfFloorsOnSection = getSectionProp(edgeID, i, "numberOfFloors", parameters)
      let floors = section.floors
      floors = setNumberOfFloors(floors, numberOfFloorsOnSection)
      floors = setFloorHeightAndElevation(floors, floorHeight)
      const simpleFloors: SimpleFloor[] = floors.map((floor) => {
        return floorOfUnitsToSimpleFloor(floor)
      })
      const simpleBuilding = { floors: simpleFloors }
      simpleBuildings.push(simpleBuilding)
    })
  })

  Object.values(customLayoutFill.corners).forEach((cornerData: any) => {
    const { vertexID } = cornerData
    const numberOfFloorsOnSection = getSectionProp(vertexID, 0, "numberOfFloors", parameters)
    let floors = cornerData.floors
    floors = setNumberOfFloors(floors, numberOfFloorsOnSection)
    floors = setFloorHeightAndElevation(floors, floorHeight)
    const simpleFloors = floors.map((floor: { units: any; height: number }) => {
      return floorOfUnitsToSimpleFloor(floor as Floor)
    })
    const simpleBuilding = { floors: simpleFloors }
    simpleBuildings.push(simpleBuilding)
  })

  return simpleBuildings
}
