import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three"

/**
 * Merge multiple BufferGeometry objects into a single indexed geometry.
 * This function only preserves position attributes and calculates normals on the merged result.
 * All output geometries will have an index buffer.
 *
 * @param geometries - Array of BufferGeometry objects to merge
 * @param useFlatNormals - If true, uses flat (face) normals. If false, uses smooth (vertex) normals
 * @returns A single merged indexed BufferGeometry, or null if no valid geometries were provided
 */
export function mergeSpaceGeometries(
  geometries: BufferGeometry[],
  useFlatNormals: boolean = false,
): BufferGeometry | null {
  if (geometries.length === 0) {
    return null
  }

  // Filter out any null/undefined geometries
  const validGeometries = geometries.filter((g) => g != null && g.attributes.position != null)

  if (validGeometries.length === 0) {
    return null
  }

  if (useFlatNormals) {
    // For flat normals, we need to "bake" vertices so each face has unique vertices
    return mergeWithFlatNormals(validGeometries)
  } else {
    // For smooth normals, we can keep shared vertices and indices
    return mergeWithSmoothNormals(validGeometries)
  }
}

/**
 * Merge geometries preserving indexed structure for smooth normals
 */
function mergeWithSmoothNormals(geometries: BufferGeometry[]): BufferGeometry | null {
  let totalVertices = 0
  let totalIndices = 0

  // First pass: count vertices and indices
  for (const geometry of geometries) {
    const positionAttribute = geometry.attributes.position
    const vertexCount = positionAttribute.count

    totalVertices += vertexCount

    if (geometry.index != null) {
      totalIndices += geometry.index.count
    } else {
      // If no index, we'll create dummy indices
      totalIndices += vertexCount
    }
  }

  if (totalVertices === 0) {
    return null
  }

  // Create buffers
  const mergedPositions = new Float32Array(totalVertices * 3)
  const mergedIndices = new Uint32Array(totalIndices)

  let vertexOffset = 0
  let indexOffset = 0

  // Second pass: copy data
  for (const geometry of geometries) {
    const positionAttribute = geometry.attributes.position
    const vertexCount = positionAttribute.count

    // Copy positions
    for (let i = 0; i < vertexCount; i++) {
      mergedPositions[(vertexOffset + i) * 3 + 0] = positionAttribute.getX(i)
      mergedPositions[(vertexOffset + i) * 3 + 1] = positionAttribute.getY(i)
      mergedPositions[(vertexOffset + i) * 3 + 2] = positionAttribute.getZ(i)
    }

    // Copy or create indices
    if (geometry.index != null) {
      const indexCount = geometry.index.count
      for (let i = 0; i < indexCount; i++) {
        mergedIndices[indexOffset + i] = geometry.index.getX(i) + vertexOffset
      }
      indexOffset += indexCount
    } else {
      // Create dummy indices
      for (let i = 0; i < vertexCount; i++) {
        mergedIndices[indexOffset + i] = vertexOffset + i
      }
      indexOffset += vertexCount
    }

    vertexOffset += vertexCount
  }

  // Create the merged geometry
  const mergedGeometry = new BufferGeometry()
  mergedGeometry.setAttribute("position", new Float32BufferAttribute(mergedPositions, 3))
  mergedGeometry.setIndex(new Uint32BufferAttribute(mergedIndices, 1))

  // Calculate smooth vertex normals
  mergedGeometry.computeVertexNormals()

  return mergedGeometry
}

/**
 * Merge geometries with flat normals by "baking" indices (duplicating vertices per face)
 */
