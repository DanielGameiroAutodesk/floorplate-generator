import type { Point, Polygon } from "./types"
import type { Block } from "./geoBuilders"
import {
  applyRotationToPositions,
  applyTranslationToPositions,
  buildBufferGeometry,
  calculateNormals,
} from "./geoBuilders"
import { BufferAttribute, BufferGeometry, Color, Matrix4 } from "three"
import earcut from "earcut"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import { setGeometryColor } from "src/lib/three/geometryUtils"

type FlatRoofParams = {
  width: number
  depth: number
  roofThickness: number
  outerWallThickness: number
  elevation: number
  offsetRoof: number
  color: string
}
export const generateFlatRoof = ({
  width,
  depth,
  outerWallThickness,
  roofThickness,
  elevation,
  offsetRoof,
  color,
}: FlatRoofParams) => {
  const lowerLeft: Point = [-width / 2, -depth / 2]
  const lowerRight: Point = [width / 2, -depth / 2]
  const upperRight: Point = [width / 2, depth / 2]
  const upperLeft: Point = [-width / 2, depth / 2]
  const roofPolygon: Polygon = [
    [lowerLeft[0] + outerWallThickness, lowerLeft[1] + outerWallThickness],
    [lowerRight[0] - outerWallThickness, lowerLeft[1] + outerWallThickness],
    [upperRight[0] - outerWallThickness, upperRight[1] - outerWallThickness],
    [upperLeft[0] + outerWallThickness, upperLeft[1] - outerWallThickness],
    [lowerLeft[0] + outerWallThickness, lowerLeft[1] + outerWallThickness],
  ]

  const roofBlock: Block = {
    coordinates: [roofPolygon],
    elevation: elevation + offsetRoof,
    height: roofThickness,
    color: new Color(color),
  }
  const flatPoints: number[] = roofPolygon.flat()
  const indices = earcut(flatPoints)
  const pos = new Float32Array(indices.length * 3)
  let idx = 0
  // Roof
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    const point = roofPolygon[index]
    pos[idx] = point[0]
    pos[idx + 1] = point[1]
    pos[idx + 2] = elevation + offsetRoof + roofThickness
    idx += 3
  }
  return { roofGeo: buildBufferGeometry(roofBlock), roofSurfaces: [{ position: pos, normal: calculateNormals(pos) }] }
}
export type PointXYZ = { x: number; y: number; z: number }
export const generateRoofByPolygon = (polygon: { x: number; y: number; z: number }[], roofThickness: number) => {
  const roof = polygon
  const flatRoof = roof.flat()
  const flatPoints: number[] = roof.map((p) => [p.x, p.y]).flat()
  const indices: number[] = earcut(flatPoints)

  const vertexCountForTopOrBottom = indices.length
  const vertexCountForEdge = polygon.length * 6
  const vertexCount = 2 * vertexCountForTopOrBottom + vertexCountForEdge

  // Create the roof topside surface in a separate array first, so we can return a surfaceMesh with just the rooftop
  const posForTopside = new Float32Array(vertexCountForTopOrBottom * 3)

  let idx = 0

  // Roof top
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    const point = flatRoof[index]

    posForTopside[idx] = point.x
    posForTopside[idx + 1] = point.y
    posForTopside[idx + 2] = point.z + roofThickness
    idx += 3
  }

  // Start a new buffer for the entire roof volume (with thickness), starting by copying in the topside surface
  const pos = new Float32Array(vertexCount * 3)
  pos.set(posForTopside)

  //roof bottom
  for (let i = indices.length - 1; i >= 0; i--) {
    const index = indices[i]
    const point = flatRoof[index]
    pos[idx] = point.x
    pos[idx + 1] = point.y
    pos[idx + 2] = point.z
    idx += 3
  }

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i]
    const p2 = polygon[(i + 1) % polygon.length]
    pos[idx] = p1.x // bottom left
    pos[idx + 1] = p1.y
    pos[idx + 2] = p1.z
    pos[idx + 3] = p2.x
    pos[idx + 4] = p2.y
    pos[idx + 5] = p2.z
    pos[idx + 6] = p2.x
    pos[idx + 7] = p2.y
    pos[idx + 8] = p2.z + roofThickness
    pos[idx + 9] = p1.x // bottom left
    pos[idx + 10] = p1.y
    pos[idx + 11] = p1.z
    pos[idx + 12] = p2.x
    pos[idx + 13] = p2.y
    pos[idx + 14] = p2.z + roofThickness
    pos[idx + 15] = p1.x
    pos[idx + 16] = p1.y
    pos[idx + 17] = p1.z + roofThickness

    // Calc normals (cross product)
    const ax = p2.x - p1.x,
      ay = p2.y - p1.y,
      az = 0,
      bx = p2.x - p1.x,
      by = p2.y - p1.y,
      bz = roofThickness
    let nx = ay * bz - az * by,
      ny = az * bx - ax * bz,
      nz = ax * by - ay * bx
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx *= 1 / length
    ny *= 1 / length
    nz *= 1 / length
    idx += 18
  }

  return {
    volume: pos,
    topside: posForTopside,
  }
}

