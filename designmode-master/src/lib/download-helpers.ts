import type { MeshStandardMaterial, Object3D } from "three"
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
} from "three"

function extractMeshes(group: Object3D, meshes: Mesh[]) {
  if (group instanceof Mesh) meshes.push(group)
  for (const child of group.children) {
    extractMeshes(child, meshes)
  }
}

const _identity = new Matrix4()

const white = new Color(1, 1, 1)
function extractColors(mesh: Mesh, vertexCount: number, outputItemSize: 3 | 4): Uint8Array {
  const material = mesh.material as MeshStandardMaterial
  const { color } = mesh.geometry.attributes
  const colors = new Uint8Array(vertexCount * outputItemSize)

  if (color) {
    let result = color.array
    if (color.array instanceof Uint16Array) {
      result = Uint8Array.from(color.array, (v) => v >> 8)
    } else if (color.array instanceof Float32Array) {
      result = Uint8Array.from(color.array, (v) => v * 0xff)
    }

    if (outputItemSize === 4) {
      // Output VEC4 - preserve as-is
      colors.set(result, 0)
    } else {
      // Output VEC3
      if (color.itemSize === 3) {
        colors.set(result, 0)
      } else {
        // Convert VEC4 to VEC3 by dropping alpha
        for (let i = 0; i < result.length / 4; i++) {
          colors[i * 3] = result[i * 4]
          colors[i * 3 + 1] = result[i * 4 + 1]
          colors[i * 3 + 2] = result[i * 4 + 2]
        }
      }
    }
  } else {
    // No color attribute - use material color
    const src = material.color || white
    const alpha = material.transparent ? material.opacity * 255 : 255
    const array = Uint8Array.from(src.toArray(), (v) => v * 255)
    for (let i = 0; i < vertexCount; i++) {
      colors[i * outputItemSize] = array[0]
      colors[i * outputItemSize + 1] = array[1]
      colors[i * outputItemSize + 2] = array[2]
      if (outputItemSize === 4) colors[i * outputItemSize + 3] = alpha
    }
  }
  return colors
}

function preprocessMeshes(originalMeshes: Mesh[]) {
  return originalMeshes.map((original) => {
    const mesh = new Mesh(original.geometry.clone(), original.material)
    if (!original.matrixWorld.equals(_identity)) {
      mesh.geometry.applyMatrix4(original.matrixWorld)
    }
    if (mesh.geometry.index) mesh.geometry = mesh.geometry.toNonIndexed()
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals()
    return mesh
  })
}

