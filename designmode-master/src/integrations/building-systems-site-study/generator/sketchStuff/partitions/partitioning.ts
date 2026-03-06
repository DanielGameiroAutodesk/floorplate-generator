import { generateGridGraph } from "./generateGrids"
import { getConvexRefinedPartition } from "./convexPartitionGenerator"
import { generateVoronoiCellGraph } from "./voronoi"
import { polygonArea } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry"
import { buildGridBoxForAngle } from "./structureHelpers"
import { samplePointsInPolygonDeterministically } from "./sampleDeterministically"
import { stabilizeVoronoiStructure } from "./generateVoronoiPartitions"

export type CellTechnique = "voronoi" | "convex" | "grid"

type Polygon = Point[]
type Point = [number, number]

export function getCellGraph(
  cellTechnique: CellTechnique,
  polygons: Polygon[],
  streetWidth: number,
  maxCellArea: number = 3500,
) {
  if (cellTechnique === "voronoi") {
    return generateVoronoiGraph(polygons, streetWidth)
  } else if (cellTechnique === "grid") {
    return generateGridGraph(polygons, streetWidth)
  } else if (cellTechnique === "convex") {
    return getConvexRefinedPartition(polygons, streetWidth, maxCellArea)
  }
  return { vertices: {}, edges: {} }
}

export function generateVoronoiGraph(polygons: Polygon[], streetWidth: number) {
  const cellGraphs = polygons.map((polygon) => {
    let stabilizedStructure = getVoronoiStructure(polygon)
    for (let i = 0; i < 20; i++) {
      stabilizedStructure = stabilizeVoronoiStructure([polygon], stabilizedStructure, streetWidth)
    }
    return generateVoronoiCellGraph({
      structure: stabilizedStructure,
      streetWidth,
      buildingLimits: [polygon],
    })
  })
  return cellGraphs.reduce(
    (acc, g) => ({ vertices: { ...acc.vertices, ...g.vertices }, edges: { ...acc.edges, ...g.edges } }),
    { vertices: {}, edges: {} },
  )
}

const MIN_AREA = 5000
const MAX_AREA = 7000

function getVoronoiStructure(polygon: Polygon) {
  const minNumPoints = Math.round(polygonArea(polygon) / MAX_AREA)
  const maxNumPoints = Math.round(polygonArea(polygon) / MIN_AREA)
  const box = buildGridBoxForAngle(0, [polygon])
  const numPoints = Math.floor((minNumPoints + maxNumPoints) / 2)
  const points = samplePointsInPolygonDeterministically(polygon).slice(0, numPoints)

  return {
    points,
    ...box,
  }
}
