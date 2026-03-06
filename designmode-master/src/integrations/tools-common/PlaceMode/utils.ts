import type { Child, FormaElement, Transform, Urn } from "forma-elements"
import type { Feature, GeoJsonProperties, Geometry, Polygon } from "geojson"
import type { RepresentationsByUrn } from "src/core/elements/ElementRepresentations"
import type { TerrainBBox } from "src/core/elements/Terrain"
import { PROJECT_ID } from "src/core/project/project"
import { terrainSignal, type NewTerrainState } from "src/core/terrain/new-terrain-state"
import { parseUrnBatch } from "src/integrations/basic-elements/api/batching"
import { newId, newRevision } from "src/lib/element/urn"
import { getInMapOrThrow } from "src/lib/map"
import { request } from "src/lib/request"
import { Matrix4, Vector3 } from "three"

export function hasBuildingsThatNeedsToBeModified(elements: FormaElement[]) {
  return elements.some(
    (e) =>
      e.properties?.heightDefinition === "MASL" ||
      e.properties?.placementHeuristic === "PULL_TO_MAX_TERRAIN_INTERSECTION_POINT",
  )
}

export async function createNewElements(elements: FormaElement[], representations: RepresentationsByUrn) {
  // MASL elements are buildings that have roof height in Meters Above Sea Level, but no elevation.
  // This function calculates elevation for each buildings and creates a new basic element.
  const newElements: (FormaElement & { geojson: Feature<Geometry, GeoJsonProperties> })[] = []
  const terrain = terrainSignal.peek()
  for (let element of elements) {
    if (
      element.properties?.heightDefinition === "MASL" ||
      element.properties?.placementHeuristic === "PULL_TO_MAX_TERRAIN_INTERSECTION_POINT"
    ) {
      const newElement = calculateElevationAndCreateNewElement(
        element,
        getInMapOrThrow(representations.footprint, element.urn),
        terrain,
      )
      newElements.push(newElement)
    } else {
      const newChildElement = {
        urn: element.urn,
        id: parseUrnBatch(element.urn).internalId,
        metadata: element.metadata,
        properties: {
          geometry_hash: element.properties?.geometry_hash,
          category: element.properties?.category,
          name: element.properties?.name,
          elevationDefinition: element.properties?.elevationDefinition,
          heightDefinition: element.properties?.heightDefinition,
        },
        geojson: getInMapOrThrow(representations.footprint, element.urn),
      }
      newElements.push(newChildElement)
    }
  }
  const urns = await storeAsNewElements(newElements)
  return urns
}

export function isGroup(element: FormaElement): boolean {
  return element?.properties?.category?.toLowerCase() === "group"
}

async function storeAsNewElements(maslElements: (FormaElement & { geojson: Feature<Geometry, GeoJsonProperties> })[]) {
  let newElements: { urn: Urn }[] = []
  const revision = newRevision()
  const batchSize = 1000
  for (let i = 0; i < maslElements.length; i += batchSize) {
    const batch = maslElements.slice(i, i + batchSize)
    const batchId = newId()
    const basicElementApiUrl = `/api/basic/elements/${batchId}/revisions/${revision}?authcontext=${PROJECT_ID}&newRepresentations`

    const response = await request(basicElementApiUrl, { method: "PUT", body: JSON.stringify(batch) }).then((res) =>
      res.json(),
    )
    newElements = newElements.concat(Object.values(response))
  }

  return newElements.map((e) => e.urn)
}

export function calculateElevationAndCreateNewElement(
  child: FormaElement,
  geojson: Feature<Geometry, GeoJsonProperties>,
  terrain: NewTerrainState,
): FormaElement & { geojson: Feature<Geometry, GeoJsonProperties> } {
  const points = (geojson.geometry as Polygon).coordinates[0].map((c) =>
    clampPointToBoundingBox([c[0], c[1]], terrain.terrainSamplerData.bbox),
  )
  const elevations = points.map((c) => terrain.elevationAt(c[0], c[1]))
  const minElevation = Math.min(...elevations)
  const maxElevation = Math.max(...elevations)

  function getHeight() {
    if (child.properties?.heightDefinition === "MASL") return geojson.properties!.height - minElevation
    if (child.properties?.placementHeuristic === "PULL_TO_MAX_TERRAIN_INTERSECTION_POINT")
      return geojson.properties!.height + maxElevation - minElevation
    return geojson.properties!.height
  }

  const height = getHeight()
  const newChildGeoJson = {
    ...geojson,
    properties: { elevation: minElevation, height },
  }
  const updatedChild = {
    urn: child.urn,
    id: parseUrnBatch(child.urn).internalId,
    metadata: child.metadata,
    properties: {
      geometry_hash: child.properties?.geometry_hash,
      category: child.properties?.category,
      name: child.properties?.name,
      elevationDefinition: "MASL",
      heightDefinition: "MAGL",
    },
    geojson: newChildGeoJson,
  }
  return updatedChild
}

