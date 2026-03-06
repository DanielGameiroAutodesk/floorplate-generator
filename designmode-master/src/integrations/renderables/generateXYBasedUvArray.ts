import type { BufferAttribute, InterleavedBufferAttribute } from "three"

/**
 * Generate a UV array based on the position array. The UV array is normalized to the bounding box of the position array.
 */

export function generateXYBasedUvArray(position: BufferAttribute | InterleavedBufferAttribute): Float32Array {
  const uvArray = new Float32Array(position.count * 2)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let i = 0; i < position.count; i++) {
    minX = Math.min(position.getX(i), minX)
    minY = Math.min(position.getY(i), minY)
    maxX = Math.max(position.getX(i), maxX)
    maxY = Math.max(position.getY(i), maxY)
  }

  const normaliseX = (number: number): number => {
    return (number - minX) / (maxX - minX)
  }

  const normaliseY = (number: number): number => {
    return (number - minY) / (maxY - minY)
  }

  for (let i = 0; i < position.count; i++) {
    const offset = i * 2
    uvArray[offset] = normaliseX(position.getX(i))
    uvArray[offset + 1] = normaliseY(position.getY(i))
  }

  return uvArray
}
