import { polygonArea } from "./helpers/geometry.js"
import { generateGridGraph } from "./partitions/generateGrids.js"
import { generateVoronoiGraph } from "./partitions/generateVoronoiPartitions.js"
import { getConvexRefinedPartition } from "./partitions/convexPartitionGenerator.js"
import { deepCopy } from "./helpers/helpers.js"
import { getCellPolygonsFromDivisionLinesGraphV2 } from "./sharedDivisionLinesV2/cells.js"
import { fillCellWithExploreLayoutType, getValidExploreLayoutTypes } from "./buildingTechniques/exploreLayoutTypes.js"
import { getGraphBuildings3000 } from "./graph/buildify.js"
import type { Edges, Vertices } from "src/integrations/building-systems-site-study/simpleGraph.js"
import type { SiteStudyInput } from "src/integrations/building-systems-site-study/generator/siteStudySpec.js"
import type { SimpleBuilding } from "src/integrations/building-systems-simple-buildings/simpleBuilding.js"

type SimpleGraph = {
  vertices: Vertices
  edges: Edges
}

export const EXPLORE_LAYOUT_TYPES = [
  "oneAngled",
  "twoAngled",
  "openCityBlock",
  "closedCityBlock",
  "oneAngledTower",
  "smileyBlock",
  "cityBlocksWithGaps",
  "L_StyleCityBlock",
  "openCityBlockPointHouseMix",
  "fanBuildings",
  "eTypeLamellas",
]

type Polygon = [number, number][]
export type CellTechnique = "voronoi" | "grid" | "convex"

export function getValidBuildingTechniques(polygons: Polygon[], buildingWidth: number, pointBuildingWidth: number) {
  if (polygons.length === 0) return []
  return [...getValidExploreLayoutTypes(polygons[0], buildingWidth, pointBuildingWidth), "POINT_BUILDINGS"]
}

export function getCellGraph(
  cellTechnique: CellTechnique,
  studyPolygon: Polygon,
  streetWidth: number,
  maxCellArea: number,
): SimpleGraph {
  switch (cellTechnique) {
    case "voronoi":
      return generateVoronoiGraph([studyPolygon], streetWidth)
    case "grid":
      return generateGridGraph([studyPolygon], streetWidth)
    case "convex":
      return getConvexRefinedPartition([studyPolygon], streetWidth, maxCellArea)
  }
}

export function fillCellWithRandomBuildingTechnique(
  polygon: Polygon,
  buildingWidth: number,
  pointBuildingWidth: number,
  stories: number,
  candidateTechniques: string[],
) {
  const validTechniques = getValidBuildingTechniques([polygon], buildingWidth, pointBuildingWidth)
  const validCandidateTechniques = candidateTechniques.filter((technique) => validTechniques.includes(technique))
  const technique = validCandidateTechniques[Math.floor(Math.random() * validCandidateTechniques.length)] || ""

  if (technique === "") {
    return { vertices: {}, edges: {}, emptyArea: polygonArea(polygon) }
  }

  const { vertices, edges } = fillCellWithExploreLayoutType(
    polygon,
    technique,
    stories,
    buildingWidth,
    pointBuildingWidth,
  )
  return { vertices, edges, technique }
}

function getLayoutTypes(
  exploreLayoutTypes: string[],
  cellPolygons: Polygon[],
  buildingWidth: number,
  pointBuildingWidth: number,
) {
  const validLayoutTypes: string[] = []
  cellPolygons.forEach((polygon) =>
    validLayoutTypes.push(...getValidBuildingTechniques([polygon], buildingWidth, pointBuildingWidth)),
  )
  const validExploreLayoutTypes = exploreLayoutTypes.filter((type) => validLayoutTypes.includes(type))
  const layoutTypes = deepCopy(validExploreLayoutTypes)
  if (validExploreLayoutTypes.length <= 4 && exploreLayoutTypes.includes("fanBuildings")) {
    layoutTypes.push("shortLamellas")
  }
  if (exploreLayoutTypes.includes("shiftedBuildings")) {
    const randomDraw = Math.random() * 3
    if (randomDraw < 2) layoutTypes.push("shiftedShortLamellas")
    if (randomDraw > 1) layoutTypes.push("shiftedPointBuildings")
  }
  if (
    validExploreLayoutTypes.length <= 4 &&
    (exploreLayoutTypes.includes("oneAngled") || exploreLayoutTypes.includes("twoAngled"))
  ) {
    layoutTypes.push("buildingsAlongTheEdges")
  }
  if (exploreLayoutTypes.includes("twoAngled")) layoutTypes.push("L_StyleCityBlock")
  if (
    exploreLayoutTypes.includes("fanBuildings") &&
    (!validLayoutTypes.includes("closedCityBlock") || cellPolygons.length === 1)
  )
    layoutTypes.push("randomizedBuildings")

  if (
    exploreLayoutTypes.includes("POINT_BUILDINGS") &&
    (!validLayoutTypes.includes("closedCityBlock") || cellPolygons.length === 1)
  )
    layoutTypes.push("randomizedPointBuildings")
  return layoutTypes
}

function pickCellTechnique(): CellTechnique {
  const randomNumber = Math.random()
  if (randomNumber < 0.3) return "voronoi"
  if (randomNumber < 0.6) return "convex"
  return "grid"
}

export function generateSiteStudy({ studyPolygon, parameters }: SiteStudyInput) {
  const { buildingWidth, pointBuildingWidth, siteBuffer, avgStories: stories } = parameters
  const studyPolygonMapped = studyPolygon.map((point) => [point.x, point.y] as [number, number])

  const cellTechnique = pickCellTechnique()
  const maxCellArea = 8000

  const cellGraph = getCellGraph(cellTechnique, studyPolygonMapped, siteBuffer, maxCellArea)
  const cellPolygons = getCellPolygonsFromDivisionLinesGraphV2(cellGraph, studyPolygonMapped)

  const vertices: Vertices = {}
  const edges: Edges = {}

  const exploreLayoutTypes = Object.keys(parameters.layoutTypes).filter(
    (type) => parameters.layoutTypes[type as keyof typeof parameters.layoutTypes],
  )
  const layoutTypes = getLayoutTypes(exploreLayoutTypes, cellPolygons, buildingWidth, pointBuildingWidth)
  const candidateTechniques = layoutTypes.sort(() => 0.5 - Math.random()).slice(0, 3)

  const parkAreas: { outerLimit: Polygon; buildingFootPrints: Polygon[] }[] = []
  const simpleBuildings: SimpleBuilding[] = []
  cellPolygons.forEach((polygon) => {
    const buildings = fillCellWithRandomBuildingTechnique(
      polygon,
      buildingWidth,
      pointBuildingWidth,
      stories,
      candidateTechniques,
    )
    if (buildings.technique) {
      Object.values(buildings.vertices).forEach((vertex) => (vertices[vertex.id] = vertex))
      Object.values(buildings.edges).forEach((edge) => (edges[edge.id] = edge))

      const buildingFootPrints = getGraphBuildings3000(buildings).flatMap((building) => {
        return Object.values(building.graphExteriors as Record<string, Polygon>)
      })
      parkAreas.push({ outerLimit: polygon, buildingFootPrints })
      for (let polygon of buildingFootPrints) {
        const outerShapes = [{ polygon, holes: [] }]
        const floors = []
        for (let i = 0; i < parameters.avgStories; i++) {
          floors.push({ outerShapes, height: 3 })
        }
        simpleBuildings.push({ floors })
      }
    }
  })
  return {
    roadGraph: cellGraph,
    simpleBuildings,
    parkAreas,
  }
}
