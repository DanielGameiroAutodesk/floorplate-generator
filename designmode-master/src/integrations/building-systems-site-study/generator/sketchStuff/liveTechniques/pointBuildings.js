import simplify from "simplify-geometry"
import { convertShiftFactor, boundingBoxToBuildings, lineOfPointsToVerticesEdges } from "./helpers.js"
import {
  distance,
  getBoundingBoxCoveringAllRotationAnglesForPolygon,
  getCenterOfMass,
  getUnitVector,
  rotatePoints,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

function splitOneBuildingIntoPointBuildings(buildingPoints, splitLength, shortSideBuffer) {
  const initialBuildingLength = distance(buildingPoints[0], buildingPoints[1])
  if (initialBuildingLength <= splitLength) {
    return [buildingPoints]
  } else {
    const buildingVector = getUnitVector(buildingPoints[0], buildingPoints[1])
    const splittedBuildings = []
    const noBuildings = Math.floor(initialBuildingLength / (splitLength + shortSideBuffer - 1))
    const resultingShortSideBuffer = (initialBuildingLength - noBuildings * splitLength) / noBuildings
    const offset = initialBuildingLength - noBuildings * splitLength - (noBuildings - 1) * resultingShortSideBuffer
    let startPoint = [
      buildingPoints[0][0] + (offset / 2) * buildingVector.x,
      buildingPoints[0][1] + (offset / 2) * buildingVector.y,
    ]

    for (let i = 0; i < noBuildings; i++) {
      const endPoint = [startPoint[0] + splitLength * buildingVector.x, startPoint[1] + splitLength * buildingVector.y]
      splittedBuildings.push([startPoint, endPoint])
      startPoint = [
        startPoint[0] + (splitLength + resultingShortSideBuffer) * buildingVector.x,
        startPoint[1] + (splitLength + resultingShortSideBuffer) * buildingVector.y,
      ]
    }
    return splittedBuildings
  }
}

function splitBuildingsIntoPointBuildings(buildings, splitLength, shortSideBuffer) {
  const allSplittedBuildings = []
  for (let i = 0; i < buildings.length; i++) {
    const splittedBuildings = splitOneBuildingIntoPointBuildings(buildings[i], splitLength, shortSideBuffer)
    allSplittedBuildings.push(...splittedBuildings)
  }
  return allSplittedBuildings
}

export function getPointBuildingsOnePolygon(
  buildingLimit,
  stories,
  buildingWidth,
  _angle,
  buffer,
  shiftX,
  shiftXOffset = 0,
) {
  let allEdges = {}
  let allVertices = {}
  const processedBuildingLimit = simplify(buildingLimit, 0)
  if (processedBuildingLimit.length < 3) return { vertices: {}, edges: {} }
  const convertedShiftX = convertShiftFactor(shiftX + shiftXOffset)
  const angle = (_angle - 0.5) * Math.PI
  const pivotPoint = getCenterOfMass(processedBuildingLimit)
  const rotatedBuildingLimit = rotatePoints(processedBuildingLimit, -angle, pivotPoint)
  const bbox = getBoundingBoxCoveringAllRotationAnglesForPolygon(rotatedBuildingLimit)
  const buildings1 = boundingBoxToBuildings(bbox, buildingWidth, rotatedBuildingLimit, buffer, buffer, convertedShiftX)
  const buildings2 = splitBuildingsIntoPointBuildings(buildings1, buildingWidth, buffer)
  const buildings3 = buildings2.map((b) => rotatePoints(b, angle, pivotPoint))
  for (let i = 0; i < buildings3.length; i++) {
    let { vertices, edges } = lineOfPointsToVerticesEdges(buildings3[i], { width: buildingWidth, stories })
    allVertices = Object.assign({}, allVertices, vertices)
    allEdges = Object.assign({}, allEdges, edges)
  }
  return { vertices: allVertices, edges: allEdges }
}
