export function vectorLength(vector: number[]) {
  return Math.sqrt(Math.pow(vector[0], 2) + Math.pow(vector[1], 2) + Math.pow(vector[2], 2))
}

export function getVectorFromPointToPoint(startPoint: number[], endPoint: number[]) {
  return [endPoint[0] - startPoint[0], endPoint[1] - startPoint[1], endPoint[2] - startPoint[2]]
}

export function pointPointDistance(point1: number[], point2: number[]) {
  return Math.sqrt(
    Math.pow(point2[0] - point1[0], 2) + Math.pow(point2[1] - point1[1], 2) + Math.pow(point2[2] - point1[2], 2),
  )
}

export function scale(vector: number[], scalar: number) {
  return [scalar * vector[0], scalar * vector[1], scalar * vector[2]]
}

export function addVectorToPoint(point: number[], vector: number[]) {
  return [point[0] + vector[0], point[1] + vector[1], point[2] + vector[2]]
}

export function normalizeVector(vector: number[]) {
  const length = vectorLength(vector)
  return [vector[0] / length, vector[1] / length, vector[2] / length]
}

export function movePointAlongVector(point: number[], vector: number[], distance: number) {
  const moveVector = scale(normalizeVector(vector), distance)
  return addVectorToPoint(point, moveVector)
}

export function movePointAlongTwoVectors(
  point: number[],
  vectorU: number[],
  vectorV: number[],
  distanceU: number,
  distanceV: number,
) {
  const moveVectorU = scale(normalizeVector(vectorU), distanceU)
  const moveVectorV = scale(normalizeVector(vectorV), distanceV)
  return addVectorToPoint(addVectorToPoint(point, moveVectorU), moveVectorV)
}

export function getCrossProduct(a: number[], b: number[]) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
