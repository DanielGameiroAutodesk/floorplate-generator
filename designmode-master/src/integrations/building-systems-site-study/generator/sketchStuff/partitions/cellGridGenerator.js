import { v4 as uuidv4 } from "uuid"
import {
  affineMultiply,
  createRotateAffine,
  inverseAffine,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/affineHelpers.js"
import { getGraphCutToBuildingLimits } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellGraphIntersection.js"

function getGridPoints(originPoint, boxWidth, boxHeight, dx, dy) {
  const xMin = originPoint[0]
  const yMin = originPoint[1]
  const lengthX = boxWidth
  const lengthY = boxHeight
  const numCellsX = Math.ceil(lengthX / dx) + 1
  const numCellsY = Math.ceil(lengthY / dy) + 1
  const numPoints = numCellsX * numCellsY
  const pointForIndex = (i) => {
    const xIndex = i % numCellsX
    const yIndex = Math.floor(i / numCellsX)
    const x = xIndex === numCellsX - 1 ? xMin + boxWidth : xMin + xIndex * dx
    const y = yIndex === numCellsY - 1 ? yMin + boxHeight : yMin + yIndex * dy
    return [x, y]
  }
  return Array.apply(null, Array(numPoints)).map((_, i) => {
    const [x, y] = pointForIndex(i)
    return { id: uuidv4(), x, y }
  })
}

function generateCompleteGridGraph(originPoint, boxWidth, boxHeight, dx, dy, width) {
  const points = getGridPoints(originPoint, boxWidth, boxHeight, dx, dy)
  const numCellsX = Math.ceil(boxWidth / dx) + 1
  const numCellsY = Math.ceil(boxHeight / dy) + 1
  const vertices = points.reduce((acc, point) => {
    return { ...acc, [point.id]: { id: point.id, x: point.x, y: point.y } }
  }, {})
  let edges = {}
  function addEdge(id1, id2) {
    const id = uuidv4()
    edges[id] = { id, start: id1, end: id2, width }
  }
  points.forEach((point, i) => {
    const xIndex = i % numCellsX
    const yIndex = Math.floor(i / numCellsX)
    if (xIndex + 1 < numCellsX) {
      addEdge(point.id, points[i + 1].id)
    }
    if (yIndex + 1 < numCellsY) {
      addEdge(point.id, points[i + numCellsX].id)
    }
  })
  return { vertices, edges }
}

export function generateCompleteCellGrid(options) {
  const {
    buildingLimits,
    originPoint,
    rotateAngle,
    pivotPoint,
    boxWidth,
    boxHeight,
    dx,
    dy,
    shiftX,
    shiftY,
    width,
    // existingBuildings,
    // buildings,
    // complexBuildings,
  } = options
  // if (existingBuildings) return getExistingBuildingCells(buildingLimits, width, buildings, complexBuildings);
  const rotateAffine = createRotateAffine(rotateAngle, pivotPoint)
  const rotateBackAffine = inverseAffine(rotateAffine)
  const shiftedOrigin = [originPoint[0] - shiftX, originPoint[1] - shiftY]
  const { vertices, edges } = generateCompleteGridGraph(
    shiftedOrigin,
    boxWidth + shiftX,
    boxHeight + shiftY,
    dx,
    dy,
    width,
  )
  const rotatedVertices = Object.entries(vertices).reduce((acc, [key, val]) => {
    const rotatedPoint = affineMultiply([val.x, val.y], rotateBackAffine)
    return { ...acc, [key]: { id: key, x: rotatedPoint[0], y: rotatedPoint[1] } }
  }, {})

  const graphCutToBuildingLimits = getGraphCutToBuildingLimits({ edges, vertices: rotatedVertices }, buildingLimits)
  return graphCutToBuildingLimits
}
