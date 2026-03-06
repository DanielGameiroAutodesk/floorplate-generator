import {
  getBbox,
  getBoundingPolygon,
  getCenterOfMass,
  pointPointDistance,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import {
  affineMultiply,
  createRotateAffine,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/affineHelpers.js"
import { mod } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/numpy.js"

export function buildGridBoxForAngle(angle, buildingLimits) {
  const bbOrg = getBbox(buildingLimits)
  const affine = createRotateAffine(angle, [(bbOrg.xMin + bbOrg.xMax) / 2, (bbOrg.yMin + bbOrg.yMax) / 2])
  const { xMin, xMax, yMin, yMax } = getBbox(
    [getBoundingPolygon(buildingLimits.map((bl) => bl.map((p) => affineMultiply(p, affine))))],
    50,
  )
  const width = xMax - xMin
  const height = yMax - yMin
  return {
    angle,
    originPoint: [xMin, yMin],
    boxWidth: width,
    boxHeight: height,
  }
}

function buildGridBoxCoveringAtAllAngles(buildingLimits) {
  const BUFFER = 10
  const boundingPolygon = getBoundingPolygon(buildingLimits)
  const pivotPoint = getCenterOfMass(boundingPolygon)
  const maxDistanceToPivot = Math.max(
    ...buildingLimits
      .map((buildingLimit) => buildingLimit.map((point) => pointPointDistance(point, pivotPoint)))
      .flat(),
  )
  return {
    originPoint: [pivotPoint[0] - maxDistanceToPivot - BUFFER, pivotPoint[1] - maxDistanceToPivot - BUFFER],
    boxWidth: (maxDistanceToPivot + BUFFER) * 2,
    boxHeight: (maxDistanceToPivot + BUFFER) * 2,
    angle: 0,
  }
}

export function getDefaultStructure(technique, buildingLimits) {
  if (technique === "grid") {
    return {
      dx: 80,
      dy: 80,
      ...buildGridBoxCoveringAtAllAngles(buildingLimits),
    }
  } else if (technique === "voronoi") {
    const box = buildGridBoxForAngle(0, buildingLimits)
    const dx = Math.min(95, box.boxWidth / 2)
    const dy = Math.min(95, box.boxHeight / 2)
    const numHorizontal = Math.max(Math.floor(box.boxWidth / dx) - 1, 1)
    const numVertical = Math.max(Math.floor(box.boxHeight / dy) - 1, 1)
    const startX = box.originPoint[0] + (box.boxWidth - numHorizontal * dx) / 2 + dx / 4
    const startY = box.originPoint[1] + (box.boxHeight - numVertical * dy) / 2 + dy / 4
    const numPoints = numHorizontal * numVertical
    const points =
      numPoints >= 3
        ? Array(numPoints)
            .fill()
            .map((_, i) => {
              const r = Math.floor(i / numHorizontal)
              const shift = r % 2 === 0 ? 0.5 : 0
              const c = (i % numHorizontal) + shift
              return [startX + c * dx, startY + r * dy]
            })
        : [
            [box.originPoint[0] + box.boxWidth / 3, box.originPoint[1] + box.boxHeight / 3],
            [box.originPoint[0] + (box.boxWidth * 2) / 3, box.originPoint[1] + box.boxHeight / 3],
            [box.originPoint[0] + box.boxWidth / 2, box.originPoint[1] + (box.boxHeight * 2) / 3],
          ]
    return {
      points,
      size: 4000,
      ...box,
    }
  } else {
    return {}
  }
}

export function getNewGridPoints(oldStructure) {
  const { originPoint, boxWidth, boxHeight } = oldStructure
  const numPoints = oldStructure.points.length
  const root = Math.sqrt(numPoints)
  let dx, dy, xPoints, yPoints
  let points = []

  if (!(boxWidth / boxHeight > 1.3 || boxHeight / boxWidth > 1.3)) {
    xPoints =
      numPoints - Math.pow(Math.floor(root), 2) < Math.pow(Math.ceil(root), 2) - numPoints
        ? Math.floor(root)
        : Math.ceil(root)
    yPoints = xPoints
    dx = boxWidth / (xPoints + 1)
    dy = boxHeight / (xPoints + 1)
  } else if (boxWidth < boxHeight) {
    yPoints = Math.ceil(root)
    const factor = numPoints / yPoints
    xPoints =
      numPoints - Math.floor(factor) * yPoints < Math.ceil(factor) * yPoints - numPoints
        ? Math.floor(factor)
        : Math.ceil(factor)
    dx = boxWidth / (xPoints + 1)
    dy = boxHeight / (yPoints + 1)
  } else {
    xPoints = Math.ceil(root)
    const factor = numPoints / xPoints
    yPoints =
      numPoints - Math.floor(factor) * xPoints < Math.ceil(factor) * xPoints - numPoints
        ? Math.floor(factor)
        : Math.ceil(factor)
    dx = boxWidth / (xPoints + 1)
    dy = boxHeight / (yPoints + 1)
  }
  for (let i = 1; i <= xPoints; i++) {
    for (let j = 1; j <= yPoints; j++) {
      points.push([originPoint[0] + i * dx, originPoint[1] + j * dy])
    }
  }

  return points
}

export function convertStructureAngleToCellAngle(structureAngle) {
  let modStructureAngle
  if (structureAngle < 0) {
    modStructureAngle = mod(-structureAngle, Math.PI) / Math.PI
  } else {
    modStructureAngle = -mod(structureAngle, Math.PI) / Math.PI
  }
  return mod(0.5 + modStructureAngle, 1)
}
