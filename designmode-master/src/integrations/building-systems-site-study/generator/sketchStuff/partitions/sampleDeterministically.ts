import { makeAreaPositionField } from "src/integrations/basic-elements/trees/area/areaTreePositions"

export function samplePointsInPolygonDeterministically(polygon: [number, number][]): [number, number][] {
  return makeAreaPositionField(
    polygon.map(([x, y]) => ({
      x,
      y,
    })),
    20,
  ).map(({ x, y }) => [x, y])
}