function mergeWithFlatNormals(geometries: BufferGeometry[]): BufferGeometry | null {
  const trianglePositions: Float32Array[] = []

  // Convert all geometries to triangle lists (each face gets its own vertices)
  for (const geometry of geometries) {
    const positionAttribute = geometry.attributes.position

    if (geometry.index != null) {
      // Indexed geometry - extract triangles
      const indexCount = geometry.index.count
      const triangleCount = Math.floor(indexCount / 3)
      const positions = new Float32Array(triangleCount * 9) // 3 vertices * 3 components

      for (let i = 0; i < triangleCount; i++) {
        for (let j = 0; j < 3; j++) {
          const idx = geometry.index.getX(i * 3 + j)
          positions[(i * 3 + j) * 3 + 0] = positionAttribute.getX(idx)
          positions[(i * 3 + j) * 3 + 1] = positionAttribute.getY(idx)
          positions[(i * 3 + j) * 3 + 2] = positionAttribute.getZ(idx)
        }
      }
      trianglePositions.push(positions)
    } else {
      // Non-indexed geometry - already has separate vertices per triangle
      const vertexCount = positionAttribute.count
      const positions = new Float32Array(vertexCount * 3)

      for (let i = 0; i < vertexCount; i++) {
        positions[i * 3 + 0] = positionAttribute.getX(i)
        positions[i * 3 + 1] = positionAttribute.getY(i)
        positions[i * 3 + 2] = positionAttribute.getZ(i)
      }
      trianglePositions.push(positions)
    }
  }

  // Calculate total vertex count
  let totalVertices = 0
  for (const positions of trianglePositions) {
    totalVertices += positions.length / 3
  }

  if (totalVertices === 0) {
    return null
  }

  // Merge all positions
  const mergedPositions = new Float32Array(totalVertices * 3)
  let offset = 0

  for (const positions of trianglePositions) {
    mergedPositions.set(positions, offset)
    offset += positions.length
  }

  // Create dummy indices (0, 1, 2, 3, 4, 5, ...)
  const mergedIndices = new Uint32Array(totalVertices)
  for (let i = 0; i < totalVertices; i++) {
    mergedIndices[i] = i
  }

  // Create the merged geometry
  const mergedGeometry = new BufferGeometry()
  mergedGeometry.setAttribute("position", new Float32BufferAttribute(mergedPositions, 3))
  mergedGeometry.setIndex(new Uint32BufferAttribute(mergedIndices, 1))

  // Compute flat normals
  computeFlatNormals(mergedGeometry)

  return mergedGeometry
}

/**
 * Compute flat (face) normals for a geometry.
 * This creates hard edges between faces.
 */
function computeFlatNormals(geometry: BufferGeometry): void {
  const positions = geometry.attributes.position.array
  const vertexCount = positions.length / 3
  const normals = new Float32Array(vertexCount * 3)

  // Process each triangle
  for (let i = 0; i < vertexCount; i += 3) {
    // Get the three vertices of the triangle
    const ax = positions[i * 3 + 0]
    const ay = positions[i * 3 + 1]
    const az = positions[i * 3 + 2]

    const bx = positions[(i + 1) * 3 + 0]
    const by = positions[(i + 1) * 3 + 1]
    const bz = positions[(i + 1) * 3 + 2]

    const cx = positions[(i + 2) * 3 + 0]
    const cy = positions[(i + 2) * 3 + 1]
    const cz = positions[(i + 2) * 3 + 2]

    // Calculate edge vectors
    const abx = bx - ax
    const aby = by - ay
    const abz = bz - az

    const acx = cx - ax
    const acy = cy - ay
    const acz = cz - az

    // Calculate face normal using cross product
    let nx = aby * acz - abz * acy
    let ny = abz * acx - abx * acz
    let nz = abx * acy - aby * acx

    // Normalize the normal vector
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
    if (length > 0) {
      nx /= length
      ny /= length
      nz /= length
    }

    // Set the same normal for all three vertices of the face
    for (let j = 0; j < 3; j++) {
      normals[(i + j) * 3 + 0] = nx
      normals[(i + j) * 3 + 1] = ny
      normals[(i + j) * 3 + 2] = nz
    }
  }

  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3))
}