function buildGeometryFromPosition(position: Float32Array, elevation: number, color: string) {
  const roofGeometry = new BufferGeometry()
  roofGeometry.setAttribute("position", new BufferAttribute(position, 3))
  roofGeometry.setAttribute("normal", new BufferAttribute(calculateNormals(position), 3, false))
  setGeometryColor(new Color(color), roofGeometry)
  roofGeometry.applyMatrix4(new Matrix4().makeTranslation(0, 0, elevation))
  roofGeometry.computeBoundingBox()
  roofGeometry.computeBoundingSphere()
  return roofGeometry
}

type Params = {
  roofAngle: number
  width: number
  depth: number
  offsetBack: number
  offsetSide: number
  color: string
  roofThickness: number
  elevation: number
}

export function createGableRoof({
  roofAngle,
  width,
  depth,
  roofThickness,
  offsetBack,
  offsetSide,
  color,
  elevation = 0,
}: Params) {
  const height = (depth / 2 + offsetBack) * Math.tan(roofAngle * (Math.PI / 180))
  const offSetHeight = offsetBack * Math.tan(roofAngle * (Math.PI / 180)) * -1

  const lowerLeft: Point = [-width / 2 - offsetSide, 0]
  const lowerRight: Point = [width / 2 + offsetSide, 0]
  const upperRight: Point = [width / 2 + offsetSide, depth / 2 + offsetBack]
  const upperLeft: Point = [-width / 2 - offsetSide, depth / 2 + offsetBack]

  // Create the roof topside surface in a separate array first, so we can return a surfaceMesh with just the rooftop
  const roofTopsidePosition = new Float32Array(18)
  roofTopsidePosition[0] = lowerLeft[0]
  roofTopsidePosition[1] = lowerLeft[1]
  roofTopsidePosition[2] = elevation + height + roofThickness

  roofTopsidePosition[3] = lowerRight[0]
  roofTopsidePosition[4] = lowerRight[1]
  roofTopsidePosition[5] = elevation + height + roofThickness

  roofTopsidePosition[6] = upperRight[0]
  roofTopsidePosition[7] = upperRight[1]
  roofTopsidePosition[8] = elevation + roofThickness

  roofTopsidePosition[9] = lowerLeft[0]
  roofTopsidePosition[10] = lowerLeft[1]
  roofTopsidePosition[11] = elevation + height + roofThickness

  roofTopsidePosition[12] = upperRight[0]
  roofTopsidePosition[13] = upperRight[1]
  roofTopsidePosition[14] = elevation + roofThickness

  roofTopsidePosition[15] = upperLeft[0]
  roofTopsidePosition[16] = upperLeft[1]
  roofTopsidePosition[17] = elevation + roofThickness

  // Start a new buffer for the entire roof volume (with thickness), starting by copying in the topside surface
  const position = new Float32Array(108)
  position.set(roofTopsidePosition)

  // leftside
  position[18] = lowerLeft[0]
  position[19] = lowerLeft[1]
  position[20] = elevation + height

  position[21] = lowerLeft[0]
  position[22] = lowerLeft[1]
  position[23] = elevation + roofThickness + height

  position[24] = upperLeft[0]
  position[25] = upperLeft[1]
  position[26] = elevation

  position[27] = upperLeft[0]
  position[28] = upperLeft[1]
  position[29] = elevation + roofThickness

  position[30] = upperLeft[0]
  position[31] = upperLeft[1]
  position[32] = elevation

  position[33] = lowerLeft[0]
  position[34] = lowerLeft[1]
  position[35] = elevation + roofThickness + height

  // rightSide
  position[36] = upperRight[0]
  position[37] = upperRight[1]
  position[38] = elevation

  position[39] = lowerRight[0]
  position[40] = lowerRight[1]
  position[41] = elevation + roofThickness + height

  position[42] = lowerRight[0]
  position[43] = lowerRight[1]
  position[44] = height + elevation

  position[45] = upperRight[0]
  position[46] = upperRight[1]
  position[47] = elevation

  position[48] = upperRight[0]
  position[49] = upperRight[1]
  position[50] = roofThickness + elevation

  position[51] = lowerRight[0]
  position[52] = lowerRight[1]
  position[53] = roofThickness + height + elevation

  // front
  position[54] = lowerLeft[0]
  position[55] = lowerLeft[1]
  position[56] = height + elevation

  position[57] = lowerRight[0]
  position[58] = lowerRight[1]
  position[59] = height + elevation

  position[60] = lowerRight[0]
  position[61] = lowerRight[1]
  position[62] = roofThickness + height + elevation

  position[63] = lowerRight[0]
  position[64] = lowerRight[1]
  position[65] = height + roofThickness + elevation

  position[66] = lowerLeft[0]
  position[67] = lowerRight[1]
  position[68] = height + roofThickness + elevation

  position[69] = lowerLeft[0]
  position[70] = lowerRight[1]
  position[71] = height + elevation

  // back

  position[72] = upperRight[0]
  position[73] = upperRight[1]
  position[74] = roofThickness + elevation

  position[75] = upperRight[0]
  position[76] = upperLeft[1]
  position[77] = elevation

  position[78] = upperLeft[0]
  position[79] = upperLeft[1]
  position[80] = roofThickness + elevation

  position[81] = upperLeft[0]
  position[82] = upperLeft[1]
  position[83] = elevation

  position[84] = upperLeft[0]
  position[85] = upperLeft[1]
  position[86] = roofThickness + elevation

  position[87] = upperRight[0]
  position[88] = upperRight[1]
  position[89] = elevation

  //roof bottom
  position[90] = lowerRight[0]
  position[91] = lowerRight[1]
  position[92] = height + elevation

  position[93] = lowerLeft[0]
  position[94] = lowerLeft[1]
  position[95] = height + elevation

  position[96] = upperRight[0]
  position[97] = upperRight[1]
  position[98] = elevation

  position[99] = lowerLeft[0]
  position[100] = lowerLeft[1]
  position[101] = height + elevation

  position[102] = upperLeft[0]
  position[103] = upperLeft[1]
  position[104] = elevation

  position[105] = upperRight[0]
  position[106] = upperRight[1]
  position[107] = elevation

  // Above we generated faces for "one half" of the gable roof. We now need to duplicate this geometry
  // and rotate it 180 degrees. Finally we need to "lift" these geometries to the correct elevation
  function duplicateRoofAndMoveIntoPlace(pos: Float32Array): { front: Float32Array; back: Float32Array } {
    const frontSideRoof = Float32Array.from(pos)
    const backSideRoof = applyRotationToPositions(Float32Array.from(pos), Math.PI)
    const elevatedFront = applyTranslationToPositions(frontSideRoof, 0, 0, offSetHeight)
    const elevatedBack = applyTranslationToPositions(backSideRoof, 0, 0, offSetHeight)
    return { front: elevatedFront, back: elevatedBack }
  }

  const { front: elevatedRoofVolumeFront, back: elevatedRoofVolumeBack } = duplicateRoofAndMoveIntoPlace(position)
  const bufferGeometry0 = buildGeometryFromPosition(Float32Array.from(elevatedRoofVolumeFront), 0, color)
  const bufferGeometry1 = buildGeometryFromPosition(Float32Array.from(elevatedRoofVolumeBack), 0, color)

  const { front: elevatedRoofTopsideFront, back: elevatedRoofTopsideBack } =
    duplicateRoofAndMoveIntoPlace(roofTopsidePosition)

  return {
    roofGeometry: mergeGeometries([bufferGeometry0, bufferGeometry1]),
    roofSurfaces: [
      { position: elevatedRoofTopsideFront, normal: calculateNormals(elevatedRoofTopsideFront) },
      { position: elevatedRoofTopsideBack, normal: calculateNormals(elevatedRoofTopsideBack) },
    ],
  }
}
