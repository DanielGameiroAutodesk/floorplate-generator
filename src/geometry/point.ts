/**
 * @fileoverview Point geometry utilities for 2D coordinate operations.
 *
 * This module provides the foundational building blocks for all geometric
 * computations in the Floorplate Generator. Points are the atomic unit of
 * spatial representation, used by lines, polygons, rectangles, and bounding
 * boxes. All measurements use the imperial system (feet) as defined in the
 * parent geometry types.
 *
 * **Architecture Role**: Acts as the base layer of the geometry subsystem.
 * Higher-level modules (line, polygon, rectangle) depend on point operations
 * for distance, interpolation, and transformation. All functions are pure and
 * immutable—no mutations of input objects.
 *
 * **Coordinate System**: Standard 2D Cartesian coordinates; Y increases upward.
 * Angular measurements use radians, with 0 radians = positive X (east).
 */

import { Point } from '../types/geometry';

/**
 * Creates a new point at the given coordinates.
 *
 * @param x - X-coordinate (horizontal position)
 * @param y - Y-coordinate (vertical position)
 * @returns A new Point object
 * @example
 * ```ts
 * const p = createPoint(10, 20);
 * // { x: 10, y: 20 }
 * ```
 */
export function createPoint(x: number, y: number): Point {
  return { x, y };
}

/**
 * Calculates the Euclidean distance between two points.
 *
 * Uses the standard formula: √((x₂-x₁)² + (y₂-y₁)²)
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance in feet (same units as coordinates)
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the squared distance between two points.
 *
 * Avoids the expensive sqrt operation. Use when comparing relative distances
 * (e.g., "closer than 5 units") since √a < √b iff a < b.
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Squared distance (units²)
 */
export function distanceSquared(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Calculates the midpoint between two points.
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Point exactly halfway between p1 and p2
 */
export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/**
 * Translates a point by the given delta.
 *
 * @param p - Point to translate
 * @param dx - Horizontal offset (positive = right)
 * @param dy - Vertical offset (positive = up)
 * @returns New point at (p.x + dx, p.y + dy)
 */
export function translate(p: Point, dx: number, dy: number): Point {
  return {
    x: p.x + dx,
    y: p.y + dy
  };
}

/**
 * Rotates a point around the origin (0, 0) by the given angle.
 *
 * Uses the 2D rotation matrix: [cos θ -sin θ; sin θ cos θ].
 * Positive angle = counter-clockwise rotation.
 *
 * @param p - Point to rotate
 * @param angle - Angle in radians (positive = CCW)
 * @returns Rotated point
 */
export function rotateAroundOrigin(p: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos
  };
}

/**
 * Rotates a point around an arbitrary center by the given angle.
 *
 * Applies translate → rotate → translate⁻¹ pipeline.
 *
 * @param p - Point to rotate
 * @param center - Center of rotation
 * @param angle - Angle in radians (positive = CCW)
 * @returns Rotated point
 */
export function rotateAroundPoint(p: Point, center: Point, angle: number): Point {
  const translated = translate(p, -center.x, -center.y);
  const rotated = rotateAroundOrigin(translated, angle);
  return translate(rotated, center.x, center.y);
}

/**
 * Scales a point relative to the origin (0, 0).
 *
 * @param p - Point to scale
 * @param factor - Scale factor (2 = double distance from origin)
 * @returns Scaled point
 */
export function scale(p: Point, factor: number): Point {
  return {
    x: p.x * factor,
    y: p.y * factor
  };
}

/**
 * Scales a point relative to an arbitrary center.
 *
 * Preserves the center position while scaling radial distance.
 *
 * @param p - Point to scale
 * @param center - Center of scaling (remains fixed)
 * @param factor - Scale factor
 * @returns Scaled point
 */
export function scaleFromPoint(p: Point, center: Point, factor: number): Point {
  return {
    x: center.x + (p.x - center.x) * factor,
    y: center.y + (p.y - center.y) * factor
  };
}

/**
 * Linear interpolation between two points.
 *
 * @param p1 - Start point
 * @param p2 - End point
 * @param t - Interpolation parameter (0 → p1, 1 → p2; values outside [0,1] extrapolate)
 * @returns Point on the segment p1–p2 (or extended line)
 */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t
  };
}

/**
 * Checks if two points are equal within numerical tolerance.
 *
 * Uses separate epsilon per axis to handle floating-point precision.
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @param epsilon - Maximum allowed difference per coordinate (default: 1e-4)
 * @returns True if |p1.x - p2.x| < epsilon and |p1.y - p2.y| < epsilon
 */
export function equals(p1: Point, p2: Point, epsilon: number = 0.0001): boolean {
  return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
}

/**
 * Calculates the angle from p1 toward p2 in radians.
 *
 * Uses atan2 for correct quadrant handling. 0 radians = positive X axis;
 * π/2 = positive Y; π = negative X.
 *
 * @param p1 - Origin point
 * @param p2 - Target point
 * @returns Angle in range [-π, π]
 */
export function angleBetween(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Creates a point at a given distance and angle from a start point.
 *
 * @param start - Origin point
 * @param angle - Direction in radians (0 = east)
 * @param distance - Distance from start
 * @returns New point at (start.x + cos(θ)·d, start.y + sin(θ)·d)
 */
export function pointAtAngle(start: Point, angle: number, distance: number): Point {
  return {
    x: start.x + Math.cos(angle) * distance,
    y: start.y + Math.sin(angle) * distance
  };
}

/**
 * Converts degrees to radians.
 *
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 *
 * @param radians - Angle in radians
 * @returns Angle in degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
