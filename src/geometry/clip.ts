/**
 * @fileoverview Polygon clipping utilities using half-plane intersection.
 *
 * Implements the Sutherland-Hodgman algorithm: clips a polygon against a
 * single half-plane defined by a line and its normal. Used as a building
 * block for clipping against rectangles (four half-planes) or arbitrary
 * convex clip regions. All coordinates in feet.
 *
 * **Architecture Role**: Supports corridor boundary clipping, footprint
 * intersection, and unit subdivision. Typically invoked repeatedly to clip
 * against each edge of a clip window (e.g., building outline, core bounds).
 *
 * **Half-Plane Definition**: The clip line is implicitly defined by
 * linePoint + lineNormal. The "keep" side is where dot(P - linePoint, lineNormal) ≥ 0.
 * Normal should point toward the keep side (or be zero-normalized for consistent behavior).
 */

import { Point } from '../types/geometry';

/**
 * Clips a polygon to the half-plane on the "keep" side of a line.
 *
 * Uses Sutherland-Hodgman: walk polygon edges, output vertices that are inside,
 * and compute edge-line intersections when crossing the clip boundary.
 *
 * @param polygon - Input polygon as ordered vertices (implicitly closed)
 * @param linePoint - Point on the clip line
 * @param lineNormal - Normal pointing toward the keep side (need not be unit length)
 * @returns Clipped polygon vertices; empty if entirely on discard side
 *
 * @remarks
 * Classification uses dot(P - linePoint, lineNormal). Threshold -1e-9 handles
 * points on the boundary (kept). Degenerate polygons (&lt; 3 vertices) return [].
 */
export function clipPolygonByLine(
  polygon: Point[],
  linePoint: Point,
  lineNormal: Point
): Point[] {
  if (polygon.length < 3) return [];

  let output = [...polygon];

  const classify = (p: Point): number =>
    (p.x - linePoint.x) * lineNormal.x + (p.y - linePoint.y) * lineNormal.y;

  const intersect = (a: Point, b: Point): Point => {
    const da = classify(a);
    const db = classify(b);
    const t = da / (da - db); // Parametric intersection: a + t*(b-a)
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y)
    };
  };

  const clipped: Point[] = [];
  for (let i = 0; i < output.length; i++) {
    const curr = output[i];
    const next = output[(i + 1) % output.length];
    const currInside = classify(curr) >= -1e-9; // Boundary = inside
    const nextInside = classify(next) >= -1e-9;

    if (currInside) {
      clipped.push(curr);
      if (!nextInside) {
        clipped.push(intersect(curr, next));
      }
    } else if (nextInside) {
      clipped.push(intersect(curr, next));
    }
  }

  return clipped;
}
