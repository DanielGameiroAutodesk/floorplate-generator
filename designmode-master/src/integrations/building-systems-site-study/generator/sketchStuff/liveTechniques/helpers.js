import { getIndexOf, mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"
import polygonClipping from "polygon-clipping"
import { distance } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { v4 as uuidv4 } from "uuid"

const NPD = 0.001

export function getSortedIndexesOfArray(array) {
  return Array.from(Array(array.length).keys()).sort((a, b) => (array[a] < array[b] ? -1 : (array[b] < array[a]) | 0))
}

export function clipBuilding(buildingFromIntersection, shortSideBuffer, buildingWidth) {
  const x = buildingFromIntersection.map((e) => e[0])
  const y = buildingFromIntersection.map((e) => e[1])

  const sortedIndexesOfx = getSortedIndexesOfArray(x)
  const minXindex = sortedIndexesOfx[0]
  const maxXindex = sortedIndexesOfx[sortedIndexesOfx.length - 1]

  const xMin = x[minXindex]
  const xMax = x[maxXindex]
  if (Math.abs(xMin - xMax) < buildingWidth - NPD) {
    return []
  }

  let leftEdgeXindices = []
  let rightEdgeXindices = []

  for (let i = 0; i < x.length; i++) {
    if (x[i] === xMin) {
      leftEdgeXindices.push(i)
    }
    if (x[i] === xMax) {
      rightEdgeXindices.push(i)
    }
  }

  const leftEdgeYValues = leftEdgeXindices.map((idx) => y[idx])
  const uniqueLeftEdgeYvalues = leftEdgeYValues.filter((v, i) => leftEdgeYValues.indexOf(v) === i)
  const sortedLeftYvalues = uniqueLeftEdgeYvalues.sort((a, b) => (a < b ? -1 : (b < a) | 0))

  const rightEdgeYValues = rightEdgeXindices.map((idx) => y[idx])
  const uniqueRightEdgeYvalues = rightEdgeYValues.filter((v, i) => rightEdgeYValues.indexOf(v) === i)
  const sortedRightYvalues = uniqueRightEdgeYvalues.sort((a, b) => (a < b ? -1 : (b < a) | 0))

  const leftMinYIdx = leftEdgeXindices[getIndexOf(sortedLeftYvalues[0], leftEdgeYValues)]
  const rightMinYIdx = rightEdgeXindices[getIndexOf(sortedRightYvalues[0], rightEdgeYValues)]
  const yMin = Math.max(...getValuesBetweenIndices(y, leftMinYIdx, rightMinYIdx)) + 1

  const leftMaxYIdx = leftEdgeXindices[getIndexOf(sortedLeftYvalues[sortedLeftYvalues.length - 1], leftEdgeYValues)]
  const rightMaxYIdx =
    rightEdgeXindices[getIndexOf(sortedRightYvalues[sortedRightYvalues.length - 1], rightEdgeYValues)]
  const yMax = Math.min(...getValuesBetweenIndices(y, rightMaxYIdx, leftMaxYIdx)) - 1

  if (sortedLeftYvalues.length > 2 || sortedRightYvalues.length > 2) {
    const xCoordinate = 0.5 * (xMin + xMax)

    const firstYmin = yMin
    let firstYmax = Math.min(sortedLeftYvalues[1], sortedRightYvalues[1]) - 1
    let secondYmin =
      Math.max(sortedLeftYvalues[sortedLeftYvalues.length - 2], sortedRightYvalues[sortedRightYvalues.length - 2]) + 1

    const secondYmax = yMax
    if (secondYmin - firstYmax < shortSideBuffer) {
      secondYmin = firstYmax + shortSideBuffer
    }

    if (firstYmin > firstYmax) {
      return [
        [
          [xCoordinate, secondYmin],
          [xCoordinate, secondYmax],
        ],
      ]
    }
    if (secondYmin > secondYmax) {
      return [
        [
          [xCoordinate, firstYmin],
          [xCoordinate, firstYmax],
        ],
      ]
    }

    return [
      [
        [xCoordinate, firstYmin],
        [xCoordinate, firstYmax],
      ],
      [
        [xCoordinate, secondYmin],
        [xCoordinate, secondYmax],
      ],
    ]
  } else {
    if (yMin > yMax) {
      return []
    }
    const xCoordinate = 0.5 * (xMin + xMax)

    return [
      [
        [xCoordinate, yMin],
        [xCoordinate, yMax],
      ],
    ]
  }
}

export function convertShiftFactor(shift) {
  return mod(shift / 100 + 0.5, 1.0)
}

export function boundingBoxToBuildings(
  bbox,
  buildingWidth,
  buildingLimit,
  longSideBuffer,
  shortSideBuffer,
  shiftFactor,
) {
  const y_max = bbox["yMax"]
  const y_min = bbox["yMin"]
  const cellWidth = longSideBuffer + buildingWidth
  const span = bbox["xMax"] - bbox["xMin"] - shiftFactor * cellWidth
  const n = Math.floor((span + longSideBuffer) / cellWidth)
  const buildings = []
  let xPosition = bbox["xMin"] + shiftFactor * cellWidth
  for (let i = 0; i < n; i++) {
    let p1 = [xPosition, y_min]
    let p2 = [xPosition + buildingWidth, y_min]
    let p3 = [xPosition + buildingWidth, y_max]
    let p4 = [xPosition, y_max]
    const rect = [p1, p2, p3, p4]
    let temp = []
    try {
      temp = polygonClipping.intersection([rect], [buildingLimit])
    } catch {
      temp = []
    }
    for (let j = 0; j < temp.length; j++) {
      let buildingPointsList = clipBuilding(temp[j][0], shortSideBuffer, buildingWidth)
      buildingPointsList.forEach((buildingPoints) => {
        if (distance(buildingPoints[0], buildingPoints[1]) > 20) {
          buildings.push(buildingPoints)
        }
      })
    }
    xPosition += cellWidth
  }

  return buildings
}

export function lineOfPointsToVerticesEdges(points, props) {
  let edges = {}
  let vertices = {}
  if (points.length === 0) return { edges, vertices }
  let circledBuilding = false
  if (distance(points[0], points[points.length - 1]) < 0.001) {
    points.pop()
    circledBuilding = true
  }

  for (let i = 0; i < points.length; i++) {
    const vertex = { id: uuidv4(), x: points[i][0], y: points[i][1], ...props }
    vertices[vertex.id] = vertex
  }
  for (let i = 0; i < Object.keys(vertices).length - 1; i++) {
    const edge = {
      id: uuidv4(),
      start: Object.keys(vertices)[i],
      end: Object.keys(vertices)[i + 1],
      ...props,
    }
    edges[edge.id] = edge
  }

  if (circledBuilding) {
    const edge = {
      id: uuidv4(),
      start: Object.keys(vertices)[Object.keys(vertices).length - 1],
      end: Object.keys(vertices)[0],
      ...props,
    }
    edges[edge.id] = edge
  }

  return { vertices, edges }
}

function getValuesBetweenIndices(array, idx1, idx2) {
  if (idx2 === array.length - 1) {
    return array.slice(1)
  } else if (idx2 >= idx1) {
    return array.slice(idx1, idx2 + 1)
  } else {
    return [...array.slice(idx1), ...array.slice(0, idx2 + 1)]
  }
}
