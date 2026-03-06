/**
 * @fileoverview Line segment and polyline utilities for 2D geometry.
 *
 * This module provides operations on line segments (start/end pairs) and polylines.
 * Lines are used for corridor centerlines, polygon edges, wall boundaries, and
 * intersection calculations. All coordinates and distances use feet (imperial).
 *
 * **Architecture Role**: Sits above the point module and is consumed by polygon,
 * clip, and graph modules. Critical for wing centerlines, edge extraction, and
 * line-line intersection tests used in footprint processing.
 *
 * **Direction Convention**: Lines have an implicit direction from start → end.
 * Perpendicular vectors use CCW rotation (left-facing normal). Offset directions:
 * positive = left of direction vector (CCW), negative = right.
 */

import { Line, Point } from '../types/geometry';
import { createPoint, distance, lerp } from './point';

/**
 * Creates a new line segment from two endpoints.
 *
 * @param start - Start point of the segment
 * @param end - End point of the segment
 * @returns A Line object
 */
export function createLine(start: Point, end: Point): Line {
  return { start, end };
}

/**
 * Creates a line segment from raw coordinates.
 *
 * @param x1 - Start X
 * @param y1 - Start Y
 * @param x2 - End X
 * @param y2 - End Y
 * @returns A Line from (x1,y1) to (x2,y2)
 */
export function createLineFromCoords(x1: number, y1: number, x2: number, y2: number): Line {
  return {
    start: createPoint(x1, y1),
    end: createPoint(x2, y2)
  };
}

/**
 * Calculates the Euclidean length of a line segment.
 *
 * @param line - Line segment
 * @returns Length in feet
 */
export function lineLength(line: Line): number {
  return distance(line.start, line.end);
}

/**
 * Returns the midpoint of a line segment.
 *
 * @param line - Line segment
 * @returns Point at t=0.5
 */
export function lineMidpoint(line: Line): Point {
  return lerp(line.start, line.end, 0.5);
}

/**
 * Returns a point along the line at parameter t.
 *
 * @param line - Line segment
 * @param t - Parameter (0 = start, 1 = end; values outside [0,1] extrapolate)
 * @returns Point on the line
 */
export function pointOnLine(line: Line, t: number): Point {
  return lerp(line.start, line.end, t);
}

/**
 * Returns the direction vector of a line (from start to end).
 *
 * Not normalized; magnitude equals segment length.
 *
 * @param line - Line segment
 * @returns Vector (end - start)
 */
export function lineDirection(line: Line): Point {
  return {
    x: line.end.x - line.start.x,
    y: line.end.y - line.start.y
  };
}

/**
 * Returns the unit-length direction vector of a line.
 *
 * @param line - Line segment
 * @returns Normalized vector; zero vector if segment is degenerate
 */
export function lineDirectionNormalized(line: Line): Point {
  const len = lineLength(line);
  if (len === 0) return { x: 0, y: 0 }; // Degenerate segment
  const dir = lineDirection(line);
  return {
    x: dir.x / len,
    y: dir.y / len
  };
}

/**
 * Returns the angle of the line in radians.
 *
 * Measured from positive X axis; same as atan2(dy, dx) for direction vector.
 *
 * @param line - Line segment
 * @returns Angle in [-π, π]
 */
export function lineAngle(line: Line): number {
  return Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
}

/**
 * Returns the left-facing perpendicular (normal) to the line direction.
 *
 * Rotated 90° CCW from direction: (-dy, dx) for normalized dir (dx, dy).
 *
 * @param line - Line segment
 * @returns Unit vector perpendicular to the line (pointing left)
 */
export function perpendicularVector(line: Line): Point {
  const dir = lineDirectionNormalized(line);
  return {
    x: -dir.y,
    y: dir.x
  };
}

/**
 * Creates a line parallel to the given line, offset perpendicularly.
 *
 * **Offset convention**: Positive = left of direction (CCW perpendicular);
 * negative = right. Both endpoints are shifted by the same amount.
 *
 * @param line - Source line
 * @param offset - Perpendicular distance (feet); sign determines side
 * @returns New parallel line
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
 * Extends or shortens a line at each end.
 *
 * @param line - Source line
 * @param startExtension - Amount to extend/retract at start (positive = extend backward)
 * @param endExtension - Amount to extend/retract at end (positive = extend forward)
 * @returns New line; negative values shorten the segment
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

  const t1 = result.t1!;
  const t2 = result.t2!;

  if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
    return result;
  }

  return { intersects: false, parallel: false };
}

/**
 * Calculates the closest point on a line segment to a given point.
 *
 * Uses orthogonal projection onto the line, then clamps to [0,1] so the result
 * lies on the segment (not the infinite line).
 *
 * @param line - Line segment
 * @param point - Query point
 * @returns Closest point on the segment
 *
 * @remarks
 * Formula: t = dot(P - A, B - A) / |B - A|²; clamp t ∈ [0,1].
 */
export function closestPointOnSegment(line: Line, point: Point): Point {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const len2 = dx * dx + dy * dy;

  if (len2 === 0) {
    return { ...line.start }; // Degenerate segment
  }

  let t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t)); // Clamp to segment

  return {
    x: line.start.x + t * dx,
    y: line.start.y + t * dy
  };
}

/**
 * Calculates the minimum distance from a point to a line segment.
 *
 * @param line - Line segment
 * @param point - Query point
 * @returns Perpendicular distance to segment, or distance to nearest endpoint
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
 * Reverses the direction of a line (swaps start and end).
 *
 * @param line - Line segment
 * @returns New line with start↔end swapped
 */
export function reverseLine(line: Line): Line {
  return {
    start: { ...line.end },
    end: { ...line.start }
  };
}

/**
 * Computes the angle bisector line at a vertex where two directions meet.
 *
 * The bisector divides the angle evenly. Used for wing centerline generation
 * where corridors turn at intersections. Returns a short segment from vertex
 * in the bisector direction.
 *
 * @param vertex - Shared vertex (start of bisector)
 * @param dir1 - First direction vector (need not be normalized)
 * @param dir2 - Second direction vector (need not be normalized)
 * @returns Line from vertex along the bisector; fallback if directions degenerate
 *
 * @remarks
 * Edge case: when dir1 and dir2 are opposite (bLen ≈ 0), the bisector is
 * ambiguous; we return perpendicular to dir1. Zero-length directions yield
 * a horizontal fallback ray.
 */
export function angleBisectorLine(
  vertex: Point,
  dir1: Point,
  dir2: Point
): Line {
  const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
  const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);
  if (len1 < 1e-9 || len2 < 1e-9) {
    return { start: vertex, end: { x: vertex.x + 1, y: vertex.y } }; // Fallback
  }
  const n1 = { x: dir1.x / len1, y: dir1.y / len1 };
  const n2 = { x: dir2.x / len2, y: dir2.y / len2 };
  const bx = n1.x + n2.x;
  const by = n1.y + n2.y;
  const bLen = Math.sqrt(bx * bx + by * by);
  if (bLen < 1e-9) {
    // Opposite directions: bisector perpendicular to either
    return { start: vertex, end: { x: vertex.x - n1.y, y: vertex.y + n1.x } };
  }
  return {
    start: vertex,
    end: { x: vertex.x + bx / bLen, y: vertex.y + by / bLen }
  };
}

/**
 * Computes the total length of a polyline (chain of segments).
 *
 * @param points - Ordered vertices (polyline not closed)
 * @returns Sum of segment lengths; 0 if fewer than 2 points
 */
export function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += distance(points[i], points[i + 1]);
  }
  return total;
}