function clampPointToBoundingBox(point: number[], bbox: TerrainBBox) {
  return [Math.max(bbox.min.x, Math.min(bbox.max.x, point[0])), Math.max(bbox.min.y, Math.min(bbox.max.y, point[1]))]
}

function pointIsWithinBoundingBox(point: number[], bbox: TerrainBBox) {
  return point[0] >= bbox.min.x && point[0] <= bbox.max.x && point[1] >= bbox.min.y && point[1] <= bbox.max.y
}

function footPrintIsWithinBoundingBox(footprint: Feature<Geometry, GeoJsonProperties>, bbox: TerrainBBox) {
  if (footprint.geometry.type === "Polygon") {
    const points = footprint.geometry.coordinates[0]
    return points.some((p) => pointIsWithinBoundingBox(p, bbox))
  }
  if (footprint.geometry.type === "LineString") {
    const points = footprint.geometry.coordinates
    return points.some((p) => pointIsWithinBoundingBox(p, bbox))
  }
  return true // default to including the element if we can't determine if it's within the bbox
}

function getChildTransform(
  child: Child,
  element: FormaElement,
  representations: RepresentationsByUrn,
  terrain: NewTerrainState,
): Transform | undefined {
  const shouldPlaceOnTerrain = element.properties?.elevationDefinition === "MAGL"
  if (shouldPlaceOnTerrain) {
    if (child.transform && !representations.footprint.has(element.urn)) {
      return placePointOnTerrain(child, terrain)
    }
    const footprint = getInMapOrThrow(representations.footprint, element.urn)
    return placeFootprintOnTerrain(child, footprint, terrain)
  }
}

function placeFootprintOnTerrain(
  child: Child,
  geoJson: Feature<Geometry, GeoJsonProperties>,
  terrain: NewTerrainState,
): Transform {
  const points = (geoJson.geometry as Polygon).coordinates[0].map((c) =>
    clampPointToBoundingBox([c[0], c[1]], terrain.terrainSamplerData.bbox),
  )
  const elevations = points.map((c) => terrain.elevationAt(c[0], c[1]))
  const minElevation = Math.min(...elevations)
  const elevationMatrix: Transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, minElevation, 1]
  return child.transform
    ? new Matrix4()
        .multiplyMatrices(new Matrix4().fromArray(child.transform), new Matrix4().fromArray(elevationMatrix))
        .toArray()
    : elevationMatrix
}

function placePointOnTerrain(child: Child, terrain: NewTerrainState): Transform {
  const point = new Vector3(0, 0, 0)
  const childTransform = new Matrix4().fromArray(child.transform!)
  point.applyMatrix4(childTransform)
  const elevation = terrain.elevationAt(point.x, point.y)
  const elevationMatrix = new Matrix4().fromArray([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, elevation, 1])
  const transformationMatrix = new Matrix4().multiplyMatrices(
    new Matrix4().fromArray(child.transform!),
    elevationMatrix,
  )
  return transformationMatrix.toArray()
}

function pointIsWithinTerrainBbox(child: Child, terrain: NewTerrainState): boolean {
  const point = new Vector3(0, 0, 0)
  const childTransform = new Matrix4().fromArray(child.transform!)
  point.applyMatrix4(childTransform)
  return pointIsWithinBoundingBox([point.x, point.y], terrain.terrainSamplerData.bbox)
}

export function isChildWithinTerrain(
  child: Child,
  element: FormaElement,
  representations: RepresentationsByUrn,
  terrain: NewTerrainState,
): boolean {
  if (child.transform && !representations.footprint.has(element.urn)) {
    return pointIsWithinTerrainBbox(child, terrain)
  }
  const footprint = representations.footprint.get(element.urn)
  if (footprint) {
    return footPrintIsWithinBoundingBox(footprint, terrain.terrainSamplerData.bbox)
  }
  const volumeMesh = representations.volumeMesh.get(element.urn)
  if (volumeMesh) {
    if (!volumeMesh.boundingBox) {
      volumeMesh.computeBoundingBox()
    }
    if (volumeMesh.boundingBox) {
      const bbox = [
        [volumeMesh.boundingBox.min.x, volumeMesh.boundingBox.min.y],
        [volumeMesh.boundingBox.max.x, volumeMesh.boundingBox.max.y],
      ]
      return bbox.some((p) => pointIsWithinBoundingBox(p, terrain.terrainSamplerData.bbox))
    }
  }
  return true // default to including the element if we can't determine if it's within the bbox
}

export function getTransform(
  child: Child,
  element: FormaElement,
  representations: RepresentationsByUrn,
  terrain: NewTerrainState,
  rootMatrix?: Matrix4,
): Transform | undefined {
  const childTransform = getChildTransform(child, element, representations, terrain)
  if (rootMatrix) {
    return childTransform
      ? new Matrix4().multiplyMatrices(new Matrix4().fromArray(childTransform), rootMatrix).toArray()
      : rootMatrix.toArray()
  } else {
    return childTransform
  }
}
