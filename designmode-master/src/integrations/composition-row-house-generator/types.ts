export type Point = [number, number]

export type Polygon = Point[]

export type Yard = {
  polygons: Polygon[]
}

export type PointXY = { x: number; y: number }
export type PolygonXY = PointXY[]
export type Window = {
  width: number
  elevation: number
  height: number
  s: number
  id: string
}

export type Door = {
  width: number
  height: number
  s: number
  id: string
}

type LineAlignment = "left" | "center" | "right"

export type Wall = {
  startPoint: PointXY
  endPoint: PointXY
  width: number
  lineAlignment: LineAlignment
  type: string
  id: string
  windows: Record<string, Window>
  doors?: Record<string, Door>
}
export type Walls = Record<string, Wall>
type Coordinates = [number, number][][]
export type BuildingBlock = {
  coordinates: Coordinates
  elevation: number
  height: number
  structureType: string
}
