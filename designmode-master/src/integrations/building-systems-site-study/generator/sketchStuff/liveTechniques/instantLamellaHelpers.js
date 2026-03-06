import { getUnitVector } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"

function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
}

function splitBuildingToLamellas(buildingPoints, noBuildings, buildingLength, shortSideBuffer, bufferStartPoint = 0) {
  const buildingVector = getUnitVector(buildingPoints[0], buildingPoints[1])
  const splittedBuildings = []
  let startPoint = [
    buildingPoints[0][0] + bufferStartPoint * buildingVector.x,
    buildingPoints[0][1] + bufferStartPoint * buildingVector.y,
  ]
  for (let i = 0; i < noBuildings; i++) {
    const endPoint = [
      startPoint[0] + buildingLength * buildingVector.x,
      startPoint[1] + buildingLength * buildingVector.y,
    ]
    splittedBuildings.push([startPoint, endPoint])
    startPoint = [
      startPoint[0] + (buildingLength + shortSideBuffer) * buildingVector.x,
      startPoint[1] + (buildingLength + shortSideBuffer) * buildingVector.y,
    ]
  }
  return splittedBuildings
}

export function splitOneBuildingToFixedLengthLamellas(buildingPoints, buildingLength, minimumShortSideBuffer) {
  const initialBuildingLength = distance(buildingPoints[0], buildingPoints[1])
  let bufferStartPoint = 0
  let resultingShortSideBuffer = 0

  if (buildingLength >= initialBuildingLength) {
    return []
  }
  const noBuildings = Math.floor(
    (initialBuildingLength + minimumShortSideBuffer) / (buildingLength + minimumShortSideBuffer),
  )
  if (noBuildings <= 1) {
    bufferStartPoint = (initialBuildingLength - buildingLength) / 2
  } else {
    resultingShortSideBuffer = (initialBuildingLength - noBuildings * buildingLength) / (noBuildings - 1)
    if (resultingShortSideBuffer - minimumShortSideBuffer > 1) {
      bufferStartPoint = (resultingShortSideBuffer - minimumShortSideBuffer) / (noBuildings + 1)
      resultingShortSideBuffer -= (2 * bufferStartPoint) / (noBuildings - 1)
    }
  }
  return splitBuildingToLamellas(
    buildingPoints,
    noBuildings,
    buildingLength,
    resultingShortSideBuffer,
    bufferStartPoint,
  )
}

export function splitBuildingsToFixedLengthLamellas(buildings, buildingLength, minimumShortSideBuffer) {
  const allSplittedBuildings = []
  for (let i = 0; i < buildings.length; i++) {
    const splittedBuildings = splitOneBuildingToFixedLengthLamellas(
      buildings[i],
      buildingLength,
      minimumShortSideBuffer,
    )
    allSplittedBuildings.push(...splittedBuildings)
  }
  return allSplittedBuildings
}
