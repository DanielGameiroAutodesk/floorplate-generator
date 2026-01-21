/**
 * Line Utility Tests
 */

import {
  createLine,
  lineLength,
  lineMidpoint,
  pointOnLine,
  lineIntersection,
  distanceToSegment,
  closestPointOnSegment,
  parallelLine,
  perpendicularVector
} from './line';

describe('Line utilities', () => {
  describe('createLine', () => {
    it('should create a line from two points', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });

      expect(line.start.x).toBe(0);
      expect(line.start.y).toBe(0);
      expect(line.end.x).toBe(10);
      expect(line.end.y).toBe(0);
    });
  });

  describe('lineLength', () => {
    it('should calculate length of horizontal line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      expect(lineLength(line)).toBe(10);
    });

    it('should calculate length of vertical line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 0, y: 5 });
      expect(lineLength(line)).toBe(5);
    });

    it('should calculate length of diagonal line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 3, y: 4 });
      expect(lineLength(line)).toBe(5); // 3-4-5 triangle
    });

    it('should return 0 for zero-length line', () => {
      const line = createLine({ x: 5, y: 5 }, { x: 5, y: 5 });
      expect(lineLength(line)).toBe(0);
    });
  });

  describe('lineMidpoint', () => {
    it('should find midpoint of horizontal line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const mid = lineMidpoint(line);

      expect(mid.x).toBe(5);
      expect(mid.y).toBe(0);
    });

    it('should find midpoint of diagonal line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 10 });
      const mid = lineMidpoint(line);

      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });
  });

  describe('pointOnLine', () => {
    it('should return start point at t=0', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = pointOnLine(line, 0);

      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    });

    it('should return end point at t=1', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = pointOnLine(line, 1);

      expect(point.x).toBe(10);
      expect(point.y).toBe(0);
    });

    it('should return midpoint at t=0.5', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 10 });
      const point = pointOnLine(line, 0.5);

      expect(point.x).toBe(5);
      expect(point.y).toBe(5);
    });
  });

  describe('lineIntersection', () => {
    it('should find intersection of perpendicular lines', () => {
      const horizontal = createLine({ x: 0, y: 5 }, { x: 10, y: 5 });
      const vertical = createLine({ x: 5, y: 0 }, { x: 5, y: 10 });

      const result = lineIntersection(horizontal, vertical);

      expect(result.intersects).toBe(true);
      expect(result.point!.x).toBeCloseTo(5);
      expect(result.point!.y).toBeCloseTo(5);
    });

    it('should return parallel=true for parallel lines', () => {
      const line1 = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const line2 = createLine({ x: 0, y: 5 }, { x: 10, y: 5 });

      const result = lineIntersection(line1, line2);

      expect(result.intersects).toBe(false);
      expect(result.parallel).toBe(true);
    });

    it('should find intersection of diagonal lines', () => {
      const line1 = createLine({ x: 0, y: 0 }, { x: 10, y: 10 });
      const line2 = createLine({ x: 0, y: 10 }, { x: 10, y: 0 });

      const result = lineIntersection(line1, line2);

      expect(result.intersects).toBe(true);
      expect(result.point!.x).toBeCloseTo(5);
      expect(result.point!.y).toBeCloseTo(5);
    });
  });

  describe('distanceToSegment', () => {
    it('should return 0 for point on line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: 5, y: 0 };

      expect(distanceToSegment(line, point)).toBeCloseTo(0);
    });

    it('should calculate perpendicular distance', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: 5, y: 3 };

      expect(distanceToSegment(line, point)).toBeCloseTo(3);
    });
  });

  describe('closestPointOnSegment', () => {
    it('should project point onto horizontal line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const point = { x: 5, y: 7 };

      const projected = closestPointOnSegment(line, point);

      expect(projected.x).toBeCloseTo(5);
      expect(projected.y).toBeCloseTo(0);
    });

    it('should project point onto vertical line', () => {
      const line = createLine({ x: 5, y: 0 }, { x: 5, y: 10 });
      const point = { x: 8, y: 3 };

      const projected = closestPointOnSegment(line, point);

      expect(projected.x).toBeCloseTo(5);
      expect(projected.y).toBeCloseTo(3);
    });
  });

  describe('parallelLine', () => {
    it('should create parallel line at specified offset', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const parallel = parallelLine(line, 5);

      expect(parallel.start.y).toBeCloseTo(5);
      expect(parallel.end.y).toBeCloseTo(5);
      expect(lineLength(parallel)).toBeCloseTo(lineLength(line));
    });
  });

  describe('perpendicularVector', () => {
    it('should return perpendicular vector for horizontal line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 10, y: 0 });
      const perp = perpendicularVector(line);

      // Perpendicular to horizontal line pointing up
      expect(perp.x).toBeCloseTo(0);
      expect(perp.y).toBeCloseTo(1);
    });

    it('should return perpendicular vector for vertical line', () => {
      const line = createLine({ x: 0, y: 0 }, { x: 0, y: 10 });
      const perp = perpendicularVector(line);

      // Perpendicular to vertical line pointing left
      expect(perp.x).toBeCloseTo(-1);
      expect(perp.y).toBeCloseTo(0);
    });
  });
});
