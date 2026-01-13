/**
 * Point utility functions
 * All functions are pure and return new objects (no mutation)
 */

import { Point } from '../types/geometry';

/**
 * Creates a new point
 */
export function createPoint(x: number, y: number): Point {
  return { x, y };
}

/**
 * Calculates the Euclidean distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the squared distance between two points
 * (Useful when comparing distances without needing the actual value)
 */
export function distanceSquared(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/**
 * Calculates the midpoint between two points
 */
export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  };
}

/**
 * Translates a point by dx, dy
 */
export function translate(p: Point, dx: number, dy: number): Point {
  return {
    x: p.x + dx,
    y: p.y + dy
  };
}

/**
 * Rotates a point around the origin by angle (in radians)
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
 * Rotates a point around a center point by angle (in radians)
 */
export function rotateAroundPoint(p: Point, center: Point, angle: number): Point {
  // Translate to origin
  const translated = translate(p, -center.x, -center.y);
  // Rotate around origin
  const rotated = rotateAroundOrigin(translated, angle);
  // Translate back
  return translate(rotated, center.x, center.y);
}

/**
 * Scales a point relative to the origin
 */
export function scale(p: Point, factor: number): Point {
  return {
    x: p.x * factor,
    y: p.y * factor
  };
}

/**
 * Scales a point relative to a center point
 */
export function scaleFromPoint(p: Point, center: Point, factor: number): Point {
  return {
    x: center.x + (p.x - center.x) * factor,
    y: center.y + (p.y - center.y) * factor
  };
}

/**
 * Interpolates between two points (t=0 returns p1, t=1 returns p2)
 */
export function lerp(p1: Point, p2: Point, t: number): Point {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t
  };
}

/**
 * Checks if two points are equal (within epsilon tolerance)
 */
export function equals(p1: Point, p2: Point, epsilon: number = 0.0001): boolean {
  return Math.abs(p1.x - p2.x) < epsilon && Math.abs(p1.y - p2.y) < epsilon;
}

/**
 * Calculates the angle from p1 to p2 (in radians, 0 = positive X direction)
 */
export function angleBetween(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Creates a point at a given distance and angle from a start point
 */
export function pointAtAngle(start: Point, angle: number, distance: number): Point {
  return {
    x: start.x + Math.cos(angle) * distance,
    y: start.y + Math.sin(angle) * distance
  };
}

/**
 * Converts degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
