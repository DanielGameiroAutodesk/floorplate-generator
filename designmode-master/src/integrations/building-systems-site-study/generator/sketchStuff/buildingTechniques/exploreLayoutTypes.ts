import { extendShortEdgesInPolygon, twoStepSimplification } from "./simplification.js"
import {
  getCityBlockWithGaps,
  getClosedCityBlock,
  getL_StyleCityBlock,
  getOneAngledTowerBuildings,
  getOpenCityBlock,
  getOpenCityBlockPointHouseMix,
  getSmileyBlock,
  getTwoAngledBuildings,
} from "./exploreLayoutTypes/cityBlockTemplates.js"
import { getOneAngledBuilding } from "./exploreLayoutTypes/oneAngledBuilding.js"
import { getAnglesInPolygon } from "./exploreLayoutTypes/templateHelpers.js"
import { getTowersAndAngles, getU_StyledCityBlock } from "./exploreLayoutTypes/cityBlockTemplates.js"
import {
  getRandomizedBuildings,
  getRowHouses,
  getShiftedBuildings,
  getBuildingsAlongTheEdges,
} from "./exploreLayoutTypes/smallSiteTemplates.js"
import { getShortLamellas } from "./exploreLayoutTypes/smallSiteTemplates.js"
import { getETypeBuildings, getFanBuildings } from "./exploreLayoutTypes/fanBuildings.js"
import { bufferPolygon } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/polygonBuffer.js"
import {
  getMidPoint,
  movePointAlongVector,
  removeLastPointInPolygonIfEqualsFirst,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import {
  distanceToPolygonBoundary,
  getNormalizedVectorFromPointToPoint,
} from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/helpers_2.js"
import { getPointBuildingsOnePolygon } from "src/integrations/building-systems-site-study/generator/sketchStuff/liveTechniques/pointBuildings.js"
import { getDominantAngleInPolygon } from "src/integrations/building-systems-site-study/generator/sketchStuff/helpers/geometry.js"
import type { SimpleGraph } from "src/integrations/building-systems-site-study/simpleGraph"

const MIN_DIST_FACTOR = 1.5

type Polygon = [number, number][]

function isPolygonSuitedForCityBlock(polygon: Polygon, buildingWidth: number, minDist: number) {
  const simplifiedPolygon = twoStepSimplification(polygon, buildingWidth, Math.PI / 6, 3.0 * buildingWidth)
  if (!simplifiedPolygon.length) {
    return false
  }

  const cortYardPolygons: Polygon[] = bufferPolygon(simplifiedPolygon, buildingWidth)
  if (!cortYardPolygons.length) return false
  const cortYardPolygon = cortYardPolygons[0].slice(1)
  const angles = getAnglesInPolygon(cortYardPolygon)
  const coarseCortYard = cortYardPolygon.filter((p, i) => Math.abs(angles[i]) > (15 * Math.PI) / 180)

  const n = coarseCortYard.length
  for (let i = 0; i < coarseCortYard.length; i++) {
    const [p1, p2] = [coarseCortYard[i], coarseCortYard[(i + 1) % n]]
    const midPoint = getMidPoint(p1, p2)
    const vec = getNormalizedVectorFromPointToPoint(p1, p2)
    const normVec = [-vec[1], vec[0]]
    const dist = distanceToPolygonBoundary(normVec, movePointAlongVector(midPoint, normVec, 0.1), coarseCortYard)
    if (dist < minDist) {
      return false
    }
  }
  return true
}

export function preparePolygonForCityBlock(polygon: Polygon, buildingWidth: number) {
  const simplifiedPolygon = twoStepSimplification(polygon, buildingWidth, Math.PI / 6, 3.0 * buildingWidth)
  if (!simplifiedPolygon.length) {
    return []
  }

  const bufferedPolygons = bufferPolygon(simplifiedPolygon, 0.5 * buildingWidth)
  if (!bufferedPolygons.length) {
    return []
  }
  const bufferedPolygon = removeLastPointInPolygonIfEqualsFirst(bufferedPolygons[0])
  const resPolygon = extendShortEdgesInPolygon(bufferedPolygon, buildingWidth, buildingWidth, buildingWidth).polygon
  return resPolygon
}

export function getValidExploreLayoutTypes(polygon: Polygon, buildingWidth: number, pointBuildingWidth: number) {
  const validTypes = ["fanBuildings", "eTypeLamellas"]
  validTypes.push(
    "shiftedShortLamellas",
    "rowHouses",
    "shortLamellas",
    "shiftedPointBuildings",
    "buildingsAlongTheEdges",
  )

  if (!isPolygonSuitedForCityBlock(polygon, buildingWidth, MIN_DIST_FACTOR * buildingWidth)) {
    validTypes.push("randomizedBuildings")
    validTypes.push("randomizedPointBuildings")
    return validTypes
  }

  const simplifiedPolygon = twoStepSimplification(polygon, buildingWidth, Math.PI / 6, 3.0 * buildingWidth)
  if (!simplifiedPolygon.length) return validTypes

  validTypes.push("oneAngled")

  validTypes.push(
    "twoAngled",
    "openCityBlock",
    "closedCityBlock",
    "oneAngledTower",
    "cityBlocksWithGaps",
    "L_StyleCityBlock",
    "smileyBlock",
  )

  if (!isPolygonSuitedForCityBlock(polygon, pointBuildingWidth, MIN_DIST_FACTOR * buildingWidth)) return validTypes

  validTypes.push("openCityBlockPointHouseMix")

  return validTypes
}

///
/// cell filler
///

export function fillCellWithExploreLayoutType(
  polygon: Polygon,
  templateType: string,
  stories: number,
  buildingWidth: number,
  pointBuildingWidth: number,
): SimpleGraph {
  const gapSize = MIN_DIST_FACTOR * buildingWidth
  const dominantAngle = getDominantAngleInPolygon(polygon) / 180
  switch (templateType) {
    case "fanBuildings":
      return getFanBuildings(polygon, stories, buildingWidth)
    case "eTypeLamellas":
      return getETypeBuildings(polygon, stories, buildingWidth)
    case "POINT_BUILDINGS":
      return getPointBuildingsOnePolygon(polygon, stories, pointBuildingWidth, dominantAngle, 10, 0)
    case "randomizedBuildings":
      return getRandomizedBuildings(
        polygon,
        buildingWidth,
        1.5 * buildingWidth,
        2.3 * buildingWidth,
        gapSize,
        gapSize / 4,
        stories,
      )
    case "randomizedPointBuildings":
      return getRandomizedBuildings(
        polygon,
        pointBuildingWidth,
        pointBuildingWidth,
        pointBuildingWidth,
        0.6 * pointBuildingWidth,
        0.6 * pointBuildingWidth,
        stories,
      )
    case "rowHouses":
      return getRowHouses(polygon)
    case "shiftedShortLamellas":
      return getShiftedBuildings(
        polygon,
        buildingWidth,
        1.34 * buildingWidth,
        buildingWidth,
        buildingWidth,
        0.2,
        stories,
      )
    case "shiftedPointBuildings":
      return getShiftedBuildings(polygon, pointBuildingWidth, pointBuildingWidth, gapSize, gapSize, 0.3, stories)
    case "shortLamellas":
      return getShortLamellas(
        polygon,
        buildingWidth,
        1.2 * buildingWidth,
        2.4 * buildingWidth,
        buildingWidth,
        buildingWidth,
        stories,
      )
    case "buildingsAlongTheEdges":
      return getBuildingsAlongTheEdges(polygon, buildingWidth, buildingWidth, 1.5 * buildingWidth, stories)
    case "oneAngled":
      return getOneAngledBuilding(polygon, buildingWidth, stories) as SimpleGraph
    case "twoAngled":
      return getTwoAngledBuildings(polygon, buildingWidth, stories) as SimpleGraph
    case "openCityBlock":
      return getOpenCityBlock(polygon, buildingWidth, gapSize, stories, false)
    case "openCityBlockPointHouseMix":
      return getOpenCityBlockPointHouseMix(polygon, buildingWidth, pointBuildingWidth, gapSize, stories, false)
    case "closedCityBlock":
      return getClosedCityBlock(polygon, buildingWidth, stories) as SimpleGraph
    case "oneAngledTower":
      return getOneAngledTowerBuildings(polygon, buildingWidth, pointBuildingWidth, stories)
    case "smileyBlock":
      return getSmileyBlock(polygon, buildingWidth, gapSize, stories)
    case "cityBlocksWithGaps":
      return getCityBlockWithGaps(polygon, buildingWidth, gapSize, stories) as SimpleGraph
    case "L_StyleCityBlock":
      return getL_StyleCityBlock(polygon, buildingWidth, gapSize, stories)
    case "U_StyledCityBlock":
      return getU_StyledCityBlock(polygon, buildingWidth, gapSize, stories)
    case "TowersAndAngles": // WIP
      return getTowersAndAngles(polygon, buildingWidth, gapSize, pointBuildingWidth, stories)
    default:
      return { vertices: {}, edges: {} }
  }
}
