export type Point = [number, number]

export type Polygon = Point[]

type clockWisePolygon = Polygon
type Holes = clockWisePolygon[]

export type PolygonWithHoles = {
  polygon: Polygon
  holes: Holes
}

export type SimpleUnit = {
  type?: "LIVING_UNIT" | "CORE" | "CORRIDOR"
} & PolygonWithHoles
