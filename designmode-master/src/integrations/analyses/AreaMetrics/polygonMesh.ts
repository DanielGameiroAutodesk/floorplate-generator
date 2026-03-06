import {
  AlwaysDepth,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
} from "three"
import earcut from "earcut"
import { Float32Concat } from "src/integrations/building-systems-line-buildings/helpers/arrayHelpers"
import type { ElementGrossFloorAreas } from "./GrossFloorAreas"

export function createWireframeMeshFromPositions(positions: Float32Array[]): LineSegments {
  const position = Float32Concat(positions)
  const normal = createNormal(position)
  const geometry = new BufferGeometry()
  geometry.setAttribute("normal", new BufferAttribute(normal, 3))
  geometry.setAttribute("position", new BufferAttribute(position, 3))
  return createWireframeMesh(geometry)
}

export function createFillMeshFromPositions(positions: Float32Array[], elementGfas: ElementGrossFloorAreas[]): Mesh {
  const position = Float32Concat(positions)
  const normal = createNormal(position)
  const color = generateColorArray(positions, elementGfas, 0.35)
  const geometry = new BufferGeometry()
  geometry.setAttribute("normal", new BufferAttribute(normal, 3))
  geometry.setAttribute("position", new BufferAttribute(position, 3))
  geometry.setAttribute("color", new BufferAttribute(color, 4, true))
  return createFillMesh(geometry)
}

function createNormal(position: Float32Array) {
  const normal = new Float32Array(position.length)
  for (let i = 2; i < normal.length; i += 3) {
    normal[i] = 1
  }
  return normal
}

const resultColor = new Uint8Array(new Color("#0696D7").multiplyScalar(255).toArray())
const surroundingColor = new Uint8Array(new Color("#ffffff").multiplyScalar(255).toArray())

function generateColorArray(positions: Float32Array[], elementGfas: ElementGrossFloorAreas[], alpha: number) {
  const vertexCount = ~~(positions.map((array) => array.length).reduce((a, b) => a + b, 0) / 3)
  const arrayColors = elementGfas
    .flatMap((elementGfa) =>
      elementGfa.gfaPolygons.map((gfaPolygon) => ({ isUnderlying: elementGfa.isUnderlying, gfaPolygon })),
    )
    .map(({ isUnderlying }) => (isUnderlying ? resultColor : surroundingColor))
  const colors = new Uint8Array(vertexCount * 4)
  let i0 = 0
  arrayColors.forEach((color, arrayIndex) => {
    const colorArrayLength = ~~(positions[arrayIndex].length / 3) * 4
    const i1 = i0 + colorArrayLength
    for (let i = i0; i < i1; i += 4) {
      colors.set(color.slice(0, 3), i)
      colors.set([alpha * 255], i + 3)
    }
    i0 = i1
  })
  return colors
}

function createFillMesh(geometry: BufferGeometry): Mesh {
  const material = new MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    depthFunc: AlwaysDepth,
    side: DoubleSide,
  })
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = false
  mesh.receiveShadow = false
  return mesh
}

export function createWireframeMesh(geometry: BufferGeometry): LineSegments {
  const material = new LineBasicMaterial({
    polygonOffset: true,
    polygonOffsetUnits: -0.5,
    polygonOffsetFactor: -0.5,
    color: "#555555",
    depthFunc: AlwaysDepth,
    side: DoubleSide,
  })
  const segments = new LineSegments(geometry, material)
  segments.castShadow = false
  segments.receiveShadow = false
  return segments
}

export function createFillPositionArray(coordinates: MultiRingPolygon): Float32Array {
  const holeIndexes = []
  let index = 0
  for (let i = 0; i < coordinates.length - 1; i++) {
    index += coordinates[i].length
    holeIndexes.push(index)
  }

  const points = coordinates.flat()
  const flatPoints: number[] = points.flat()
  const indices = earcut(flatPoints, holeIndexes, 3)

  const position = new Float32Array(indices.length * 3)

  let idx = 0
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i]
    const point = points[index]
    position[idx] = point[0]
    position[idx + 1] = point[1]
    position[idx + 2] = point[2]
    idx += 3
  }

  return position
}

export function createWireframePositionArray(coordinates: MultiRingPolygon) {
  function expandRingCoordinates(ring: Ring): Ring {
    return ring.slice(1).flatMap((point, i) => [ring[i], point])
  }

  return Float32Array.from(coordinates.map(expandRingCoordinates).flat(2))
}

export type Point = [number, number, number]
export type Ring = Point[]
export type MultiRingPolygon = Ring[]
