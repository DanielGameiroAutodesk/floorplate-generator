import { polygonArea, getPolygonDifference } from "./geometry.js"
import { getDivisionLinePolygonsFromGraph } from "./divisionLinePolygons.js"
import { polygonInPolygon, snapPointsAndSplitLoops } from "./PolygonUtils.js"
import type { SimpleGraph } from "src/integrations/building-systems-site-study/simpleGraph"

type Polygon = [number, number][]
type DivisionLinePolygon = {
  rings: Polygon[]
  polygon: Polygon
}

function getCellPolygonsFromDivisionLinePolygons(studyPolygon: Polygon, divisionLinePolygons: DivisionLinePolygon[]) {
  const cellPolygons = getPolygonDifference(studyPolygon, divisionLinePolygons)

  cellPolygons.sort((a, b) => polygonArea(a) - polygonArea(b))
  const cellPolygonsWithoutHoles: Polygon[] = cellPolygons
    .filter((candidatePolygon, i) => !cellPolygons.slice(i + 1).some((cp) => polygonInPolygon(candidatePolygon, cp)))
    .flatMap((p) => snapPointsAndSplitLoops(p, 0.1))
    .filter((p) => p.length > 2)

  return cellPolygonsWithoutHoles
}

export function getCellPolygonsFromDivisionLinesGraphV2(graph: SimpleGraph, studyPolygon: Polygon) {
  const divisionLinePolygons = getDivisionLinePolygonsFromGraph(graph)
  return getCellPolygonsFromDivisionLinePolygons(studyPolygon, divisionLinePolygons)
}
