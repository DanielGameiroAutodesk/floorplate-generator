import type { Vertex } from "src/integrations/composition-site-graph/graph/types"

type Vector = {
  x: number
  y: number
}

function getVector(start: Vertex, end: Vertex): Vector {
  return {
    x: end.x - start.x,
    y: end.y - start.y,
  }
}

function edgeLength(start: Vertex, end: Vertex): number {
  const vector = getVector(start, end)
  return Math.sqrt(vector.x ** 2 + vector.y ** 2)
}

function determinant(vector1: Vector, vector2: Vector) {
  return vector1.x * vector2.y - vector1.y * vector2.x
}

function polygonArea(poly: Vector[]) {
  let area = 0
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i]
    const p2 = poly[(i + 1) % poly.length]
    area += determinant(p1, p2)
  }
  return 0.5 * area
}

function normalizeVector(vector: Vector): Vector {
  const length = Math.sqrt(vector.x ** 2 + vector.y ** 2)
  return {
    x: vector.x / length,
    y: vector.y / length,
  }
}

export const mod = (n: number, m: number): number => ((n % m) + m) % m

function scoreDirection(currentDirection: Vector, candidateDirection: Vector) {
  const prevAngle = mod(Math.atan2(-currentDirection.y, -currentDirection.x), Math.PI * 2)
  const candidateAngle = mod(Math.atan2(candidateDirection.y, candidateDirection.x), Math.PI * 2)
  return mod(prevAngle - candidateAngle, Math.PI * 2)
}

function argMin(array: number[]): number {
  let argmin = 0
  let min_value = 99999999999999
  for (let i = 0; i < array.length; i++) {
    if (array[i] < min_value) {
      argmin = i
      min_value = array[i]
    }
  }
  return argmin
}
function argMax(array: number[]): number {
  let argmax = 0
  let max_value = -99999999999999
  for (let i = 0; i < array.length; i++) {
    if (array[i] > max_value) {
      argmax = i
      max_value = array[i]
    }
  }
  return argmax
}

export type { Vector }

export default {
  polygonArea,
  edgeLength,
  getVector,
  normalizeVector,
  scoreDirection,
  argMin,
  argMax,
}
