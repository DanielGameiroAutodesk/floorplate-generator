import type { Color } from "three"
import { BufferAttribute, BufferGeometry, Vector3 } from "three"
import { buildGeometryForVolume } from "src/integrations/building-systems-common/buildGeoWithHoles"
import { setGeometryColor } from "src/lib/three/geometryUtils"
import type { BuildingBlock, Point, PointXY, Polygon, Wall } from "./types"

function pointPointDistance(point1: Point, point2: Point) {
  return Math.sqrt(Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2))
}

function getUnitVector(startPoint: Point, endPoint: Point): Point {
  const distance = pointPointDistance(startPoint, endPoint)
  if (distance === 0) {
    return [0, 0]
  }
  const vectorX = (endPoint[0] - startPoint[0]) / distance
  const vectorY = (endPoint[1] - startPoint[1]) / distance
  return [vectorX, vectorY]
}

function getNormalVector(startPoint: Point, endPoint: Point): Point {
  const unit = getUnitVector(startPoint, endPoint)
  return [-unit[1], unit[0]]
}

function getUnitNormalVectorsPolygon(polygon: Polygon) {
  const n = polygon.length
  const normals: Point[] = []
  for (let i = 0; i < n; i++) {
    const p0 = polygon[i]
    const p1 = polygon[(i + 1) % n]
    const normal = getNormalVector(p0, p1)
    normals.push(normal)
  }
  return normals
}

function removeDuplicateLastPoint(polygon: Polygon) {
  const n = polygon.length
  return polygon.slice(0, n - 1)
}

function addVectorToPoint(point: Point, vector: Point, scalar = 1): Point {
  return [point[0] + scalar * vector[0], point[1] + scalar * vector[1]]
}

function getCornerShiftsClosed(polygon: Polygon) {
  const unitNormals = getUnitNormalVectorsPolygon(polygon)
  const n = polygon.length
  const cornerShifts: Point[] = []
  const m = unitNormals.length
  for (let i = -1; i < n - 1; i++) {
    const normalOne = unitNormals[(i + m) % m]
    const normalTwo = unitNormals[(i + 1) % m]
    let x = normalOne[0] + normalTwo[0]
    let y = normalOne[1] + normalTwo[1]
    const l = x * normalOne[0] + y * normalOne[1]
    x = x / l
    y = y / l
    cornerShifts.push([x, y])
  }
  return cornerShifts
}

// copy paste from building systems

