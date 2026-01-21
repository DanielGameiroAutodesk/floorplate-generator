/**
 * Polygon Utility Tests
 */

import {
  createPolygon,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
  pointInPolygon,
  isConvex,
  polygonBoundingBox
} from './polygon';

describe('Polygon utilities', () => {
  // Simple square: 10x10 centered at origin
  const square = createPolygon([
    { x: -5, y: -5 },
    { x: 5, y: -5 },
    { x: 5, y: 5 },
    { x: -5, y: 5 }
  ]);

  // Right triangle: 3-4-5
  const triangle = createPolygon([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 }
  ]);

  // L-shaped polygon (concave)
  const lShape = createPolygon([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 5, y: 5 },
    { x: 5, y: 10 },
    { x: 0, y: 10 }
  ]);

  describe('createPolygon', () => {
    it('should create polygon with correct number of vertices', () => {
      expect(square.vertices.length).toBe(4);
      expect(triangle.vertices.length).toBe(3);
    });
  });

  describe('polygonArea', () => {
    it('should calculate area of square', () => {
      expect(polygonArea(square)).toBeCloseTo(100); // 10 * 10
    });

    it('should calculate area of triangle', () => {
      expect(polygonArea(triangle)).toBeCloseTo(6); // 0.5 * 4 * 3
    });

    it('should calculate area of L-shape', () => {
      // L-shape: 10x10 minus 5x5 corner = 100 - 25 = 75
      expect(polygonArea(lShape)).toBeCloseTo(75);
    });

    it('should return positive area regardless of winding', () => {
      const clockwise = createPolygon([
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 }
      ]);
      expect(polygonArea(clockwise)).toBeGreaterThan(0);
    });
  });

  describe('polygonCentroid', () => {
    it('should find centroid of square at origin', () => {
      const centroid = polygonCentroid(square);
      expect(centroid.x).toBeCloseTo(0);
      expect(centroid.y).toBeCloseTo(0);
    });

    it('should find centroid of offset square', () => {
      const offsetSquare = createPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ]);
      const centroid = polygonCentroid(offsetSquare);
      expect(centroid.x).toBeCloseTo(5);
      expect(centroid.y).toBeCloseTo(5);
    });
  });

  describe('polygonPerimeter', () => {
    it('should calculate perimeter of square', () => {
      expect(polygonPerimeter(square)).toBeCloseTo(40); // 4 * 10
    });

    it('should calculate perimeter of triangle', () => {
      expect(polygonPerimeter(triangle)).toBeCloseTo(12); // 3 + 4 + 5
    });
  });

  describe('pointInPolygon', () => {
    it('should return true for point inside square', () => {
      expect(pointInPolygon(square, { x: 0, y: 0 })).toBe(true);
      expect(pointInPolygon(square, { x: 3, y: 3 })).toBe(true);
    });

    it('should return false for point outside square', () => {
      expect(pointInPolygon(square, { x: 10, y: 10 })).toBe(false);
      expect(pointInPolygon(square, { x: -10, y: 0 })).toBe(false);
    });

    it('should handle points on boundary', () => {
      // Boundary behavior can vary - typically considered inside or outside consistently
      const onEdge = { x: 5, y: 0 };
      // Just verify it doesn't crash and returns a boolean
      expect(typeof pointInPolygon(square, onEdge)).toBe('boolean');
    });

    it('should work with concave polygons', () => {
      // Point in the "notch" of L-shape should be outside
      expect(pointInPolygon(lShape, { x: 7, y: 7 })).toBe(false);
      // Point in the valid area should be inside
      expect(pointInPolygon(lShape, { x: 2, y: 2 })).toBe(true);
    });
  });

  describe('isConvex', () => {
    it('should return true for convex square', () => {
      expect(isConvex(square)).toBe(true);
    });

    it('should return true for convex triangle', () => {
      expect(isConvex(triangle)).toBe(true);
    });

    it('should return false for concave L-shape', () => {
      expect(isConvex(lShape)).toBe(false);
    });
  });

  describe('polygonBoundingBox', () => {
    it('should calculate bounds of square', () => {
      const bounds = polygonBoundingBox(square);

      expect(bounds.minX).toBe(-5);
      expect(bounds.maxX).toBe(5);
      expect(bounds.minY).toBe(-5);
      expect(bounds.maxY).toBe(5);
    });

    it('should calculate bounds of L-shape', () => {
      const bounds = polygonBoundingBox(lShape);

      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(10);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(10);
    });
  });
});
