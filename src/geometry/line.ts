/**
 * Line utility functions
 * A line is defined by two endpoints (start and end)
 */

import { Line, Point } from '../types/geometry';
import { createPoint, distance, lerp } from './point';

/**
 * Creates a new line from two points
 */
export function createLine(start: Point, end: Point): Line {
  return { start, end };
}

/**
 * Creates a line from coordinates
 */
export function createLineFromCoords(x1: number, y1: number, x2: number, y2: number): Line {
  return {
    start: createPoint(x1, y1),
    end: createPoint(x2, y2)
  };
}

/**
 * Calculates the length of a line segment
 */
export function lineLength(line: Line): number {
  return distance(line.start, line.end);
}

/**
 * Returns the midpoint of a line segment
 */
export function lineMidpoint(line: Line): Point {
  return lerp(line.start, line.end, 0.5);
}

/**
 * Returns a point along the line at parameter t (0=start, 1=end)
 */
export function pointOnLine(line: Line, t: number): Point {
  return lerp(line.start, line.end, t);
}

/**
 * Returns the direction vector of a line (not normalized)
 */
export function lineDirection(line: Line): Point {
  return {
    x: line.end.x - line.start.x,
    y: line.end.y - line.start.y
  };
}

/**
 * Returns the normalized direction vector of a line
 */
export function lineDirectionNormalized(line: Line): Point {
  const len = lineLength(line);
  if (len === 0) return { x: 0, y: 0 };
  const dir = lineDirection(line);
  return {
    x: dir.x / len,
    y: dir.y / len
  };
}

/**
 * Returns the angle of the line (in radians)
 */
export function lineAngle(line: Line): number {
  return Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
}

/**
 * Returns a perpendicular vector to the line (rotated 90 degrees counter-clockwise)
 */
export function perpendicularVector(line: Line): Point {
  const dir = lineDirectionNormalized(line);
  return {
    x: -dir.y,
    y: dir.x
  };
}

/**
 * Creates a line parallel to the given line, offset by the given distance
 * Positive offset = to the left (counter-clockwise), negative = to the right
 */
export function parallelLine(line: Line, offset: number): Line {
  const perp = perpendicularVector(line);
  return {
    start: {
      x: line.start.x + perp.x * offset,
      y: line.start.y + perp.y * offset
    },
    end: {
      x: line.end.x + perp.x * offset,
      y: line.end.y + perp.y * offset
    }
  };
}

/**
 * Extends or shortens a line by the given amounts at each end
 * Positive values extend, negative values shorten
 */
export function extendLine(line: Line, startExtension: number, endExtension: number): Line {
  const dir = lineDirectionNormalized(line);
  return {
    start: {
      x: line.start.x - dir.x * startExtension,
      y: line.start.y - dir.y * startExtension
    },
    end: {
      x: line.end.x + dir.x * endExtension,
      y: line.end.y + dir.y * endExtension
    }
  };
}

/**
 * Result of a line-line intersection calculation
 */
export interface LineIntersectionResult {
  /** Whether the lines intersect */
  intersects: boolean;
  /** The intersection point (if intersects is true) */
  point?: Point;
  /** Parameter t on line1 (0-1 if within segment) */
  t1?: number;
  /** Parameter t on line2 (0-1 if within segment) */
  t2?: number;
  /** Whether the lines are parallel */
  parallel: boolean;
}

/**
 * Calculates the intersection of two lines (as infinite lines)
 * Returns t parameters for both lines where the intersection occurs
 */
export function lineIntersection(line1: Line, line2: Line): LineIntersectionResult {
  const x1 = line1.start.x, y1 = line1.start.y;
  const x2 = line1.end.x, y2 = line1.end.y;
  const x3 = line2.start.x, y3 = line2.start.y;
  const x4 = line2.end.x, y4 = line2.end.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel
  if (Math.abs(denom) < 0.0001) {
    return { intersects: false, parallel: true };
  }

  const t1 = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const t2 = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  const point = {
    x: x1 + t1 * (x2 - x1),
    y: y1 + t1 * (y2 - y1)
  };

  return {
    intersects: true,
    point,
    t1,
    t2,
    parallel: false
  };
}

/**
 * Calculates the intersection of two line segments
 * Only returns intersection if both t values are in [0, 1]
 */
export function segmentIntersection(line1: Line, line2: Line): LineIntersectionResult {
  const result = lineIntersection(line1, line2);

  if (!result.intersects) {
    return result;
  }

  // Check if intersection is within both segments
  const t1 = result.t1!;
  const t2 = result.t2!;

  if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
    return result;
  }

  return { intersects: false, parallel: false };
}

/**
 * Calculates the closest point on a line segment to a given point
 */
export function closestPointOnSegment(line: Line, point: Point): Point {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const len2 = dx * dx + dy * dy;

  if (len2 === 0) {
    // Line segment is actually a point
    return { ...line.start };
  }

  // Calculate parameter t for projection
  let t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / len2;

  // Clamp t to [0, 1] to stay within segment
  t = Math.max(0, Math.min(1, t));

  return {
    x: line.start.x + t * dx,
    y: line.start.y + t * dy
  };
}

/**
 * Calculates the distance from a point to a line segment
 */
export function distanceToSegment(line: Line, point: Point): number {
  const closest = closestPointOnSegment(line, point);
  return distance(point, closest);
}

/**
 * Checks if a point lies on a line segment (within tolerance)
 */
export function pointOnSegment(line: Line, point: Point, tolerance: number = 0.0001): boolean {
  return distanceToSegment(line, point) < tolerance;
}

/**
 * Reverses the direction of a line
 */
export function reverseLine(line: Line): Line {
  return {
    start: { ...line.end },
    end: { ...line.start }
  };
}
