/**
 * Rectangle Utility Tests
 */

import {
  createRectangle,
  rectangleArea,
  rectanglePerimeter,
  rectangleCenter,
  rectangleCorners,
  rectanglesOverlap,
  pointInRectangle,
  expandRectangle,
  rectangleIntersection
} from './rectangle';

describe('Rectangle utilities', () => {
  describe('createRectangle', () => {
    it('should create rectangle from position and dimensions', () => {
      const rect = createRectangle(0, 0, 10, 5);

      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(10);
      expect(rect.height).toBe(5);
    });
  });

  describe('rectangleArea', () => {
    it('should calculate area correctly', () => {
      const rect = createRectangle(0, 0, 10, 5);
      expect(rectangleArea(rect)).toBe(50);
    });

    it('should handle zero width or height', () => {
      const zeroWidth = createRectangle(0, 0, 0, 5);
      const zeroHeight = createRectangle(0, 0, 10, 0);

      expect(rectangleArea(zeroWidth)).toBe(0);
      expect(rectangleArea(zeroHeight)).toBe(0);
    });
  });

  describe('rectanglePerimeter', () => {
    it('should calculate perimeter correctly', () => {
      const rect = createRectangle(0, 0, 10, 5);
      expect(rectanglePerimeter(rect)).toBe(30); // 2 * (10 + 5)
    });

    it('should handle square', () => {
      const square = createRectangle(0, 0, 7, 7);
      expect(rectanglePerimeter(square)).toBe(28);
    });
  });

  describe('rectangleCenter', () => {
    it('should find center of rectangle at origin', () => {
      const rect = createRectangle(0, 0, 10, 10);
      const center = rectangleCenter(rect);

      expect(center.x).toBe(5);
      expect(center.y).toBe(5);
    });

    it('should find center of offset rectangle', () => {
      const rect = createRectangle(10, 20, 8, 6);
      const center = rectangleCenter(rect);

      expect(center.x).toBe(14); // 10 + 8/2
      expect(center.y).toBe(23); // 20 + 6/2
    });
  });

  describe('rectangleCorners', () => {
    it('should return all four corners', () => {
      const rect = createRectangle(0, 0, 10, 5);
      const corners = rectangleCorners(rect);

      expect(corners).toHaveLength(4);
      expect(corners).toContainEqual({ x: 0, y: 0 });
      expect(corners).toContainEqual({ x: 10, y: 0 });
      expect(corners).toContainEqual({ x: 10, y: 5 });
      expect(corners).toContainEqual({ x: 0, y: 5 });
    });
  });

  describe('rectanglesOverlap', () => {
    it('should detect overlapping rectangles', () => {
      const rect1 = createRectangle(0, 0, 10, 10);
      const rect2 = createRectangle(5, 5, 10, 10);

      expect(rectanglesOverlap(rect1, rect2)).toBe(true);
    });

    it('should return false for non-overlapping rectangles', () => {
      const rect1 = createRectangle(0, 0, 10, 10);
      const rect2 = createRectangle(20, 20, 10, 10);

      expect(rectanglesOverlap(rect1, rect2)).toBe(false);
    });

    it('should handle touching edges (overlapping at edge)', () => {
      const rect1 = createRectangle(0, 0, 10, 10);
      const rect2 = createRectangle(10, 0, 10, 10);

      // Implementation uses < not <=, so touching at edge is overlapping
      expect(rectanglesOverlap(rect1, rect2)).toBe(true);
    });

    it('should detect when one rectangle contains another', () => {
      const outer = createRectangle(0, 0, 20, 20);
      const inner = createRectangle(5, 5, 5, 5);

      expect(rectanglesOverlap(outer, inner)).toBe(true);
    });
  });

  describe('pointInRectangle', () => {
    const rect = createRectangle(0, 0, 10, 10);

    it('should return true for point inside', () => {
      expect(pointInRectangle(rect, { x: 5, y: 5 })).toBe(true);
      expect(pointInRectangle(rect, { x: 1, y: 1 })).toBe(true);
    });

    it('should return false for point outside', () => {
      expect(pointInRectangle(rect, { x: 15, y: 5 })).toBe(false);
      expect(pointInRectangle(rect, { x: -1, y: 5 })).toBe(false);
    });

    it('should handle point on boundary', () => {
      // Boundary behavior - on edge typically considered inside
      expect(pointInRectangle(rect, { x: 0, y: 5 })).toBe(true);
      expect(pointInRectangle(rect, { x: 10, y: 5 })).toBe(true);
    });
  });

  describe('expandRectangle', () => {
    it('should expand rectangle uniformly', () => {
      const rect = createRectangle(5, 5, 10, 10);
      const expanded = expandRectangle(rect, 2);

      expect(expanded.x).toBe(3);  // 5 - 2
      expect(expanded.y).toBe(3);  // 5 - 2
      expect(expanded.width).toBe(14);  // 10 + 4
      expect(expanded.height).toBe(14); // 10 + 4
    });

    it('should handle negative expansion (shrinking)', () => {
      const rect = createRectangle(0, 0, 20, 20);
      const shrunk = expandRectangle(rect, -2);

      expect(shrunk.x).toBe(2);
      expect(shrunk.y).toBe(2);
      expect(shrunk.width).toBe(16);
      expect(shrunk.height).toBe(16);
    });
  });

  describe('rectangleIntersection', () => {
    it('should find intersection of overlapping rectangles', () => {
      const rect1 = createRectangle(0, 0, 10, 10);
      const rect2 = createRectangle(5, 5, 10, 10);

      const intersection = rectangleIntersection(rect1, rect2);

      expect(intersection).not.toBeNull();
      expect(intersection!.x).toBe(5);
      expect(intersection!.y).toBe(5);
      expect(intersection!.width).toBe(5);
      expect(intersection!.height).toBe(5);
    });

    it('should return null for non-overlapping rectangles', () => {
      const rect1 = createRectangle(0, 0, 10, 10);
      const rect2 = createRectangle(20, 20, 10, 10);

      const intersection = rectangleIntersection(rect1, rect2);

      expect(intersection).toBeNull();
    });
  });
});
