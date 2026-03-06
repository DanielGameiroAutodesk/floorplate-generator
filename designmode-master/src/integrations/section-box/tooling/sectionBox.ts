import type { ExtrudedPolygonFeature } from "src/lib/geometry/geometryTypes"
import { Geometry25D } from "src/lib/three/Geometry25D"
import type { Matrix4 } from "three"
import { Vector3 } from "three"

export type SectionBox = ExtrudedPolygonFeature

const transform = (x: number, previousMin: number, previousMax: number, newMin: number, newMax: number) => {
  return ((x - previousMin) / (previousMax - previousMin)) * (newMax - newMin) + newMin
}

export const bufferSectionBox = (box: SectionBox, buffer: number): SectionBox => {
  const minX = Math.min(...box.geometry.coordinates[0].map((c) => c[0]))
  const minY = Math.min(...box.geometry.coordinates[0].map((c) => c[1]))
  const maxX = Math.max(...box.geometry.coordinates[0].map((c) => c[0]))
  const maxY = Math.max(...box.geometry.coordinates[0].map((c) => c[1]))
  const newMinX = minX - buffer
  const newMinY = minY - buffer
  const newMaxX = maxX + buffer
  const newMaxY = maxY + buffer
  const newElevation = box.properties.elevation - buffer
  const newHeight = box.properties.height + 2 * buffer
  return {
    geometry: {
      type: "Polygon",
      coordinates: [
        box.geometry.coordinates[0].map((coords) => [
          transform(coords[0], minX, maxX, newMinX, newMaxX),
          transform(coords[1], minY, maxY, newMinY, newMaxY),
        ]),
      ],
    },
    properties: {
      elevation: newElevation,
      height: newHeight,
    },
    type: "Feature",
  }
}

export const constructBoxGeometryFromSectionBox = (box: SectionBox) => {
  const geometry = {
    coordinates: box.geometry.coordinates,
    height: box.properties.height,
    elevation: box.properties.elevation,
  }
  return new Geometry25D(geometry)
}

export const applyRotationToSectionBox = (sectionBox: SectionBox, affineMatrix: Matrix4) => {
  const vecs = sectionBox.geometry.coordinates[0].map(
    (corner) => new Vector3(corner[0], corner[1], sectionBox.properties.elevation + sectionBox.properties.height),
  )
  vecs.forEach((vec) => vec.applyMatrix4(affineMatrix))
  const coordinates = vecs.map((vec) => [vec.x, vec.y])
  return {
    ...sectionBox,
    geometry: {
      ...sectionBox.geometry,
      coordinates: [coordinates],
    },
  }
}

export const getSectionBoxMidPoint = (sectionBox: SectionBox | undefined) => {
  if (!sectionBox) return
  const [x1, y1] = sectionBox.geometry.coordinates[0][0]
  const [x2, y2] = sectionBox.geometry.coordinates[0][1]
  const [x3, y3] = sectionBox.geometry.coordinates[0][2]
  const [x4, y4] = sectionBox.geometry.coordinates[0][3]
  return new Vector3((x1 + x2 + x3 + x4) / 4, (y1 + y2 + y3 + y4) / 4, sectionBox.properties.elevation)
}
