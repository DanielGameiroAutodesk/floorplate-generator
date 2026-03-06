import type { FootPrint } from "./buildingBands.js"
import type { Point, PolygonWithHoles } from "./BuildingTypes.js"

export function polygonWithHolesXyToPolygon(footPrint: FootPrint) {
  const polygon = footPrint.polygon.map((point) => {
    return [point.x, point.y]
  })
  const holes = footPrint.holes.map((hole) =>
    hole.map((point) => {
      return [point.x, point.y] as Point
    }),
  )
  return { polygon, holes } as PolygonWithHoles
}
