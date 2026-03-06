import type { Matrix4 } from "three"
import { Matrix3, Vector3 } from "three"

export function transformPosition(position: Float32Array, matrix: Matrix4): Float32Array {
  const transformedPosition = new Float32Array(position.length)
  const reusableVec = new Vector3()

  for (let i = 0; i < position.length; i += 3) {
    reusableVec.set(position[i], position[i + 1], position[i + 2])
    reusableVec.applyMatrix4(matrix)
    transformedPosition[i] = reusableVec.x
    transformedPosition[i + 1] = reusableVec.y
    transformedPosition[i + 2] = reusableVec.z
  }

  return transformedPosition
}

export function transformNormal(normal: Float32Array, matrix: Matrix4): Float32Array {
  const transformedNormal = new Float32Array(normal.length)
  const reusableVec = new Vector3()

  // The matrix needed to transform normals is not the same as the matrix used for transformation of positions.
  // see: https://stackoverflow.com/questions/13654401/why-transform-normals-with-the-transpose-of-the-inverse-of-the-modelview-matrix
  const normalMatrix = new Matrix3().getNormalMatrix(matrix)

  for (let i = 0; i < normal.length; i += 3) {
    reusableVec.set(normal[i], normal[i + 1], normal[i + 2])
    reusableVec.applyNormalMatrix(normalMatrix)
    transformedNormal[i] = reusableVec.x
    transformedNormal[i + 1] = reusableVec.y
    transformedNormal[i + 2] = reusableVec.z
  }

  return transformedNormal
}
