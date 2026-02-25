/**
 * Polygon clipping utilities.
 * Implements Sutherland-Hodgman clipping of a polygon against a half-plane.
 */

import { Point } from '../types/geometry';

/**
 * Clips a polygon to the half-plane defined by the "keep" side of a line.
 *
 * The keep side is determined by `lineNormal`: points P where
 *   dot(P - linePoint, lineNormal) >= 0
 * are kept; the rest are clipped away.
 *
 * Returns the clipped polygon vertices, or an empty array if the polygon
 * is entirely on the discard side.
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
    const t = da / (da - db);
    return {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y)
    };
  };

  const clipped: Point[] = [];
  for (let i = 0; i < output.length; i++) {
    const curr = output[i];
    const next = output[(i + 1) % output.length];
    const currInside = classify(curr) >= -1e-9;
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
