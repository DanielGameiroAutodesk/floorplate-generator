import { BufferGeometry, Float32BufferAttribute } from "three"
import { describe, expect, it } from "vitest"
import {
  calculateGeometryVolume,
  calculateTetrahedronVolume,
  getVertex,
  polygonArea,
  polygonPerimeter,
} from "./geometryUtils"

describe("geometryUtils", () => {
  describe("getVertex", () => {
    it("should return the correct vertex from the Float32Array", () => {
      const vertices = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
      const index = 2
      const result = getVertex(vertices, index)
      expect(result).toEqual([7, 8, 9])
    })
  })

  describe("calculateTetrahedronVolume", () => {
    it("should calculate the correct volume for a simple tetrahedron", () => {
      const p1: [number, number, number] = [1, 0, 0]
      const p2: [number, number, number] = [0, 1, 0]
      const p3: [number, number, number] = [0, 0, 1]
      const result = calculateTetrahedronVolume(p1, p2, p3)
      expect(result).toBeCloseTo(1 / 6, 5) // Volume of a unit tetrahedron
    })

    it("should return 0 for coplanar points", () => {
      const p1: [number, number, number] = [1, 0, 0]
      const p2: [number, number, number] = [2, 0, 0]
      const p3: [number, number, number] = [3, 0, 0]
      const result = calculateTetrahedronVolume(p1, p2, p3)
      expect(result).toBe(0)
    })
  })

  describe("calculateGeometryVolume", () => {
    it("should calculate the correct volume for a simple geometry", () => {
      let geometry = new BufferGeometry()

      // Define vertices for a tetrahedron
      const vertices = new Float32Array([
        1, // p1
        0, // p1
        0, // p1
        0, // p2
        1, // p2
        0, // p2
        0, // p3
        0, // p3
        1, // p3
        0, // origin
        0, // origin
        0, // origin
      ])
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3))

      // Define indices for the tetrahedron
      const indices = [0, 1, 2]
      geometry.setIndex(indices)

      const result = calculateGeometryVolume(geometry)
      expect(result).toBeCloseTo(1 / 6, 5) // Volume of a unit tetrahedron with orthogonal edges of unit length
    })

    it("should throw an error if the geometry has no index", () => {
      const geometry = new BufferGeometry()
      const vertices = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])
      geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3))

      expect(() => calculateGeometryVolume(geometry)).toThrow("Geometry must have an index to calculate volume.")
    })
  })
})

describe("geometryUtils", () => {
  describe("polygonArea", () => {
    it("should calculate the area of a triangle", () => {
      const triangle = [
        [0, 0],
        [4, 0],
        [0, 3],
      ]
      expect(polygonArea(triangle)).toBeCloseTo(6) // Area = 0.5 * base * height
    })

    it("should calculate the area of a regular polygon approximating a circle", () => {
      const radius = 1
      const sides = 100
      const circleApproximation = Array.from({ length: sides }, (_, i) => {
        const angle = (2 * Math.PI * i) / sides
        return [radius * Math.cos(angle), radius * Math.sin(angle)]
      })
      expect(polygonArea(circleApproximation)).toBeCloseTo(Math.PI, 2) // Area of a unit circle = pi
    })
  })

  describe("polygonPerimeter", () => {
    it("should calculate the perimeter of a triangle", () => {
      const triangle = [
        [0, 0],
        [4, 0],
        [0, 3],
      ]
      expect(polygonPerimeter(triangle)).toBeCloseTo(12) // Perimeter = sum of side lengths
    })

    it("should calculate the perimeter of a regular polygon approximating a circle", () => {
      const radius = 1
      const sides = 100
      const circleApproximation = Array.from({ length: sides }, (_, i) => {
        const angle = (2 * Math.PI * i) / sides
        return [radius * Math.cos(angle), radius * Math.sin(angle)]
      })
      expect(polygonPerimeter(circleApproximation)).toBeCloseTo(2 * Math.PI, 2) // Perimeter of a unit circle = 2π
    })
  })
})
