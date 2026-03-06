export type PointXY = { x: number; y: number }
export type PolygonXY = PointXY[]
export type PolygonWithHolesXY = { polygon: PolygonXY; holes: PolygonXY[] }