export type Block = {
  elevation: number
  coordinates: [number, number][][]
  height: number
  color: Color
}
export const buildBufferGeometry = (block: Block) => {
  const geometry = buildGeometryForVolume(block)
  const geo = new BufferGeometry()
  geo.setAttribute("position", new BufferAttribute(geometry.position, 3))
  geo.setAttribute("normal", new BufferAttribute(geometry.normal, 3, false))
  setGeometryColor(block.color, geo)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

export function getWallBlocksFromPolygons(
  polygons: Polygon[],
  thickness: number,
  elevation: number,
  height: number,
  color: Color,
): Block[] {
  const blocks: Block[] = []
  for (let _polygon of polygons) {
    const polygon = removeDuplicateLastPoint(_polygon)
    const cornerShifts = getCornerShiftsClosed(polygon)
    const n = polygon.length
    for (let i = 0; i < n; i++) {
      const p0 = polygon[i]
      const p1 = polygon[(i + 1) % n]
      const length = pointPointDistance(p0, p1)
      if (length < 1e-2) continue
      const p3 = addVectorToPoint(p1, cornerShifts[(i + 1) % n], thickness)
      const p4 = addVectorToPoint(p0, cornerShifts[i], thickness)
      const coordinates = [[p0, p1, p3, p4, p0]]
      const block: Block = { coordinates, elevation, height, color }
      blocks.push(block)
    }
  }
  return blocks
}

function pointPointDistanceXY(pointOne: PointXY, pointTwo: PointXY) {
  return ((pointOne.x - pointTwo.x) ** 2 + (pointOne.y - pointTwo.y) ** 2) ** 0.5
}

type FlatBlock = { start: number; end: number; lower: number; upper: number }

export function getFlatWallPolygons(wall: Wall, wallHeight: number, floorElevation: number): BuildingBlock[] {
  const wallLength = pointPointDistanceXY(wall.startPoint, wall.endPoint)
  const cuts: { s: number; width: number; elevation: number; height: number }[] = []
  cuts.push(...Object.values(wall.windows))
  if (wall.doors) cuts.push(...Object.values(wall.doors).map((door) => ({ ...door, elevation: 0 })))

  cuts.sort((a, b) => a.s - b.s)

  const flatBlocks: FlatBlock[] = []
  let s = 0
  for (let cut of cuts) {
    if (s >= wallLength - 1e-2) break
    if (cut.s > s + 1e-2) {
      const end = Math.min(cut.s, wallLength)
      const block = { start: s, end: end, lower: 0, upper: wallHeight }
      flatBlocks.push(block)
    }
    const cutEnd = Math.min(cut.s + cut.width, wallLength)
    const cutStart = Math.max(s, cut.s)
    if (cutEnd > cutStart + 1e-2) {
      if (cut.elevation > 1e-2) {
        const upper = Math.min(cut.elevation, wallHeight)
        const block = { start: cutStart, end: cutEnd, lower: 0, upper: upper }
        flatBlocks.push(block)
      }
      if (cut.elevation + cut.height < wallHeight - 1e-2) {
        const lower = cut.elevation + cut.height
        const block = { start: cutStart, end: cutEnd, lower: lower, upper: wallHeight }
        flatBlocks.push(block)
      }
    }
    s = Math.max(cut.s + cut.width, s)
  }
  if (s < wallLength - 1e-2) {
    const block = { start: s, end: wallLength, lower: 0, upper: wallHeight }
    flatBlocks.push(block)
  }

  return getBlocksFromFlatBlocks(wall, flatBlocks, floorElevation)
}

function getLeftAndRightShift(width: number, lineAlignment: "left" | "center" | "right") {
  if (lineAlignment === "left") {
    return { left: 0, right: -width }
  }
  if (lineAlignment === "right") {
    return { left: width, right: 0 }
  }
  return { left: 0.5 * width, right: -0.5 * width }
}

function getBlocksFromFlatBlocks(wall: Wall, flatBlocks: FlatBlock[], floorElevation: number): BuildingBlock[] {
  const { x: x0, y: y0 } = wall.startPoint
  const startPosition: Point = [x0, y0]
  const { x: x1, y: y1 } = wall.endPoint
  const endPosition: Point = [x1, y1]
  if (pointPointDistance(startPosition, endPosition) < 1e-8) return []
  const normal = getNormalVector(startPosition, endPosition)
  const unit = getUnitVector(startPosition, endPosition)
  const { width, lineAlignment } = wall

  const shifts = getLeftAndRightShift(width, lineAlignment)

  const c_right: Point = addVectorToPoint(startPosition, normal, shifts.right)
  const c_left: Point = addVectorToPoint(startPosition, normal, shifts.left)

  return flatBlocks.map((flatBlock) => {
    const { start, end, upper, lower } = flatBlock

    const p0: Point = addVectorToPoint(c_right, unit, start)
    const p1: Point = addVectorToPoint(c_right, unit, end)
    const p2: Point = addVectorToPoint(c_left, unit, end)
    const p3: Point = addVectorToPoint(c_left, unit, start)
    const polygon = [p0, p1, p2, p3]
    const coordinates = [polygon]
    const block: BuildingBlock = {
      coordinates,
      elevation: lower + floorElevation,
      height: upper - lower,
      structureType: "WALL",
    }
    return block
  })
}
export function triangulateVerticalRectangle(p1: Point, p2: Point, elevation: number, height: number) {
  const pos = new Float32Array(18)
  pos[0] = p1[0] // bottom left
  pos[1] = p1[1]
  pos[2] = elevation
  pos[3] = p2[0] // bottom right
  pos[4] = p2[1]
  pos[5] = elevation
  pos[6] = p2[0] // top right
  pos[7] = p2[1]
  pos[8] = elevation + height
  pos[9] = p1[0] // bottom left
  pos[10] = p1[1]
  pos[11] = elevation
  pos[12] = p2[0] // top right
  pos[13] = p2[1]
  pos[14] = elevation + height
  pos[15] = p1[0] // top left
  pos[16] = p1[1]
  pos[17] = elevation + height
  return pos
}

export function calculateNormals(position: Float32Array) {
  const normal = new Float32Array(position)
  let idx = 0
  for (let i = 0; i < position.length; i++) {
    const p1 = [position[idx], position[idx + 1], position[idx + 2]]
    const p2 = [position[idx + 3], position[idx + 4], position[idx + 5]]
    const p3 = [position[idx + 6], position[idx + 7], position[idx + 8]]
    const normalVector = new Vector3(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2])
      .cross(new Vector3(p3[0] - p1[0], p3[1] - p1[1], p3[2] - p1[2]))
      .normalize()
    normal[idx] = normalVector.x
    normal[idx + 1] = normalVector.y
    normal[idx + 2] = normalVector.z
    normal[idx + 3] = normalVector.x
    normal[idx + 4] = normalVector.y
    normal[idx + 5] = normalVector.z
    normal[idx + 6] = normalVector.x
    normal[idx + 7] = normalVector.y
    normal[idx + 8] = normalVector.z
    idx += 9
  }
  return normal
}

export function applyRotationToPolygon(polygon: Polygon, theta: number): Polygon {
  return polygon.map((point) => {
    const x = point[0] * Math.cos(theta) - point[1] * Math.sin(theta)
    const y = point[0] * Math.sin(theta) + point[1] * Math.cos(theta)
    return [x, y]
  })
}

export function applyRotationToPositions(position: Float32Array, theta: number) {
  const rotatedOutlines = new Float32Array(position.length)
  for (let i = 0; i < position.length; i += 3) {
    const x = position[i]
    const y = position[i + 1]
    rotatedOutlines[i] = x * Math.cos(theta) - y * Math.sin(theta)
    rotatedOutlines[i + 1] = x * Math.sin(theta) + y * Math.cos(theta)
    rotatedOutlines[i + 2] = position[i + 2]
  }
  return rotatedOutlines
}
export function applyTranslationToPositions(position: Float32Array, x: number, y: number, z: number) {
  const translatedOutlines = new Float32Array(position.length)
  for (let i = 0; i < position.length; i += 3) {
    translatedOutlines[i] = position[i] + x
    translatedOutlines[i + 1] = position[i + 1] + y
    translatedOutlines[i + 2] = position[i + 2] + z
  }
  return translatedOutlines
}
