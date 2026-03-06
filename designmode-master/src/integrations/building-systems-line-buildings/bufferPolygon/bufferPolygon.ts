import type { Polygon } from "./lib/Types"
import { runBufferedPolygon } from "./lib/bufferPolygonGenerator"

export type BufferPolygonParameters = {
  bufferDistance: number
}

function generateBufferedPolygon(polygon: Polygon, parameters: BufferPolygonParameters): Polygon[] {
  const { bufferDistance } = parameters
  return runBufferedPolygon(polygon, bufferDistance)
}

export const bufferPolygon = {
  description: "Generate a buffered polygon",
  inputType: "Polygon",
  outPutType: "Polygon",
  generate: generateBufferedPolygon,
}
