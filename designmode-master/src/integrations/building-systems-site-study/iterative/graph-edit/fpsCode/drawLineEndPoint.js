import { snapPointToWallsOrGrid } from "./snapping"
import { getLinesFromGraph } from "./utils/graphUtils" // eslint-disable-line import/no-internal-modules
import { getDrawLineGuidelines } from "./drawLineGuideLines"

export function getDrawLineEndPoint(mousePositionSpace, startPointSpace, wallGraph, snappingDist, snappingRules) {
  const walls = getLinesFromGraph(wallGraph)
  const guidelines = getDrawLineGuidelines({ startPointSpace, wallGraph, snappingRules })

  return snapPointToWallsOrGrid({
    point: mousePositionSpace,
    walls,
    snappingDist,
    snappingRules,
    guidelines,
  })
}
