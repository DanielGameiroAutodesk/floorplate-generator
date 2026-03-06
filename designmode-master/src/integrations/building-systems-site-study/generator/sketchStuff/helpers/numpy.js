import { normalizeVector } from "./geometry.js"

export const mod = (n, m) => ((n % m) + m) % m

export function distance(p1, p2) {
  return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
}

export function normalizedVectorFromPoints(point1, point2) {
  const vector = [point2[0] - point1[0], point2[1] - point1[1]]
  return normalizeVector(vector)
}

export function getDotProduct(vec1, vec2) {
  return vec1[0] * vec2[0] + vec1[1] * vec2[1]
}

export function clipValue(value, lowerLimit, upperLimit) {
  if (value < lowerLimit) return lowerLimit
  if (value > upperLimit) return upperLimit
  return value
}

export function setValueAboveThresholdToOne(value, threshold) {
  return value > threshold ? 1 : 0
}

export function gradOfArray(array) {
  const grad = []
  const n = array.length
  for (let i = 0; i < n; i++) {
    grad.push(array[mod(i + 1, n)] - array[i])
  }
  return grad
}

export function where(array) {
  const indexesFound = []
  for (let i = 0; i < array.length; i++) {
    if (array[i] !== 0) indexesFound.push(i)
  }
  return indexesFound
}

export function replaceIntervalInArray(array, insertNumber, startIndex, endIndex) {
  let resArray = array
  for (let i = startIndex; i < endIndex; i++) {
    resArray[i] = insertNumber
  }

  return resArray
}

export function argMax(array) {
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

export function argMin(array) {
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

export function sumOfArray(array) {
  return array.reduce((sum, c) => sum + c, 0)
}

export function interpolatePoints(p1, p2, t) {
  const x = t * p1[0] + (1 - t) * p2[0]
  const y = t * p1[1] + (1 - t) * p2[1]
  return [x, y]
}

export function pointsAreEqual(p1, p2, precision) {
  if (distance(p1, p2) < precision) return true
  return false
}

export function getIndexOf(element, list) {
  let index = -1
  for (let i = 0; i < list.length; i++) {
    if (list[i] === element) return i
  }
  return index
}
