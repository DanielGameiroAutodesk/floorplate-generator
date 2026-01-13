/**
 * Tests for point utility functions
 */

import {
  createPoint,
  distance,
  distanceSquared,
  midpoint,
  translate,
  rotateAroundOrigin,
  rotateAroundPoint,
  scale,
  lerp,
  equals,
  angleBetween,
  pointAtAngle,
  degreesToRadians,
  radiansToDegrees
} from './point';

describe('Point utilities', () => {
  describe('createPoint', () => {
    it('should create a point with x and y coordinates', () => {
      const p = createPoint(3, 4);
      expect(p.x).toBe(3);
      expect(p.y).toBe(4);
    });
  });

  describe('distance', () => {
    it('should calculate distance between two points', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(3, 4);
      expect(distance(p1, p2)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const p = createPoint(5, 5);
      expect(distance(p, p)).toBe(0);
    });

    it('should work with negative coordinates', () => {
      const p1 = createPoint(-3, -4);
      const p2 = createPoint(0, 0);
      expect(distance(p1, p2)).toBe(5);
    });
  });

  describe('distanceSquared', () => {
    it('should calculate squared distance', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(3, 4);
      expect(distanceSquared(p1, p2)).toBe(25);
    });
  });

  describe('midpoint', () => {
    it('should calculate midpoint between two points', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(10, 10);
      const mid = midpoint(p1, p2);
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });
  });

  describe('translate', () => {
    it('should translate point by dx and dy', () => {
      const p = createPoint(5, 5);
      const translated = translate(p, 3, -2);
      expect(translated.x).toBe(8);
      expect(translated.y).toBe(3);
    });

    it('should not mutate original point', () => {
      const p = createPoint(5, 5);
      translate(p, 3, -2);
      expect(p.x).toBe(5);
      expect(p.y).toBe(5);
    });
  });

  describe('rotateAroundOrigin', () => {
    it('should rotate 90 degrees counter-clockwise', () => {
      const p = createPoint(1, 0);
      const rotated = rotateAroundOrigin(p, Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0, 10);
      expect(rotated.y).toBeCloseTo(1, 10);
    });

    it('should rotate 180 degrees', () => {
      const p = createPoint(1, 0);
      const rotated = rotateAroundOrigin(p, Math.PI);
      expect(rotated.x).toBeCloseTo(-1, 10);
      expect(rotated.y).toBeCloseTo(0, 10);
    });
  });

  describe('rotateAroundPoint', () => {
    it('should rotate around a center point', () => {
      const p = createPoint(2, 0);
      const center = createPoint(1, 0);
      const rotated = rotateAroundPoint(p, center, Math.PI / 2);
      expect(rotated.x).toBeCloseTo(1, 10);
      expect(rotated.y).toBeCloseTo(1, 10);
    });
  });

  describe('scale', () => {
    it('should scale point from origin', () => {
      const p = createPoint(2, 3);
      const scaled = scale(p, 2);
      expect(scaled.x).toBe(4);
      expect(scaled.y).toBe(6);
    });
  });

  describe('lerp', () => {
    it('should return start point at t=0', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(10, 10);
      const result = lerp(p1, p2, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should return end point at t=1', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(10, 10);
      const result = lerp(p1, p2, 1);
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });

    it('should return midpoint at t=0.5', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(10, 10);
      const result = lerp(p1, p2, 0.5);
      expect(result.x).toBe(5);
      expect(result.y).toBe(5);
    });
  });

  describe('equals', () => {
    it('should return true for equal points', () => {
      const p1 = createPoint(5, 5);
      const p2 = createPoint(5, 5);
      expect(equals(p1, p2)).toBe(true);
    });

    it('should return false for different points', () => {
      const p1 = createPoint(5, 5);
      const p2 = createPoint(5, 6);
      expect(equals(p1, p2)).toBe(false);
    });

    it('should use epsilon tolerance', () => {
      const p1 = createPoint(5, 5);
      const p2 = createPoint(5.00001, 5.00001);
      expect(equals(p1, p2, 0.0001)).toBe(true);
      expect(equals(p1, p2, 0.000001)).toBe(false);
    });
  });

  describe('angleBetween', () => {
    it('should return 0 for horizontal right direction', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(10, 0);
      expect(angleBetween(p1, p2)).toBe(0);
    });

    it('should return PI/2 for vertical up direction', () => {
      const p1 = createPoint(0, 0);
      const p2 = createPoint(0, 10);
      expect(angleBetween(p1, p2)).toBeCloseTo(Math.PI / 2, 10);
    });
  });

  describe('pointAtAngle', () => {
    it('should create point at given distance and angle', () => {
      const start = createPoint(0, 0);
      const result = pointAtAngle(start, 0, 10);
      expect(result.x).toBeCloseTo(10, 10);
      expect(result.y).toBeCloseTo(0, 10);
    });

    it('should work with 45 degree angle', () => {
      const start = createPoint(0, 0);
      const result = pointAtAngle(start, Math.PI / 4, Math.sqrt(2));
      expect(result.x).toBeCloseTo(1, 10);
      expect(result.y).toBeCloseTo(1, 10);
    });
  });

  describe('angle conversions', () => {
    it('should convert degrees to radians', () => {
      expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 10);
      expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2, 10);
      expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI, 10);
    });

    it('should convert radians to degrees', () => {
      expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 10);
      expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
      expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360, 10);
    });
  });
});
