import { describe, expect, it } from "vitest"
import {
  DEFAULT_BUFFER,
  denormalizeBuffer,
  MAX_BUFFER,
  MIN_BUFFER,
  normalizeBuffer,
  parseBuffer,
  perecentageToBufferRatioString,
  trimNumber,
} from "./bufferOperations"

describe("bufferOperations", () => {
  describe("normalizeBuffer", () => {
    it("should normalize buffer values correctly", () => {
      expect(normalizeBuffer(MIN_BUFFER)).toBeCloseTo(0)
      expect(normalizeBuffer(MAX_BUFFER)).toBeCloseTo(1)
      expect(normalizeBuffer(MIN_BUFFER + MAX_BUFFER) / 2).toBeCloseTo(0.5)
    })
  })

  describe("denormalizeBuffer", () => {
    it("should denormalize buffer values correctly", () => {
      expect(denormalizeBuffer(0)).toBeCloseTo(MIN_BUFFER)
      expect(denormalizeBuffer(1)).toBeCloseTo(MAX_BUFFER)
      expect((denormalizeBuffer(0) + denormalizeBuffer(1)) / 2).toBeCloseTo((MIN_BUFFER + MAX_BUFFER) / 2)
    })
  })

  describe("parseBuffer", () => {
    it("should parse buffer strings correctly", () => {
      expect(parseBuffer("1:1")).toBeCloseTo(100)
      expect(parseBuffer("2:1")).toBeCloseTo(200)
      expect(parseBuffer("1:2")).toBeCloseTo(50)
      expect(parseBuffer("invalid")).toBe(DEFAULT_BUFFER)
    })

    it("should return default buffer if no second number is provided", () => {
      expect(parseBuffer("1000")).toBe(DEFAULT_BUFFER)
    })

    it("should return closest allowed value if outside range", () => {
      expect(parseBuffer("10000:1")).toBe(MAX_BUFFER)
      expect(parseBuffer("1:10000")).toBe(MIN_BUFFER)
    })
  })

  describe("perecentageToBufferRatioString", () => {
    it("should convert percentages to buffer ratio strings correctly", () => {
      expect(perecentageToBufferRatioString(100)).toBe("1:1")
      expect(perecentageToBufferRatioString(200)).toBe("2:1")
      expect(perecentageToBufferRatioString(50)).toBe("1:2")
      expect(perecentageToBufferRatioString(undefined)).toBe(`${DEFAULT_BUFFER / 100}:1`)
    })

    it("should handle unusual formats", () => {
      expect(parseBuffer("1/1")).toBeCloseTo(100)
      expect(parseBuffer("1:1:1")).toBe(100)
    })
  })

  describe("trimNumber", () => {
    it("should trim numbers correctly", () => {
      expect(trimNumber(1.234)).toBe("1.23")
      expect(trimNumber(1.23)).toBe("1.23")
      expect(trimNumber(1.2)).toBe("1.2")
      expect(trimNumber(1.0)).toBe("1")
    })

    it("should handle numbers with more than two decimal places", () => {
      expect(trimNumber(1.23456)).toBe("1.23")
    })

    it("should handle numbers with no decimal places", () => {
      expect(trimNumber(1)).toBe("1")
    })
  })
})
