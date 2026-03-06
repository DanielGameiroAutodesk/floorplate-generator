export function recalculateUVs(position: Float32Array, refPoint: [number, number], bboxLocal: [number, number][]) {
  const offset_x = refPoint[0] - bboxLocal[0][0]
  const offset_y = refPoint[1] - bboxLocal[0][1]
  const width = bboxLocal[1][0] - bboxLocal[0][0]
  const height = bboxLocal[1][1] - bboxLocal[0][1]

  const newUvs = new Array((2 * position.length) / 3)
  for (let i = 0; i < position.length / 3; i++) {
    newUvs[2 * i] = (position[3 * i] + offset_x) / width
    newUvs[2 * i + 1] = 1 - (position[3 * i + 1] + offset_y) / height
  }
  return new Float32Array(newUvs)
}
