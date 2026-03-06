import earcut from "earcut"
import { BufferAttribute, BufferGeometry } from "three"
import type { Feature, Polygon } from "geojson"
import { create2DLineGeoFromSegments } from "./2d-line"
import type { BasicLine } from "src/lib/geometry/geometryTypes"

import { categoryToDefaultLineWidth } from "src/lib/three/Shape/shapeUtils"

export function create2DPolygon(coordinates: number[][][], z: number = 0) {
  const holeIndexes = []
  let index = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    index += coordinates[i].length
    holeIndexes.push(index)
  }

  const points = coordinates.flat()
  const flatPoints: number[] = points.flat()
  const indices = earcut(flatPoints, holeIndexes)

  const position = new Float32Array(points.length * 3)
  for (let i = 0; i < points.length; i++) {
    position[i * 3] = points[i][0]
    position[i * 3 + 1] = points[i][1]
    position[i * 3 + 2] = z
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(position, 3))
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1))
  return geometry
}

export function featureAsPolygon(feature: Feature<Polygon>, z: number = 0) {
  return create2DPolygon(feature.geometry?.coordinates || [], z)
}

export function featureAsOutline(feature: BasicLine, isImperial: boolean, category?: string) {
  const xypairs = feature.geometry?.coordinates || []
  const lineWidth = feature.properties?.lineWidth || categoryToDefaultLineWidth(isImperial, category)
  return create2DLineGeoFromSegments(xypairs, lineWidth)
}
