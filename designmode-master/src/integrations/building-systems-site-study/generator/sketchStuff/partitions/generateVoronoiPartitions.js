import { getCellsWithPolygons } from "src/integrations/building-systems-site-study/generator/sketchStuff/cells/cellHelpers.js"
import {
  closedPolygonCentroid,
  polygonArea,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import { generateVoronoiCellGraph } from "./voronoi.js"
import { buildGridBoxForAngle } from "./structureHelpers.js"
import {
  affineMultiply,
  createRotateAffine,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/affineHelpers.js"
import { samplePointInPolygon } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/samplePoints.js"

const MIN_AREA = 5000
const MAX_AREA = 7000

export function stabilizeVoronoiStructure(buildingLimits, structure, streetWidth) {
  const cellGraph = generateVoronoiCellGraph({
    structure,
    streetWidth,
    buildingLimits,
  })
  const cellsWithPolygons = getCellsWithPolygons(cellGraph, buildingLimits, false)
  const rotation = createRotateAffine(structure.angle, [
    structure.originPoint[0] + structure.boxWidth / 2,
    structure.originPoint[1] + structure.boxHeight / 2,
  ])
  const newPoints = cellsWithPolygons
    .sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon))
    .sort((a, b) => polygonArea(b.polygon) - polygonArea(a.polygon))
    .map((cell) => closedPolygonCentroid(cell.polygon))
    .slice(0, structure.points.length)
    .map((p) => affineMultiply(p, rotation))
  return { ...structure, points: newPoints }
}

function getVoronoiStructure(buildingLimit) {
  const minNumPoints = Math.round(polygonArea(buildingLimit) / MAX_AREA)
  const maxNumPoints = Math.round(polygonArea(buildingLimit) / MIN_AREA)
  const box = buildGridBoxForAngle(0, [buildingLimit])
  const numPoints = minNumPoints + Math.floor(Math.random() * (maxNumPoints - minNumPoints + 1))
  const points = Array(numPoints)
    .fill()
    .map(() => samplePointInPolygon(buildingLimit))
  return {
    points,
    ...box,
  }
}

export function generateVoronoiGraph(buildingLimits, streetWidth) {
  const cellGraphs = buildingLimits.map((bl) => {
    let stabilizedStructure = getVoronoiStructure(bl)
    for (let i = 0; i < 20; i++) {
      stabilizedStructure = stabilizeVoronoiStructure([bl], stabilizedStructure, streetWidth)
    }
    return generateVoronoiCellGraph({
      structure: stabilizedStructure,
      streetWidth,
      buildingLimits: [bl],
    })
  })
  return cellGraphs.reduce(
    (acc, g) => ({ vertices: { ...acc.vertices, ...g.vertices }, edges: { ...acc.edges, ...g.edges } }),
    { vertices: {}, edges: {} },
  )
}
