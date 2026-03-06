import type { Vector3 } from "three"
import { BufferAttribute, BufferGeometry, Color } from "three"
import { AT_LEAST_TWO_VERTICES } from "./Shape/shapeUtils"
import type { Coord2D } from "src/lib/geometry/geometryTypes"
import type { Shape } from "./Shape/types"
import earcut from "earcut"
import { setGeometryColor } from "./geometryUtils"

type LineSegments = {
  lineSegments: [Coord2D, Coord2D][]
  position: Coord2D
  elevation: number
}

export function shapeToLineSegments(shape: Shape): LineSegments {
  if (!AT_LEAST_TWO_VERTICES(shape)) {
    console.error("Shape not a valid footprint for line", shape)
    throw new Error("Shape not a valid footprint for line")
  }
  const lineVertices: [Vector3, Vector3][] = shape.edges.map((edge) => [
    shape.vertices[edge[0]],
    shape.vertices[edge[1]],
  ])
  const lowestXAndY: Coord2D = [
    Math.min(...lineVertices.flat().map((v) => v.x)),
    Math.min(...lineVertices.flat().map((v) => v.y)),
  ]
  const shapeInLowestXYCoordSystem: [Coord2D, Coord2D][] = lineVertices.map(([from, to]) => [
    [from.x - lowestXAndY[0], from.y - lowestXAndY[1]],
    [to.x - lowestXAndY[0], to.y - lowestXAndY[1]],
  ])
  const lowestZ = Math.min(...lineVertices.flat().map((v) => v.z))
  return {
    lineSegments: shapeInLowestXYCoordSystem,
    position: lowestXAndY,
    elevation: lowestZ,
  }
}

type Volume = {
  coordinates: number[][][]
  elevation: number
  height: number
}

function buildGeometryPositionAndNormals(volumes: Volume[]) {
  // Triangulate all polygons to find total nof vertices
  const earcuts = []
  let nof = 0,
    idx = 0
  for (let i = 0; i < volumes.length; i++) {
    const indices = earcut(volumes[i].coordinates[0].flat())
    earcuts.push(indices)
    nof += volumes[i].coordinates[0].length * 6
    nof += indices.length * 2
  }

  const pos = new Float32Array(nof * 3)
  const normal = new Float32Array(nof * 3)
  for (let v = 0; v < volumes.length; v++) {
    const volume = volumes[v]
    const indices = earcuts[v]
    const height = volume.height
    const elevation = volume.elevation
    const polygon = volume.coordinates[0]
    const top = volume.elevation + volume.height
    const bottom = volume.elevation

    // Roof
    for (const index of indices) {
      pos[idx] = polygon[index][0]
      pos[idx + 1] = polygon[index][1]
      pos[idx + 2] = top
      normal[idx] = 0
      normal[idx + 1] = 0
      normal[idx + 2] = 1
      idx += 3
    }

    // Floor
    for (let i = indices.length - 1; i >= 0; i--) {
      const index = indices[i]
      pos[idx] = polygon[index][0]
      pos[idx + 1] = polygon[index][1]
      pos[idx + 2] = bottom
      normal[idx] = 0
      normal[idx + 1] = 0
      normal[idx + 2] = -1
      idx += 3
    }

    // Walls
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i]
      const p2 = polygon[(i + 1) % polygon.length]
      pos[idx] = p1[0] // bottom left
      pos[idx + 1] = p1[1]
      pos[idx + 2] = elevation
      pos[idx + 3] = p2[0] // bottom right
      pos[idx + 4] = p2[1]
      pos[idx + 5] = elevation
      pos[idx + 6] = p2[0] // top right
      pos[idx + 7] = p2[1]
      pos[idx + 8] = elevation + height
      pos[idx + 9] = p1[0] // bottom left
      pos[idx + 10] = p1[1]
      pos[idx + 11] = elevation
      pos[idx + 12] = p2[0] // top right
      pos[idx + 13] = p2[1]
      pos[idx + 14] = elevation + height
      pos[idx + 15] = p1[0] // top left
      pos[idx + 16] = p1[1]
      pos[idx + 17] = elevation + height

      // Calc normals (cross product)
      const ax = p2[0] - p1[0],
        ay = p2[1] - p1[1],
        az = 0,
        bx = p2[0] - p1[0],
        by = p2[1] - p1[1],
        bz = height
      let nx = ay * bz - az * by,
        ny = az * bx - ax * bz,
        nz = ax * by - ay * bx
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx *= 1 / length
      ny *= 1 / length
      nz *= 1 / length

      // Repeat normals for all 6 vertices
      for (let j = 0; j < 6; j++) {
        normal[idx + j * 3] = nx
        normal[idx + j * 3 + 1] = ny
        normal[idx + j * 3 + 2] = nz
      }
      idx += 18
    }
  }
  return { position: pos, normal: normal }
}

export const buildGeo = (block: {
  elevation: number
  coordinates: [number, number][][]
  height: number
  color: Color
}) => {
  const geometry = buildGeometryPositionAndNormals([block])
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(geometry.position, 3))
  geo.setAttribute("normal", new BufferAttribute(geometry.normal, 3, false))
  setGeometryColor(block.color, geo)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Sets the vertex color of the target geometry to be the same as the color of the first vertex in the original geometry
 * @param originalGeometry
 * @param targetGeometry
 */
export function copyColor(
  originalGeometry: BufferGeometry | undefined,
  targetGeometry: BufferGeometry,
): BufferGeometry {
  if (!originalGeometry) return targetGeometry
  const r = originalGeometry.getAttribute("color").getX(0)
  const g = originalGeometry.getAttribute("color").getY(0)
  const b = originalGeometry.getAttribute("color").getZ(0)

  let alpha = undefined
  if (originalGeometry.getAttribute("color").itemSize === 4) {
    alpha = originalGeometry.getAttribute("color").getW(0)
  }
  setGeometryColor(new Color(r, g, b), targetGeometry, alpha)

  return targetGeometry
}
