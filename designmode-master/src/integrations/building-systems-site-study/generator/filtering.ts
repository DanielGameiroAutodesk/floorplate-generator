import { round } from "src/lib/math/round"
import type { SiteStudy } from "./siteStudySpec"

export function hash(siteStudyBuildings: SiteStudy["simpleBuildings"]): string {
  const firstFloors = siteStudyBuildings.map((b) => b.floors[0])
  const outerShapes = firstFloors.flatMap((f) => f.outerShapes.map((outerShape) => outerShape.polygon))
  const middleOfOuterShapeHashes = outerShapes
    .flatMap((outerShape) => {
      return outerShape
        .reduce((acc, p) => [acc[0] + p[0] / outerShape.length, acc[1] + p[1] / outerShape.length], [0, 0])
        .map((p) => round(p, 2))
        .map((p) => JSON.stringify(p))
    })
    .sort()
  return JSON.stringify(middleOfOuterShapeHashes)
}