export function mergeGroupWithSplit(root: Object3D): {
  combined: Mesh
  opaque?: { geometry: BufferGeometry; doubleSided: boolean }
  transparent?: { geometry: BufferGeometry; doubleSided: boolean }
} {
  root.updateMatrixWorld()
  const originalMeshes: Mesh[] = []
  extractMeshes(root, originalMeshes)

  const processedMeshes: Mesh[] = preprocessMeshes(originalMeshes)

  let combinedCount = 0,
    opaqueCount = 0,
    transparentCount = 0
  let combinedDoubleSided = false,
    opaqueDoubleSided = false,
    transparentDoubleSided = false

  for (const mesh of processedMeshes) {
    const count = mesh.geometry.attributes.position.count
    const material = mesh.material as MeshStandardMaterial
    const isDoubleSided = material.side === DoubleSide
    const hasTransparencySupport = mesh.geometry.attributes.color?.itemSize === 4 || material.transparent

    combinedCount += count
    if (isDoubleSided) combinedDoubleSided = true

    if (hasTransparencySupport) {
      transparentCount += count
      if (isDoubleSided) transparentDoubleSided = true
    } else {
      opaqueCount += count
      if (isDoubleSided) opaqueDoubleSided = true
    }
  }

  const combinedPositions = new Float32Array(combinedCount * 3)
  const combinedNormals = new Float32Array(combinedCount * 3)
  const combinedColors = new Uint8Array(combinedCount * 3)

  const opaquePositions = opaqueCount > 0 ? new Float32Array(opaqueCount * 3) : null
  const opaqueNormals = opaqueCount > 0 ? new Float32Array(opaqueCount * 3) : null
  const opaqueColors = opaqueCount > 0 ? new Uint8Array(opaqueCount * 3) : null

  const transparentPositions = transparentCount > 0 ? new Float32Array(transparentCount * 3) : null
  const transparentNormals = transparentCount > 0 ? new Float32Array(transparentCount * 3) : null
  const transparentColors = transparentCount > 0 ? new Uint8Array(transparentCount * 4) : null

  let combinedPtr = 0,
    opaquePtr = 0,
    transparentPtr = 0,
    transparentColorPtr = 0

  for (const mesh of processedMeshes) {
    const { position, normal } = mesh.geometry.attributes
    const vertexCount = position.count
    const material = mesh.material as MeshStandardMaterial
    const hasTransparencySupport = mesh.geometry.attributes.color?.itemSize === 4 || material.transparent

    combinedPositions.set(position.array, combinedPtr)
    combinedNormals.set(normal.array, combinedPtr)
    const combinedMeshColors = extractColors(mesh, vertexCount, 3)
    combinedColors.set(combinedMeshColors, combinedPtr)
    combinedPtr += vertexCount * 3

    if (hasTransparencySupport) {
      if (transparentPositions && transparentNormals && transparentColors) {
        transparentPositions.set(position.array, transparentPtr)
        transparentNormals.set(normal.array, transparentPtr)
        const transparentMeshColors = extractColors(mesh, vertexCount, 4)
        transparentColors.set(transparentMeshColors, transparentColorPtr)
        transparentPtr += vertexCount * 3
        transparentColorPtr += vertexCount * 4
      }
    } else {
      if (opaquePositions && opaqueNormals && opaqueColors) {
        opaquePositions.set(position.array, opaquePtr)
        opaqueNormals.set(normal.array, opaquePtr)
        const opaqueMeshColors = extractColors(mesh, vertexCount, 3)
        opaqueColors.set(opaqueMeshColors, opaquePtr)
        opaquePtr += vertexCount * 3
      }
    }
  }

  const combinedGeometry = new BufferGeometry()
  combinedGeometry.setAttribute("position", new BufferAttribute(combinedPositions, 3))
  combinedGeometry.setAttribute("normal", new BufferAttribute(combinedNormals, 3))
  combinedGeometry.setAttribute("color", new BufferAttribute(combinedColors, 3, true))

  const result = {
    combined: new Mesh(
      combinedGeometry,
      new MeshLambertMaterial({
        vertexColors: true,
        side: combinedDoubleSided ? DoubleSide : FrontSide,
      }),
    ),
  } as {
    combined: Mesh
    opaque?: { geometry: BufferGeometry; doubleSided: boolean }
    transparent?: { geometry: BufferGeometry; doubleSided: boolean }
  }

  if (opaquePositions && opaqueNormals && opaqueColors) {
    const opaqueGeometry = new BufferGeometry()
    opaqueGeometry.setAttribute("position", new BufferAttribute(opaquePositions, 3))
    opaqueGeometry.setAttribute("normal", new BufferAttribute(opaqueNormals, 3))
    opaqueGeometry.setAttribute("color", new BufferAttribute(opaqueColors, 3, true))
    result.opaque = { geometry: opaqueGeometry, doubleSided: opaqueDoubleSided }
  }

  if (transparentPositions && transparentNormals && transparentColors) {
    const transparentGeometry = new BufferGeometry()
    transparentGeometry.setAttribute("position", new BufferAttribute(transparentPositions, 3))
    transparentGeometry.setAttribute("normal", new BufferAttribute(transparentNormals, 3))
    transparentGeometry.setAttribute("color", new BufferAttribute(transparentColors, 4, true))
    result.transparent = { geometry: transparentGeometry, doubleSided: transparentDoubleSided }
  }

  return result
}

export const yUpToZUp = new Matrix4().makeRotationX(Math.PI / 2)
