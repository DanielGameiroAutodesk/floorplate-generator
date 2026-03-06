import type { ElementContainer } from "src/core/elements/ElementContainer"
import type { Box3 } from "three"
import { Box2, Vector2 } from "three"
import { createDerivedDataController } from "src/core/elements/derived-data/derived-data"
import { getTerrainCustomData } from "src/core/elements/terrain-data"

export const bboxController = createDerivedDataController(calculateBbox)

function calculateBbox(container: ElementContainer): Box3 | Box2 | undefined {
  // Terrain mesh is currently not stored on "ElementRepresentations"
  const terrainData = getTerrainCustomData(container)
  if (terrainData) {
    const geometry = terrainData.mesh.geometry
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    return geometry.boundingBox!
  }

  const volumeMesh = container.representations.volumeMesh

  if (volumeMesh) {
    if (volumeMesh.boundingBox) return volumeMesh.boundingBox
    volumeMesh.computeBoundingBox()
    return volumeMesh.boundingBox ?? undefined
  }

  const footprint = container.representations.footprint
  if (footprint) {
    const box = new Box2()
    if (footprint.geometry.type === "Polygon") {
      const vec = new Vector2()
      footprint.geometry.coordinates.forEach((coords) =>
        coords.forEach((coord) => {
          vec.set(coord[0], coord[1])
          box.expandByPoint(vec)
        }),
      )
    }
    if (footprint.geometry.type === "LineString") {
      const vec = new Vector2()
      footprint.geometry.coordinates.forEach((coord) => {
        vec.set(coord[0], coord[1])
        box.expandByPoint(vec)
      })
    }
    return box
  }
}
