import { type Box3, BufferAttribute, BufferGeometry, type Intersection, type Vector3 } from "three"
import { type Vec3, duplicateRepeatedPoints, getUniquePointsForPolygons } from "./utils"
import { getTriangleGroupBoundaryEdges } from "./boundary"
import { triangulatePadAreas } from "./padTriangulation"
import type { MeshBVH } from "three-mesh-bvh"
import { getPolygonsOverlapMasks } from "./polygonTrianglesOverlap"
import type { TerrainElement } from "src/core/terrain/terrain-types"
import { recalculateUVs } from "src/integrations/terrainPadsExperimental/api/terrain-repair"

export function createUpdatedGeometry(
  baseGeoIndicies: Uint32Array,
  baseGeoPositions: Float32Array,
  baseGeoNormals: Float32Array,
  outerPolygons: [number, number, number][][],
  terrainBbox: Box3,
  baseBvh: MeshBVH,
  polygonsWithElevations: Vec3[][],
  properties: TerrainElement["properties"],
  intersectBaseGeometry: (origin: Vector3, direction: Vector3) => Intersection[],
) {
  const { trianglesMask, pointsMask } = getPolygonsOverlapMasks(
    baseGeoIndicies,
    baseGeoPositions,
    outerPolygons,
    terrainBbox,
    baseBvh,
    intersectBaseGeometry,
  )
  const padsGeometry = applyPolygonsAndPointsWithElevationsLocally(
    polygonsWithElevations,
    baseGeoPositions,
    baseGeoIndicies,
    trianglesMask,
    pointsMask,
  )
  const { mergedPositions, mergedNormals, mergedIndices } = mergeRetriangulatedSectionsWithBaseGeo(
    baseGeoPositions,
    baseGeoNormals,
    baseGeoIndicies,
    trianglesMask,
    pointsMask,
    padsGeometry,
  )
  padsGeometry.dispose()

  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(mergedPositions, 3))
  geometry.setAttribute("normal", new BufferAttribute(mergedNormals, 3))
  geometry.setIndex(new BufferAttribute(mergedIndices, 1))
  // Potential TODO: Recalculate UVs for just the retriangulated sections
  const uvs = recalculateUVs(
    geometry.attributes["position"].array as Float32Array,
    properties.geoReference.refPoint as any,
    properties.bbox as any,
  )
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2))
  geometry.getAttribute("uv").needsUpdate = true
  return geometry
}

function applyPolygonsAndPointsWithElevationsLocally(
  segmentsWithElevations: Vec3[][],
  baseGeometryPositions: Float32Array,
  baseGeometryIndices: Uint32Array,
  triangleMask: boolean[],
  pointMask: boolean[],
) {
  if (segmentsWithElevations.length === 0) {
    return new BufferGeometry()
  }
  const uniquePointsInPolygon = getUniquePointsForPolygons(segmentsWithElevations)

  const internalIndices: [number, number, number][] = []
  for (let t = 0; t < triangleMask.length; t++) {
    const inside = triangleMask[t]
    if (inside) {
      internalIndices.push([baseGeometryIndices[t * 3], baseGeometryIndices[t * 3 + 1], baseGeometryIndices[t * 3 + 2]])
    }
  }

  const boundaryEdges = getTriangleGroupBoundaryEdges(internalIndices, baseGeometryPositions, pointMask)

  const { indices, vertices } = triangulatePadAreas(uniquePointsInPolygon, boundaryEdges, baseGeometryPositions)

  const { duplicatedPoints: duplicatedPadMeshPoints, duplicatedIndices } = duplicateRepeatedPoints(indices, vertices)

  // Create a BufferGeometry instance and set attributes
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(duplicatedPadMeshPoints.flat()), 3))
  geometry.setIndex(new BufferAttribute(new Uint32Array(duplicatedIndices), 1))

  // Compute vertex normals
  // Potential TODOs: Flat normals for just pad triangles, ensure continuous normals on boundary of retriangulated sections
  geometry.computeVertexNormals()

  return geometry
}

function mergeRetriangulatedSectionsWithBaseGeo(
  baseGeoPositions: Float32Array,
  baseGeoNormals: Float32Array,
  baseGeoIndicies: Uint32Array,
  sectionTrianglesMask: boolean[],
  sectionPointsMask: boolean[],
  padsGeometry: BufferGeometry,
) {
  const newSectionPositions = (padsGeometry.attributes.position?.array as Float32Array) ?? []
  const newSectionNormals = (padsGeometry.attributes.normal?.array as Float32Array) ?? []
  const newSectionIndicies = padsGeometry.index ? (padsGeometry.index.array as Uint32Array) : []

  const numPositions = sectionPointsMask.reduce((acc, val) => (val ? acc : acc + 1), 0) + newSectionPositions.length / 3
  const numTriangles =
    sectionTrianglesMask.reduce((acc, val) => (val ? acc : acc + 1), 0) + newSectionIndicies.length / 3
  const mergedPositions = new Float32Array(numPositions * 3)
  const mergedNormals = new Float32Array(numPositions * 3)
  const mergedIndices = new Uint32Array(numTriangles * 3)

  const outsideIndicesMap: number[] = []
  let outsidePointsCount = 0
  for (let i = 0; i < sectionPointsMask.length; i++) {
    const inside = sectionPointsMask[i]
    if (!inside) {
      outsideIndicesMap.push(outsidePointsCount)
      mergedPositions[outsidePointsCount * 3] = baseGeoPositions[i * 3]
      mergedPositions[outsidePointsCount * 3 + 1] = baseGeoPositions[i * 3 + 1]
      mergedPositions[outsidePointsCount * 3 + 2] = baseGeoPositions[i * 3 + 2]
      mergedNormals[outsidePointsCount * 3] = baseGeoNormals[i * 3]
      mergedNormals[outsidePointsCount * 3 + 1] = baseGeoNormals[i * 3 + 1]
      mergedNormals[outsidePointsCount * 3 + 2] = baseGeoNormals[i * 3 + 2]
      outsidePointsCount++
    } else {
      outsideIndicesMap.push(-1)
    }
  }
  mergedPositions.set(newSectionPositions, outsidePointsCount * 3)
  mergedNormals.set(newSectionNormals, outsidePointsCount * 3)

  let trianglesCount = 0
  for (let i = 0; i < sectionTrianglesMask.length; i++) {
    const overlapped = sectionTrianglesMask[i]
    if (!overlapped) {
      mergedIndices[trianglesCount * 3] = outsideIndicesMap[baseGeoIndicies[i * 3]]
      mergedIndices[trianglesCount * 3 + 1] = outsideIndicesMap[baseGeoIndicies[i * 3 + 1]]
      mergedIndices[trianglesCount * 3 + 2] = outsideIndicesMap[baseGeoIndicies[i * 3 + 2]]
      trianglesCount++
    }
  }
  const newIndicesOffset = outsidePointsCount
  for (let i = 0; i < newSectionIndicies.length; i++) {
    mergedIndices[trianglesCount * 3 + i] = newSectionIndicies[i] + newIndicesOffset
  }
  return { mergedPositions, mergedNormals, mergedIndices }
}
