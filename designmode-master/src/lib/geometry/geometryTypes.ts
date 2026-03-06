import type { Feature, LineString, Polygon } from "geojson"

export type ExtrudedPolygonFeature = Feature<Polygon, { height: number; elevation: number }>
export type BasicLine = Feature<LineString, { lineWidth?: number }>
export type BasicFeature = Feature<Polygon> | BasicLine | ExtrudedPolygonFeature

export function isBasicFeature(feature: Feature): feature is BasicFeature {
  return (
    feature &&
    feature.geometry &&
    (feature.geometry.type === "LineString" || feature.geometry.type === "Polygon" || isExtrudedPolygon(feature))
  )
}

export function isExtrudedPolygon(geojson: Feature): geojson is ExtrudedPolygonFeature {
  return (
    !!geojson &&
    geojson.geometry.type === "Polygon" &&
    !!geojson.properties &&
    "height" in geojson.properties &&
    "elevation" in geojson.properties
  )
}

export type Coord2D = [number, number]
export type Segment2D = [Coord2D, Coord2D]
export type Coord3D = [number, number, number]
export type Segment = [Coord3D, Coord3D]
export type Vec3 = { x: number; y: number; z: number }

export function segmentToSegment2D(segment: Segment): Segment2D {
  return segment.map(([x, y]) => [x, y] as Coord2D) as Segment2D
}
